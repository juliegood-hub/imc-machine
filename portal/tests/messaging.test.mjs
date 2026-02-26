import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterConversationMessages,
  parseMessageMentions,
  queueOutgoingMessage,
  summarizeMessageReactions,
} from '../src/services/messaging.js';

test('parseMessageMentions maps user and role mentions', () => {
  const mentions = parseMessageMentions(
    'Need @alex and @FOH at doors in 10.',
    {
      staffProfiles: [{ id: 'staff-1', first_name: 'Alex', last_name: 'Rivera', display_name: 'Alex Rivera' }],
    }
  );

  assert.equal(mentions.length, 2);
  assert.deepEqual(mentions[0], { token: 'alex', type: 'user', mentionedUserId: 'staff-1' });
  assert.deepEqual(mentions[1], { token: 'FOH', type: 'role', mentionedRoleKey: 'FOH' });
});

test('parseMessageMentions resets regex state across calls', () => {
  const first = parseMessageMentions('Call @alex now.', {
    staffProfiles: [{ id: 'staff-1', first_name: 'Alex', last_name: 'Rivera', display_name: 'Alex Rivera' }],
  });
  const second = parseMessageMentions('Ping @FOH and @alex.', {
    staffProfiles: [{ id: 'staff-1', first_name: 'Alex', last_name: 'Rivera', display_name: 'Alex Rivera' }],
  });
  assert.equal(first.length, 1);
  assert.equal(second.length, 2);
});

test('queueOutgoingMessage deduplicates by client_message_id', () => {
  const first = queueOutgoingMessage([], { client_message_id: 'abc', body_text: 'Sending', delivery_state: 'sending' });
  const second = queueOutgoingMessage(first, { client_message_id: 'abc', body_text: 'Sent', delivery_state: 'sent' });
  assert.equal(second.length, 1);
  assert.equal(second[0].body_text, 'Sent');
  assert.equal(second[0].delivery_state, 'sent');
});

test('summarizeMessageReactions returns counts and reacted state', () => {
  const summary = summarizeMessageReactions(
    [
      { emoji: '✅', user_id: 'u1' },
      { emoji: '✅', user_id: 'u2' },
      { emoji: '🔥', user_id: 'u2' },
    ],
    'u2'
  );

  assert.deepEqual(summary.find((row) => row.emoji === '✅'), { emoji: '✅', count: 2, reacted: true });
  assert.deepEqual(summary.find((row) => row.emoji === '🔥'), { emoji: '🔥', count: 1, reacted: true });
});

test('summarizeMessageReactions ignores duplicate rows per user/emoji', () => {
  const summary = summarizeMessageReactions(
    [
      { emoji: '✅', user_id: 'u1' },
      { emoji: '✅', user_id: 'u1' },
      { emoji: '✅', user_id: 'u2' },
    ],
    'u1'
  );
  assert.deepEqual(summary.find((row) => row.emoji === '✅'), { emoji: '✅', count: 2, reacted: true });
});

test('filterConversationMessages applies text and mode filters', () => {
  const filtered = filterConversationMessages(
    [
      { body_text: 'Hello @FOH', author_name: 'Julie', has_attachments: false, mentions: [{ mentioned_role_key: 'FOH' }], message_type: 'user' },
      { body_text: 'Attachment note', author_name: 'Ops Bot', has_attachments: true, mentions: [], message_type: 'system' },
    ],
    { query: 'hello', mentionsOnly: true, attachmentsOnly: false, systemOnly: false }
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].author_name, 'Julie');
});
