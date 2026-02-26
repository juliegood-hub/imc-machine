import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVenue } from '../context/VenueContext';
import {
  DEFAULT_REACTION_EMOJIS,
  OPS_SHORTCUT_CHIPS,
  ROLE_MENTION_KEYS,
  SMART_REPLY_CHIPS,
  createClientMessageId,
  filterConversationMessages,
  parseMessageMentions,
  queueOutgoingMessage,
  sanitizeMessageBody,
  summarizeMessageReactions,
} from '../services/messaging';

const DEFAULT_CONVERSATION = {
  show_mode_enabled: false,
  mute_non_critical: false,
  pinned_ops_commands: '',
};

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('I could not read that file yet.'));
    reader.readAsDataURL(file);
  });
}

function looksCritical(message = {}) {
  if (message.message_type === 'system_critical') return true;
  const text = String(message.body_text || '').toLowerCase();
  return text.includes('urgent') || text.includes('911') || text.includes('immediately');
}

function isMentionForUser(message = {}, userId = '') {
  if (!userId || !Array.isArray(message.mentions)) return false;
  return message.mentions.some((mention) => mention.mentioned_user_id === userId);
}

function toDisplayTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function mergeMessages(prev = [], incoming = []) {
  const next = Array.isArray(prev) ? [...prev] : [];
  (incoming || []).forEach((row) => {
    const byId = row.id ? next.findIndex((item) => item.id === row.id) : -1;
    const byClientId = row.client_message_id
      ? next.findIndex((item) => item.client_message_id === row.client_message_id)
      : -1;
    const targetIndex = byId !== -1 ? byId : byClientId;
    if (targetIndex === -1) {
      next.push(row);
    } else {
      next[targetIndex] = { ...next[targetIndex], ...row };
    }
  });
  return next.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
}

function renderMessageBody(text = '') {
  const chunks = String(text || '').split(/(https?:\/\/[^\s]+)/g);
  return chunks.map((chunk, index) => {
    if (!chunk) return null;
    if (/^https?:\/\//i.test(chunk)) {
      return (
        <a key={`${chunk}-${index}`} href={chunk} target="_blank" rel="noopener noreferrer" className="underline break-all">
          {chunk}
        </a>
      );
    }
    return <span key={`${index}`}>{chunk}</span>;
  });
}

export default function EventMessagingPanel({ event, staffProfiles = [] }) {
  const {
    currentUserId,
    listEventMessages,
    sendEventMessageRecord,
    toggleEventMessageReaction,
    getEventConversationState,
    saveEventConversationState,
    translateEventMessage,
  } = useVenue();

  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(DEFAULT_CONVERSATION);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [composerText, setComposerText] = useState('');
  const [languageHint, setLanguageHint] = useState('en');
  const [translationTarget, setTranslationTarget] = useState('es');
  const [filters, setFilters] = useState({
    query: '',
    attachmentsOnly: false,
    mentionsOnly: false,
    systemOnly: false,
  });
  const [outgoingQueue, setOutgoingQueue] = useState([]);
  const [translationsByMessage, setTranslationsByMessage] = useState({});
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [savingConversation, setSavingConversation] = useState(false);
  const recognitionRef = useRef(null);
  const composerRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const response = await listEventMessages(event.id, { limit: 150 });
      setMessages(response?.messages || []);
      if (response?.conversation) {
        setConversation({
          ...DEFAULT_CONVERSATION,
          ...response.conversation,
        });
      } else {
        const state = await getEventConversationState(event.id).catch(() => null);
        if (state) {
          setConversation({
            ...DEFAULT_CONVERSATION,
            ...state,
          });
        }
      }
      setStatus('');
    } catch (err) {
      setStatus(`Messaging load failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [event?.id, getEventConversationState, listEventMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!event?.id) return undefined;
    const timer = setInterval(() => {
      loadMessages().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [event?.id, loadMessages]);

  useEffect(() => {
    const onOnline = () => {
      const failed = outgoingQueue.filter((row) => row.delivery_state === 'failed');
      failed.forEach((row) => {
        if (!row.client_message_id) return;
        handleSendMessage({
          clientMessageId: row.client_message_id,
          bodyText: row.body_text || '',
          attachments: row.attachments || [],
          languageHint: row.language_hint || languageHint,
        }, true).catch(() => {});
      });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [languageHint, outgoingQueue]);

  const visibleMessages = useMemo(() => {
    let next = filterConversationMessages(messages, filters);
    if (conversation.mute_non_critical) {
      next = next.filter((message) => looksCritical(message) || isMentionForUser(message, currentUserId));
    }
    return next;
  }, [conversation.mute_non_critical, currentUserId, filters, messages]);

  const queueSummary = useMemo(() => {
    const sending = outgoingQueue.filter((row) => row.delivery_state === 'sending').length;
    const failed = outgoingQueue.filter((row) => row.delivery_state === 'failed').length;
    return { sending, failed };
  }, [outgoingQueue]);

  const handleSaveConversation = useCallback(async (updates = {}) => {
    if (!event?.id) return;
    const next = { ...conversation, ...updates };
    setConversation(next);
    setSavingConversation(true);
    try {
      const saved = await saveEventConversationState(event.id, {
        showModeEnabled: next.show_mode_enabled,
        muteNonCritical: next.mute_non_critical,
        pinnedOpsCommands: next.pinned_ops_commands,
      });
      if (saved) {
        setConversation({
          ...DEFAULT_CONVERSATION,
          ...saved,
        });
      }
      setStatus('Conversation settings saved.');
    } catch (err) {
      setStatus(`Conversation settings failed: ${err.message}`);
    } finally {
      setSavingConversation(false);
    }
  }, [conversation, event?.id, saveEventConversationState]);

  const handleUploadAttachments = useCallback(async (files = []) => {
    if (!files.length || !currentUserId || !event?.id) return;
    setUploadingAttachments(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const base64 = await readFileAsDataUrl(file);
        const response = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            base64,
            userId: currentUserId,
            eventId: event.id,
            category: 'event_message',
            label: file.name || 'Attachment',
            fileName: file.name || `message-${Date.now()}`,
            mimeType: file.type || 'application/octet-stream',
          }),
        });
        const data = await response.json();
        if (!response.ok || data.success === false || !data.url) {
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }
        uploaded.push({
          url: data.url,
          name: file.name || 'Attachment',
          mimeType: file.type || '',
          size: file.size || 0,
        });
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
      setStatus(`${uploaded.length} attachment${uploaded.length === 1 ? '' : 's'} uploaded.`);
    } catch (err) {
      setStatus(`Attachment upload failed: ${err.message}`);
    } finally {
      setUploadingAttachments(false);
    }
  }, [currentUserId, event?.id]);

  const handleSendMessage = useCallback(async (override = null, isRetry = false) => {
    if (!event?.id) return;
    const bodyText = sanitizeMessageBody(override?.bodyText ?? composerText);
    const attachments = Array.isArray(override?.attachments) ? override.attachments : pendingAttachments;
    if (!bodyText && !attachments.length) return;
    const clientMessageId = String(override?.clientMessageId || createClientMessageId());
    const mentions = parseMessageMentions(bodyText, { staffProfiles, roleKeys: ROLE_MENTION_KEYS });
    const nowIso = new Date().toISOString();
    const optimisticMessage = {
      id: override?.id || `local:${clientMessageId}`,
      event_id: event.id,
      author_user_id: currentUserId,
      author_name: 'You',
      body_text: bodyText,
      message_type: 'user',
      language_hint: override?.languageHint || languageHint,
      client_message_id: clientMessageId,
      created_at: nowIso,
      attachments,
      has_attachments: attachments.length > 0,
      mentions: mentions.map((mention) => ({
        mentioned_user_id: mention.mentionedUserId || null,
        mentioned_role_key: mention.mentionedRoleKey || null,
      })),
      reactions: [],
      reaction_summary: [],
      delivery_state: 'sending',
    };

    setMessages((prev) => mergeMessages(prev, [optimisticMessage]));
    setOutgoingQueue((prev) => queueOutgoingMessage(prev, {
      client_message_id: clientMessageId,
      body_text: bodyText,
      attachments,
      language_hint: optimisticMessage.language_hint,
      delivery_state: 'sending',
    }));

    if (!isRetry) {
      setComposerText('');
      setPendingAttachments([]);
    }

    try {
      const saved = await sendEventMessageRecord(event.id, {
        clientMessageId,
        bodyText,
        languageHint: optimisticMessage.language_hint,
        mentions,
        attachments,
      });
      if (saved) {
        setMessages((prev) => mergeMessages(prev, [{ ...saved, delivery_state: 'sent' }]));
      }
      setOutgoingQueue((prev) => queueOutgoingMessage(prev, {
        client_message_id: clientMessageId,
        delivery_state: 'sent',
      }));
      setStatus('');
    } catch (err) {
      setMessages((prev) => mergeMessages(prev, [{
        ...optimisticMessage,
        delivery_state: 'failed',
        error_message: err.message,
      }]));
      setOutgoingQueue((prev) => queueOutgoingMessage(prev, {
        client_message_id: clientMessageId,
        delivery_state: 'failed',
        error_message: err.message,
      }));
      setStatus(`Send failed: ${err.message}`);
    }
  }, [composerText, currentUserId, event?.id, languageHint, pendingAttachments, sendEventMessageRecord, staffProfiles]);

  const handleRetry = useCallback(async (message) => {
    await handleSendMessage({
      id: message.id,
      clientMessageId: message.client_message_id,
      bodyText: message.body_text,
      attachments: message.attachments || [],
      languageHint: message.language_hint || languageHint,
    }, true);
  }, [handleSendMessage, languageHint]);

  const handleToggleReaction = useCallback(async (message, emoji) => {
    if (!message?.id || !emoji) return;
    try {
      const response = await toggleEventMessageReaction(message.id, emoji);
      setMessages((prev) => prev.map((row) => (
        row.id === message.id
          ? {
            ...row,
            reactions: response.reactions || [],
            reaction_summary: response.reaction_summary || summarizeMessageReactions(response.reactions || [], currentUserId),
          }
          : row
      )));
    } catch (err) {
      setStatus(`Reaction failed: ${err.message}`);
    }
  }, [currentUserId, toggleEventMessageReaction]);

  const handleTranslate = useCallback(async (message) => {
    if (!message?.id || !message.body_text) return;
    setTranslationsByMessage((prev) => ({
      ...prev,
      [message.id]: { loading: true, error: '', language: translationTarget, text: prev[message.id]?.text || '' },
    }));
    try {
      const response = await translateEventMessage(message.id, translationTarget);
      setTranslationsByMessage((prev) => ({
        ...prev,
        [message.id]: {
          loading: false,
          error: '',
          language: response?.targetLanguage || translationTarget,
          text: response?.translation || '',
        },
      }));
    } catch (err) {
      setTranslationsByMessage((prev) => ({
        ...prev,
        [message.id]: {
          loading: false,
          error: err.message,
          language: translationTarget,
          text: '',
        },
      }));
    }
  }, [translateEventMessage, translationTarget]);

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    const SpeechCtor = getSpeechRecognitionCtor();
    if (!SpeechCtor) {
      setVoiceError('Voice transcription is unavailable in this browser. Paste transcript manually.');
      return;
    }

    const recognition = new SpeechCtor();
    recognition.lang = languageHint === 'es' ? 'es-US' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setVoiceError('');

    recognition.onresult = (eventResult) => {
      const transcript = Array.from(eventResult.results || [])
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      setComposerText((prev) => `${prev}${prev ? ' ' : ''}${transcript}`.trim());
      composerRef.current?.focus?.();
    };
    recognition.onerror = (eventError) => {
      setVoiceError(eventError?.error || 'Voice transcription failed.');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    setIsListening(true);
    recognition.start();
  }, [isListening, languageHint]);

  return (
    <section className={`border border-gray-200 rounded-xl p-4 bg-white ${conversation.show_mode_enabled ? 'text-[15px]' : 'text-sm'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg m-0">Event Messaging</h3>
          <p className="text-xs text-gray-500 m-0 mt-1">During-show, texting-style coordination with mentions, reactions, and retries.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={conversation.show_mode_enabled}
              onChange={(e) => handleSaveConversation({ show_mode_enabled: e.target.checked })}
            />
            Show Mode
          </label>
          <label className="inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={conversation.mute_non_critical}
              onChange={(e) => handleSaveConversation({ mute_non_critical: e.target.checked })}
            />
            Mute Non-Critical
          </label>
        </div>
      </div>

      <div className="mt-3 grid md:grid-cols-2 gap-2">
        <textarea
          rows={2}
          value={conversation.pinned_ops_commands || ''}
          onChange={(e) => setConversation((prev) => ({ ...prev, pinned_ops_commands: e.target.value }))}
          className="px-3 py-2 border border-gray-200 rounded text-xs"
          placeholder="Pinned ops command (e.g., If urgent: @StageManager and call 210-555-0101)."
          aria-label="Pinned ops commands"
        />
        <div className="flex items-start md:items-center justify-start md:justify-end gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => handleSaveConversation()} disabled={savingConversation}>
            Save Pinned Commands
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={loadMessages} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {conversation.pinned_ops_commands && (
        <div className="mt-2 p-2 bg-[#f9f6ef] border border-[#e7dbc2] rounded text-xs">
          <strong>Pinned Ops Command:</strong> {conversation.pinned_ops_commands}
        </div>
      )}

      <div className="mt-3 grid md:grid-cols-4 gap-2 text-xs">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
          className="px-2 py-1.5 border border-gray-200 rounded"
          placeholder="Search conversation"
          aria-label="Search conversation"
        />
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={filters.attachmentsOnly} onChange={(e) => setFilters((prev) => ({ ...prev, attachmentsOnly: e.target.checked }))} />Attachments</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={filters.mentionsOnly} onChange={(e) => setFilters((prev) => ({ ...prev, mentionsOnly: e.target.checked }))} />Mentions</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={filters.systemOnly} onChange={(e) => setFilters((prev) => ({ ...prev, systemOnly: e.target.checked }))} />System</label>
      </div>

      <div className={`mt-3 border border-gray-200 rounded-lg p-2 overflow-y-auto ${conversation.show_mode_enabled ? 'max-h-[520px]' : 'max-h-[360px]'}`}>
        {loading && <p className="text-xs text-gray-500 m-1">Loading messages…</p>}
        {!loading && !visibleMessages.length && <p className="text-xs text-gray-500 m-1">No messages yet. Send the first one and I will keep the thread synced.</p>}
        {visibleMessages.map((message) => {
          const isMine = currentUserId && message.author_user_id === currentUserId;
          const translated = translationsByMessage[message.id];
          const reactions = Array.isArray(message.reaction_summary)
            ? message.reaction_summary
            : summarizeMessageReactions(message.reactions || [], currentUserId);
          const mentionHighlight = isMentionForUser(message, currentUserId);
          return (
            <article
              key={message.id || message.client_message_id}
              className={`mb-2 p-2 rounded border ${mentionHighlight ? 'border-[#c8a45e] bg-[#fff9eb]' : 'border-gray-100 bg-gray-50'} ${isMine ? 'ml-6' : 'mr-6'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-xs">{message.author_name || (isMine ? 'You' : 'Team')}</strong>
                <span className="text-[11px] text-gray-500">{toDisplayTime(message.created_at)}</span>
              </div>
              <div className="text-sm mt-1 break-words">{renderMessageBody(message.body_text)}</div>
              {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {message.attachments.map((attachment, index) => (
                    <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline">
                      {attachment.name || 'Attachment'}
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {DEFAULT_REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={`${message.id}-${emoji}`}
                    type="button"
                    className="px-1.5 py-0.5 border border-gray-200 rounded text-xs bg-white"
                    onClick={() => handleToggleReaction(message, emoji)}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                {reactions.map((reaction) => (
                  <button
                    key={`${message.id}-${reaction.emoji}-count`}
                    type="button"
                    className="px-1.5 py-0.5 border border-gray-300 rounded text-xs bg-white"
                    onClick={() => handleToggleReaction(message, reaction.emoji)}
                  >
                    {reaction.emoji} {reaction.count}
                  </button>
                ))}
                <button type="button" className="text-xs underline ml-2" onClick={() => handleTranslate(message)}>Translate</button>
                {message.delivery_state === 'failed' && (
                  <button type="button" className="text-xs underline text-red-600" onClick={() => handleRetry(message)}>
                    Retry send
                  </button>
                )}
              </div>
              {translated?.loading && <p className="text-[11px] text-gray-500 m-0 mt-1">Translating…</p>}
              {translated?.error && <p className="text-[11px] text-red-600 m-0 mt-1">{translated.error}</p>}
              {translated?.text && (
                <p className="text-[12px] text-gray-700 m-0 mt-1">
                  <strong>{translated.language?.toUpperCase()}:</strong> {translated.text}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {SMART_REPLY_CHIPS.map((chip) => (
          <button key={chip} type="button" className="text-xs px-2 py-1 border border-gray-200 rounded bg-white" onClick={() => setComposerText(chip)}>
            {chip}
          </button>
        ))}
        {OPS_SHORTCUT_CHIPS.map((chip) => (
          <button key={chip} type="button" className="text-xs px-2 py-1 border border-gray-200 rounded bg-white" onClick={() => setComposerText(chip)}>
            {chip}
          </button>
        ))}
        {ROLE_MENTION_KEYS.map((role) => (
          <button key={role} type="button" className="text-xs px-2 py-1 border border-gray-200 rounded bg-white" onClick={() => setComposerText((prev) => `${prev}${prev ? ' ' : ''}@${role}`)}>
            @{role}
          </button>
        ))}
      </div>

      <div className="mt-3 grid md:grid-cols-[1fr_auto_auto] gap-2">
        <textarea
          ref={composerRef}
          rows={conversation.show_mode_enabled ? 4 : 3}
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
          placeholder="Type a message… Use @name or @role"
          aria-label="Message composer"
        />
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-600">Language</label>
          <select value={languageHint} onChange={(e) => setLanguageHint(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label className="text-xs text-gray-600">Translate to</label>
          <select value={translationTarget} onChange={(e) => setTranslationTarget(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
            {LANGUAGE_OPTIONS.map((option) => <option key={`translate-${option.value}`} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={handleVoiceToggle}>
            {isListening ? 'Stop Voice' : 'Voice to Text'}
          </button>
          <label className="btn-secondary text-xs text-center cursor-pointer">
            Attach
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*,application/pdf,.txt,.doc,.docx"
              capture="environment"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length) handleUploadAttachments(files);
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" className="btn-primary text-xs" onClick={() => handleSendMessage()} disabled={uploadingAttachments}>
            Send
          </button>
        </div>
      </div>

      {pendingAttachments.length > 0 && (
        <div className="mt-2 p-2 border border-gray-200 rounded text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>Pending attachments</strong>
            <button type="button" className="underline" onClick={() => setPendingAttachments([])}>Clear</button>
          </div>
          <ul className="m-0 mt-1 pl-5">
            {pendingAttachments.map((attachment, index) => (
              <li key={`${attachment.url}-${index}`}>{attachment.name || 'Attachment'}</li>
            ))}
          </ul>
        </div>
      )}

      {(status || voiceError || queueSummary.sending || queueSummary.failed || uploadingAttachments) && (
        <p className="text-xs mt-2 mb-0 text-gray-600">
          {uploadingAttachments ? 'Uploading attachments… ' : ''}
          {queueSummary.sending ? `Sending: ${queueSummary.sending}. ` : ''}
          {queueSummary.failed ? `Needs attention: ${queueSummary.failed}. Tap retry on any unsent message. ` : ''}
          {voiceError || status}
        </p>
      )}
    </section>
  );
}
