export const DEFAULT_REACTION_EMOJIS = ['👍', '✅', '🙏', '🔥', '😂', '🎭', '🎶'];

export const ROLE_MENTION_KEYS = ['FOH', 'BOH', 'StageManager', 'Security'];

export const SMART_REPLY_CHIPS = [
  'On it.',
  'Copy.',
  'Done.',
  'Need 2 minutes.',
];

export const OPS_SHORTCUT_CHIPS = [
  'Dim lights to 30%',
  'Turn guitar up +2 dB',
  'Hold doors 10 minutes',
];

const MENTION_REGEX = /(^|\s)@([a-zA-Z0-9_.-]{2,64})/g;

export function createClientMessageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeMessageBody(body = '') {
  return String(body || '').replace(/\r/g, '').trim();
}

export function parseMessageMentions(messageText = '', options = {}) {
  const text = sanitizeMessageBody(messageText);
  const staffProfiles = Array.isArray(options.staffProfiles) ? options.staffProfiles : [];
  const roleKeys = Array.isArray(options.roleKeys) && options.roleKeys.length
    ? options.roleKeys
    : ROLE_MENTION_KEYS;
  MENTION_REGEX.lastIndex = 0;

  const staffByToken = new Map();
  staffProfiles.forEach((staff) => {
    const name = String(staff.display_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || '').trim();
    if (!name) return;
    const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (handle) staffByToken.set(handle, staff);
    const first = String(staff.first_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (first) staffByToken.set(first, staff);
  });

  const mentions = [];
  const seen = new Set();
  let match;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const rawToken = String(match[2] || '').trim();
    const token = rawToken.toLowerCase();
    if (!token) continue;
    const normalized = token.replace(/[^a-z0-9]+/g, '');
    const key = `@${normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const matchingRole = roleKeys.find((roleKey) => (
      String(roleKey).toLowerCase().replace(/[^a-z0-9]+/g, '') === normalized
    ));

    if (matchingRole) {
      mentions.push({
        token: rawToken,
        type: 'role',
        mentionedRoleKey: matchingRole,
      });
      continue;
    }

    const staff = staffByToken.get(normalized);
    if (staff?.id) {
      mentions.push({
        token: rawToken,
        type: 'user',
        mentionedUserId: staff.id,
      });
    }
  }

  return mentions;
}

export function summarizeMessageReactions(reactionRows = [], userId = '') {
  const byEmoji = new Map();
  const dedupe = new Set();
  (reactionRows || []).forEach((row) => {
    const emoji = String(row.emoji || '').trim();
    if (!emoji) return;
    const reactionKey = row.user_id ? `${emoji}::${row.user_id}` : '';
    if (reactionKey && dedupe.has(reactionKey)) return;
    if (reactionKey) dedupe.add(reactionKey);
    const current = byEmoji.get(emoji) || { emoji, count: 0, reacted: false };
    current.count += 1;
    if (userId && row.user_id === userId) current.reacted = true;
    byEmoji.set(emoji, current);
  });
  return Array.from(byEmoji.values()).sort((a, b) => b.count - a.count);
}

export function queueOutgoingMessage(queue = [], nextMessage = {}) {
  const next = Array.isArray(queue) ? [...queue] : [];
  const clientMessageId = String(nextMessage.client_message_id || '').trim();
  if (!clientMessageId) return [...next, nextMessage];
  const existingIndex = next.findIndex((row) => row.client_message_id === clientMessageId);
  if (existingIndex === -1) return [...next, nextMessage];
  next[existingIndex] = { ...next[existingIndex], ...nextMessage };
  return next;
}

export function filterConversationMessages(messages = [], filters = {}) {
  const query = String(filters.query || '').trim().toLowerCase();
  return (messages || []).filter((message) => {
    if (filters.attachmentsOnly && !message.has_attachments) return false;
    if (filters.mentionsOnly && (!Array.isArray(message.mentions) || message.mentions.length === 0)) return false;
    if (filters.systemOnly && message.message_type !== 'system') return false;
    if (!query) return true;
    const search = [
      message.body_text,
      message.author_name,
      message.language_hint,
    ].map((value) => String(value || '').toLowerCase()).join(' ');
    return search.includes(query);
  });
}
