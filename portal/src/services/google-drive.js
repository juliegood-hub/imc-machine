import { parseLocalDate } from '../lib/dateUtils.js';
// ═══════════════════════════════════════════════════════════════
// IMC Machine — Google Drive Service (Client-Side)
// All API calls routed through /api/drive (server-side) — TO BE IMPLEMENTED
// NO API keys in client code
//
// Creates standardized folder structures for venue campaigns:
// Good Creative Media/
//   └── Venues/
//       └── [Venue Name]/
//           └── [YYYY]/
//               └── [Event Title] - [Date]/
//                   ├── 01-Research/
//                   ├── 02-Content/
//                   ├── 03-Graphics/
//                   ├── 04-Distribution/
//                   └── 05-Analytics/
// ═══════════════════════════════════════════════════════════════

// Standard folder structure for venue campaigns
const CAMPAIGN_FOLDER_STRUCTURE = [
  '01-Research',
  '02-Content', 
  '03-Graphics',
  '04-Distribution',
  '05-Analytics',
];

// ═══════════════════════════════════════════════════════════════
// CREATE EVENT CAMPAIGN FOLDER STRUCTURE
// ═══════════════════════════════════════════════════════════════

export async function createEventFolder(event, venue) {
  try {
    // When /api/drive is implemented, this will call:
    const res = await fetch('/api/drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-campaign-folder',
        event,
        venue,
        folderStructure: CAMPAIGN_FOLDER_STRUCTURE,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create campaign folder');
    return {
      success: true,
      parentFolderId: data.parentFolderId,
      parentFolderUrl: data.parentFolderUrl,
      subfolders: data.subfolders,
      message: `Campaign folder created: ${data.parentFolderUrl}`,
    };
  } catch (err) {
    // API not implemented yet - return mock structure for now
    const eventYear = parseLocalDate(event.date).getFullYear();
    const eventDate = parseLocalDate(event.date).toISOString().split('T')[0];
    const folderName = `${event.title} - ${eventDate}`;
    const venueName = venue?.name || 'Unknown Venue';
    
    console.log(`[Drive] Would create campaign folder structure:`);
    console.log(`  Good Creative Media/Venues/${venueName}/${eventYear}/${folderName}/`);
    CAMPAIGN_FOLDER_STRUCTURE.forEach(subfolder => {
      console.log(`    └── ${subfolder}/`);
    });
    
    return {
      success: false,
      error: 'Google Drive API not yet implemented',
      mockStructure: {
        parentFolder: `${venueName}/${eventYear}/${folderName}`,
        subfolders: CAMPAIGN_FOLDER_STRUCTURE,
      },
      note: 'This will create a structured folder in Google Drive when API is connected',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD ASSET TO SPECIFIC SUBFOLDER
// ═══════════════════════════════════════════════════════════════

export async function uploadAsset(folderId, file, fileName, subfolder = '03-Graphics') {
  try {
    // When /api/drive is implemented, this will call:
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);
    formData.append('folderId', folderId);
    formData.append('subfolder', subfolder);

    const res = await fetch('/api/drive', {
      method: 'POST',
      body: formData, // FormData for file upload
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to upload asset');
    return {
      success: true,
      fileId: data.fileId,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      subfolder: data.subfolder,
    };
  } catch (err) {
    console.log(`[Drive] Would upload ${fileName} to ${subfolder}/ in folder ${folderId}`);
    return {
      success: false,
      error: 'Google Drive API not yet implemented',
      note: `Would upload ${fileName} to ${subfolder}/`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD GENERATED IMAGE/DOCUMENT BY URL
// ═══════════════════════════════════════════════════════════════

export async function uploadAssetFromUrl(folderId, assetUrl, fileName, subfolder = '03-Graphics') {
  try {
    const res = await fetch('/api/drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload-from-url',
        folderId,
        assetUrl,
        fileName,
        subfolder,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to upload asset from URL');
    return {
      success: true,
      fileId: data.fileId,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      subfolder: data.subfolder,
    };
  } catch (err) {
    console.log(`[Drive] Would download ${assetUrl} and upload as ${fileName} to ${subfolder}/`);
    return {
      success: false,
      error: 'Google Drive API not yet implemented',
      note: `Would upload ${fileName} from URL to ${subfolder}/`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// LIST ALL ASSETS IN CAMPAIGN FOLDER
// ═══════════════════════════════════════════════════════════════

export async function listAssets(folderId) {
  try {
    const res = await fetch('/api/drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list-assets',
        folderId,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to list assets');
    return data.assets || [];
  } catch (err) {
    console.log(`[Drive] Would list all files in folder ${folderId}`);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// GET SHAREABLE FOLDER URL
// ═══════════════════════════════════════════════════════════════

export function getFolderUrl(folderId) {
  if (!folderId) return null;
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// ═══════════════════════════════════════════════════════════════
// BATCH UPLOAD GENERATED CAMPAIGN ASSETS
// ═══════════════════════════════════════════════════════════════

export async function uploadCampaignAssets(folderId, assets = {}) {
  const results = [];
  
  // Upload press materials to 02-Content
  if (assets.pressRelease) {
    const result = await uploadAssetFromUrl(
      folderId, 
      assets.pressRelease, 
      'Press_Release.html', 
      '02-Content'
    );
    results.push({ type: 'press', ...result });
  }

  // Upload graphics to 03-Graphics  
  if (assets.images && Array.isArray(assets.images)) {
    for (const img of assets.images) {
      if (img.url && img.label) {
        const fileName = `${img.label.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
        const result = await uploadAssetFromUrl(
          folderId,
          img.url,
          fileName,
          '03-Graphics'
        );
        results.push({ type: 'image', label: img.label, ...result });
      }
    }
  }

  return results;
}

// Legacy support - keep the object structure for backwards compatibility
export const driveService = {
  async createEventFolder(eventName, venue = null) {
    // Convert legacy call to new structure
    const event = { title: eventName, date: new Date().toISOString().split('T')[0] };
    return await createEventFolder(event, venue);
  },

  async uploadAsset(folderId, file, fileName) {
    return await uploadAsset(folderId, file, fileName, '03-Graphics');
  },

  async listAssets(folderId) {
    return await listAssets(folderId);
  },

  async getFolderUrl(folderId) {
    return getFolderUrl(folderId);
  },
};
