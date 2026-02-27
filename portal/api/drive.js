// ═══════════════════════════════════════════════════════════════
// IMC Machine: Google Drive Integration API
// Vercel Serverless Function
//
// POST /api/drive
// Body: { action, ... }
//
// Actions:
//   create-client-folder  → Create top-level client folder tree
//   create-event-folder   → Create event subfolder with content dirs
//   upload-file           → Upload a file to a specific folder
//   list-files            → List files in a folder
//   get-share-link        → Get sharing URL for a folder
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import {
  ApiAuthError,
  assertEventOwnership,
  requireApiAuth,
  resolvePayloadEventId,
  scopePayloadToUser,
} from './_auth.js';

const ADMIN_EMAIL = 'juliegood@goodcreativemedia.com';
const IMC_ROOT_FOLDER_NAME = 'IMC Machine';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Google Drive client
function getDriveClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('I need GOOGLE_SERVICE_ACCOUNT_KEY before I can work with Drive. Add it and I will handle the rest.');

  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Send this endpoint a POST request and I can run it.' });

  const { action } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Tell me which Drive action you want and I will run it.' });

  try {
    const authContext = await requireApiAuth(req, { supabase });
    const payload = scopePayloadToUser(req.body || {}, authContext);
    const eventId = resolvePayloadEventId(payload);
    if (eventId) {
      await assertEventOwnership(supabase, authContext, eventId);
    }

    let result;
    switch (action) {
      case 'create-client-folder':
        result = await createClientFolder(payload);
        break;
      case 'create-event-folder':
        result = await createEventFolder(payload);
        break;
      case 'upload-file':
        result = await uploadFile(payload);
        break;
      case 'list-files':
        result = await listFiles(payload);
        break;
      case 'get-share-link':
        result = await getShareLink(payload);
        break;
      default:
        return res.status(400).json({ error: `I do not recognize "${action}" yet. Choose one of the supported Drive actions.` });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error(`[drive] ${action} error:`, err);
    if (err instanceof ApiAuthError) {
      return res.status(err.status || 401).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function createFolder(drive, name, parentId) {
  const { data } = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [],
    },
    fields: 'id, webViewLink',
  });
  return data;
}

async function shareFolder(drive, folderId, email, role = 'writer') {
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        type: 'user',
        role,
        emailAddress: email,
      },
      sendNotificationEmail: false,
    });
  } catch (err) {
    // Permission may already exist — that's fine
    if (!err.message?.includes('already has access')) {
      console.warn(`[drive] Failed to share with ${email}:`, err.message);
    }
  }
}

async function getOrCreateImcRootFolder(drive) {
  // Check app_settings first
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'drive_imcmachine_folder_id')
    .single();

  if (setting?.value) {
    // Verify folder still exists
    try {
      await drive.files.get({ fileId: setting.value, fields: 'id' });
      return setting.value;
    } catch {
      // Folder was deleted, recreate
    }
  }

  // Create the root IMC Machine folder
  const folder = await createFolder(drive, IMC_ROOT_FOLDER_NAME, null);

  // Share with admin
  await shareFolder(drive, folder.id, ADMIN_EMAIL);

  // Store in app_settings
  await supabase.from('app_settings').upsert({
    key: 'drive_imcmachine_folder_id',
    value: folder.id,
    updated_at: new Date().toISOString(),
  });

  return folder.id;
}

// ═══════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════

async function createClientFolder({ clientName, userEmail, userId }) {
  if (!clientName) throw new Error('I need the client name before I can build folders.');
  if (!userId) throw new Error('I need the user ID before I can attach this folder tree.');

  const drive = getDriveClient();
  const rootId = await getOrCreateImcRootFolder(drive);

  // Create: IMC Machine / {Client Name}
  const clientFolder = await createFolder(drive, clientName, rootId);

  // Create: {Client Name} / Brand Assets
  const brandFolder = await createFolder(drive, 'Brand Assets', clientFolder.id);

  // Create subfolders under Brand Assets
  await Promise.all([
    createFolder(drive, 'Logos', brandFolder.id),
    createFolder(drive, 'Headshots', brandFolder.id),
  ]);

  // Share client folder with user and admin
  const shareEmails = [ADMIN_EMAIL];
  if (userEmail && userEmail !== ADMIN_EMAIL) shareEmails.push(userEmail);
  await Promise.all(shareEmails.map(email => shareFolder(drive, clientFolder.id, email)));

  // Store folder IDs in profiles
  await supabase
    .from('profiles')
    .update({
      drive_root_folder_id: clientFolder.id,
      drive_brand_folder_id: brandFolder.id,
    })
    .eq('user_id', userId);

  return {
    driveRootFolderId: clientFolder.id,
    driveBrandFolderId: brandFolder.id,
    folderUrl: clientFolder.webViewLink,
  };
}

async function createEventFolder({ eventId, eventTitle, eventDate, clientFolderId, userEmail }) {
  if (!eventId) throw new Error('I need the event ID before I can create the event folder.');
  if (!eventTitle) throw new Error('I need the event title before I can name the event folder.');
  if (!clientFolderId) throw new Error('I need the client folder ID before I can place this event folder.');

  const drive = getDriveClient();

  // Format date
  const dateStr = eventDate ? new Date(eventDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const folderName = `${eventTitle} - ${dateStr}`;

  // Create event folder under client folder
  const eventFolder = await createFolder(drive, folderName, clientFolderId);

  // Create subfolders
  await Promise.all([
    createFolder(drive, 'Press Releases', eventFolder.id),
    createFolder(drive, 'Social Posts', eventFolder.id),
    createFolder(drive, 'Images', eventFolder.id),
    createFolder(drive, 'Email Campaigns', eventFolder.id),
    createFolder(drive, 'Calendar Listings', eventFolder.id),
  ]);

  // Share with user if provided
  if (userEmail) {
    await shareFolder(drive, eventFolder.id, userEmail);
  }

  // Store folder ID on event
  await supabase
    .from('events')
    .update({ drive_event_folder_id: eventFolder.id })
    .eq('id', eventId);

  return {
    driveEventFolderId: eventFolder.id,
    folderUrl: eventFolder.webViewLink,
  };
}

async function uploadFile({ folderId, fileName, content, mimeType }) {
  if (!folderId) throw new Error('I need a folder ID before I can upload this file.');
  if (!fileName) throw new Error('I need a file name before I can upload this.');
  if (!content) throw new Error('I need file content before I can upload this.');

  const drive = getDriveClient();

  // For text content, create a Google Doc
  const isText = !mimeType || mimeType.startsWith('text/') || mimeType === 'application/json';

  if (isText) {
    const { data } = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId],
      },
      media: {
        mimeType: 'text/plain',
        body: content,
      },
      fields: 'id, webViewLink',
    });
    return { fileId: data.id, url: data.webViewLink };
  }

  // For binary content (images etc.), upload as-is
  const buffer = Buffer.from(content, 'base64');
  const { Readable } = await import('stream');
  const stream = Readable.from(buffer);

  const { data } = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: stream,
    },
    fields: 'id, webViewLink',
  });
  return { fileId: data.id, url: data.webViewLink };
}

async function listFiles({ folderId }) {
  if (!folderId) throw new Error('I need the folder ID to list files.');

  const drive = getDriveClient();
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, createdTime, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
  });

  return { files: data.files || [] };
}

async function getShareLink({ folderId }) {
  if (!folderId) throw new Error('I need the folder ID to fetch the share link.');

  const drive = getDriveClient();
  const { data } = await drive.files.get({
    fileId: folderId,
    fields: 'webViewLink',
  });

  return { url: data.webViewLink };
}
