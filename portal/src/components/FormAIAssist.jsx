import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { openCamera, openFileUpload } from '../services/photo-to-form';

const INPUT_TABS = [
  { key: 'speak', label: 'Speak' },
  { key: 'paste', label: 'Paste' },
  { key: 'upload', label: 'Upload' },
];

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const base64 = value.includes(',') ? value.split(',')[1] : value;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function truncate(text, limit = 1400) {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildVisionPrompt(formType, mimeType = '') {
  const isPdf = String(mimeType).toLowerCase().includes('pdf');
  const typeHint = isPdf ? 'PDF document' : 'image';
  return `You are an OCR and structured data extraction engine.

Target form type: ${formType}
Source type: ${typeHint}

Return valid JSON only:
{
  "rawText": "all readable text",
  "entities": {
    "names": [],
    "emails": [],
    "phones": [],
    "urls": [],
    "addresses": [],
    "dates": [],
    "times": [],
    "prices": [],
    "isbn": [],
    "titles": [],
    "organizations": []
  },
  "event": {
    "title": "",
    "date": "",
    "time": "",
    "venue": "",
    "description": "",
    "ticketLink": ""
  },
  "profile": {
    "personName": "",
    "organizationName": "",
    "role": "",
    "bio": ""
  },
  "supplier": {
    "supplierName": "",
    "websiteUrl": "",
    "email": "",
    "phone": "",
    "address": ""
  },
  "confidence": 0.0
}

Rules:
- Prioritize OCR fidelity first, inferred structure second.
- Preserve contact and logistics details exactly when present.
- For scanned PDFs, extract text from all visible sections you can read.
- Return JSON only, no markdown.`;
}

function buildUploadContext(results = []) {
  return results.map((item, index) => {
    const extracted = item?.extracted || {};
    const rawText = truncate(extracted.rawText || extracted.raw_text || '');
    return [
      `UPLOAD ${index + 1}: ${item.fileName || 'file'}`,
      rawText ? `OCR_TEXT:\n${rawText}` : '',
      `ENTITIES:\n${JSON.stringify(extracted.entities || {})}`,
      `EVENT_HINTS:\n${JSON.stringify(extracted.event || {})}`,
      `PROFILE_HINTS:\n${JSON.stringify(extracted.profile || {})}`,
      `SUPPLIER_HINTS:\n${JSON.stringify(extracted.supplier || {})}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function mapMissingFields(missing = []) {
  if (!Array.isArray(missing)) return [];
  return missing.map((item) => {
    if (typeof item === 'string') {
      return {
        fieldKey: item,
        question: `Give me ${item} and I will plug it in.`,
        whyNeeded: 'I need this field before this section is complete.',
      };
    }
    return {
      fieldKey: item.field_key || item.fieldKey || '',
      question: item.question || `Give me ${item.field_key || item.fieldKey || 'this field'} and I will plug it in.`,
      whyNeeded: item.why_needed || item.whyNeeded || 'I need this field before this section is complete.',
    };
  }).filter((item) => item.fieldKey);
}

function normalizeActionType(tabKey, files = []) {
  if (tabKey === 'speak') return 'voice';
  if (tabKey === 'upload') {
    const hasPdf = files.some((file) => String(file?.type || '').includes('pdf'));
    return hasPdf ? 'upload_pdf' : 'upload_image';
  }
  return 'paste';
}

export default function FormAIAssist({
  formType,
  currentForm,
  onApply,
  onRelatedActions,
  title = 'AI Assist',
  description = 'Speak, paste, or upload. I will draft the field updates, and you approve before anything applies.',
  sourceContext = '',
  entityType = '',
  entityId = '',
  defaultOpen = false,
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState('paste');
  const [inputText, setInputText] = useState('');
  const [files, setFiles] = useState([]);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const [missingFields, setMissingFields] = useState([]);
  const [inferredEntities, setInferredEntities] = useState({
    contacts: [],
    venues: [],
    acts: [],
    bookings: [],
    suppliers: [],
  });
  const [suggestedActions, setSuggestedActions] = useState([]);
  const [selectedSuggestedActions, setSelectedSuggestedActions] = useState({});
  const [proposals, setProposals] = useState([]);
  const [taskStatus, setTaskStatus] = useState('');
  const recognitionRef = useRef(null);

  const SpeechCtor = getSpeechRecognitionCtor();
  const supportsSpeech = !!SpeechCtor;

  const selectedProposalCount = useMemo(
    () => proposals.filter((item) => item.selected).length,
    [proposals]
  );

  const startListening = () => {
    if (!SpeechCtor || listening) return;
    setError('');
    setActiveTab('speak');

    const recognition = new SpeechCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalText += `${transcript} `;
        else interimText += transcript;
      }
      if (finalText) {
        setInputText((prev) => `${prev}${prev ? '\n' : ''}${finalText}`.trim());
      }
      if (interimText) {
        setNotes(`Listening: ${interimText}`);
      }
    };

    recognition.onerror = (event) => {
      setError(`Voice input hit a snag: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setNotes((prev) => (prev.startsWith('Listening:') ? '' : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setNotes((prev) => (prev.startsWith('Listening:') ? '' : prev));
  };

  const addCameraPhoto = async () => {
    setError('');
    try {
      const file = await openCamera();
      setFiles((prev) => [...prev, file].slice(0, 8));
      setActiveTab('upload');
    } catch {
      // user cancelled camera capture
    }
  };

  const addUploads = async () => {
    setError('');
    try {
      const uploaded = await openFileUpload(true);
      const accepted = (uploaded || []).filter((file) => {
        const type = String(file?.type || '').toLowerCase();
        return type.startsWith('image/') || type.includes('pdf');
      });
      if (!accepted.length) {
        setError('Upload images or PDFs and I will extract what I can.');
        return;
      }
      setFiles((prev) => [...prev, ...accepted].slice(0, 8));
      setActiveTab('upload');
    } catch {
      // user cancelled upload
    }
  };

  const clearUploads = () => {
    setFiles([]);
  };

  const extractUploadContext = async () => {
    if (!files.length) return '';
    setExtracting(true);
    const outputs = [];
    const failures = [];

    for (const file of files) {
      try {
        const fileData = await fileToBase64(file);
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'extract-upload',
            fileData,
            mimeType: file.type || 'image/jpeg',
            extractionPrompt: buildVisionPrompt(formType, file.type || 'image/jpeg'),
          }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Upload extraction did not complete.');
        outputs.push({
          fileName: file.name,
          mimeType: file.type,
          extracted: data.extracted || {},
        });
      } catch (err) {
        failures.push(`${file.name}: ${err.message}`);
      }
    }

    setExtracting(false);

    if (failures.length) {
      setNotes(`I processed ${outputs.length}/${files.length} upload(s). These need another try: ${failures.join(' | ')}`);
    } else if (outputs.length) {
      setNotes(`I processed ${outputs.length} upload${outputs.length === 1 ? '' : 's'} for OCR and extraction.`);
    }

    if (!outputs.length) return '';
    return buildUploadContext(outputs);
  };

  const runAssist = async () => {
    if (!inputText.trim() && !files.length) {
      setError('Give me something to work with first: voice, pasted text, or an upload.');
      return;
    }
    setLoading(true);
    setError('');
    setTaskStatus('');
    setProposals([]);
    setMissingFields([]);
    setSuggestedActions([]);

    try {
      const uploadContext = await extractUploadContext();
      const finalInput = [
        inputText.trim(),
        uploadContext ? `UPLOAD_EXTRACTION_CONTEXT:\n${uploadContext}` : '',
      ].filter(Boolean).join('\n\n');

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'form-assist',
          formType,
          inputText: finalInput,
          currentForm,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'AI assist did not finish this round.');

      const nextFields = data.fields || {};
      const fieldMeta = data.fieldMeta || {};
      const rows = Object.entries(nextFields).map(([field, suggestedValue]) => {
        const currentValue = currentForm?.[field];
        const meta = fieldMeta[field] || {};
        return {
          field,
          currentValue,
          suggestedValue,
          confidence: Number(meta.confidence || 0.7),
          evidence: meta.evidence || meta.sourceSnippet || '',
          selected: true,
        };
      });

      setProposals(rows);
      setMissingFields(mapMissingFields(data.missingFields || data.missing || []));
      setInferredEntities(data.inferredEntities || {
        contacts: [],
        venues: [],
        acts: [],
        bookings: [],
        suppliers: [],
      });

      const actions = Array.isArray(data.suggestedNextActions) ? data.suggestedNextActions : [];
      setSuggestedActions(actions);
      setSelectedSuggestedActions(actions.reduce((acc, item, idx) => {
        acc[idx] = false;
        return acc;
      }, {}));

      setNotes(data.notes || (rows.length ? 'Review the proposed changes, then apply what looks right.' : 'I did not find enough high-confidence fields yet.'));
      setModelUsed(data.modelUsed || '');
    } catch (err) {
      setError(err.message || 'AI assist hit a snag.');
    } finally {
      setLoading(false);
    }
  };

  const toggleProposal = (field) => {
    setProposals((prev) => prev.map((row) => (
      row.field === field ? { ...row, selected: !row.selected } : row
    )));
  };

  const setAllProposals = (selected) => {
    setProposals((prev) => prev.map((row) => ({ ...row, selected })));
  };

  const applySelectedToForm = async () => {
    const selectedRows = proposals.filter((row) => row.selected);
    if (!selectedRows.length) {
      setTaskStatus('Select at least one proposed change and I will apply it.');
      return;
    }
    const patch = selectedRows.reduce((acc, row) => {
      acc[row.field] = row.suggestedValue;
      return acc;
    }, {});
    onApply(patch);

    try {
      await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log-ai-assist-run',
          userId: user?.id,
          formType,
          sourceType: normalizeActionType(activeTab, files),
          sourceContext,
          fieldsApplied: Object.keys(patch),
          proposedCount: proposals.length,
          appliedCount: Object.keys(patch).length,
          metadata: {
            entityType,
            entityId,
            inferredEntityCounts: {
              contacts: inferredEntities.contacts?.length || 0,
              venues: inferredEntities.venues?.length || 0,
              acts: inferredEntities.acts?.length || 0,
              bookings: inferredEntities.bookings?.length || 0,
              suppliers: inferredEntities.suppliers?.length || 0,
            },
          },
        }),
      });
    } catch {
      // non-blocking audit log
    }

    const selectedActions = suggestedActions.filter((_action, idx) => selectedSuggestedActions[idx]);
    if (selectedActions.length && typeof onRelatedActions === 'function') {
      onRelatedActions(selectedActions);
    }

    setTaskStatus(`Done. I applied ${Object.keys(patch).length} field suggestion${Object.keys(patch).length === 1 ? '' : 's'} to the form.`);
  };

  const createCompletionTask = async () => {
    if (!missingFields.length) {
      setTaskStatus('Nothing is missing right now, so there is no completion task to create.');
      return;
    }
    if (!user?.id) {
      setTaskStatus('Sign in first, then I can create completion tasks.');
      return;
    }

    try {
      const response = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-completion-task',
          userId: user.id,
          task: {
            entityType: entityType || formType,
            entityId: entityId || currentForm?.id || '',
            title: `Complete ${title}`,
            missingFields: missingFields.map((item) => item.fieldKey),
            sourceType: normalizeActionType(activeTab, files),
            sourceContext: sourceContext || formType,
          },
        }),
      });
      const data = await response.json();
      if (!data.success || !data.task) throw new Error(data.error || 'I could not create that completion task yet.');
      setTaskStatus('Perfect. I created the completion task and it will show in your dashboard reminders.');
    } catch (err) {
      setTaskStatus(`I could not create that completion task yet: ${err.message}`);
    }
  };

  const sendReminderNow = async () => {
    if (!user?.id) {
      setTaskStatus('Sign in first, then I can send reminders.');
      return;
    }
    try {
      const response = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-completion-reminders',
          userId: user.id,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Reminder send did not complete.');
      setTaskStatus(`Reminder run is done: ${data.sent || 0}/${data.total || 0} sent.`);
    } catch (err) {
      setTaskStatus(`Reminder run hit a snag: ${err.message}`);
    }
  };

  return (
    <div className="card mb-6 border border-[#c8a45e] bg-[#faf8f3]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base md:text-lg mb-1 m-0">{title}</h3>
          <p className="text-xs text-gray-500 m-0">{description}</p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? 'Hide Panel' : 'Open AI Assist'}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {INPUT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`text-xs px-3 py-1.5 rounded border ${activeTab === tab.key ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]' : 'bg-white border-gray-200 text-gray-700'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'paste' && (
            <div className="mt-3">
              <p className="text-[11px] text-gray-500 m-0 mb-1">Paste an email, notes, copy, or chat transcript and I will parse it.</p>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white resize-y"
                placeholder="Paste source content here..."
              />
            </div>
          )}

          {activeTab === 'speak' && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-gray-500 m-0">Speak naturally. I will append the transcript to the input box.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startListening}
                  disabled={!supportsSpeech || listening}
                  className="btn-secondary text-xs disabled:opacity-50"
                >
                  Start Listening
                </button>
                <button
                  type="button"
                  onClick={stopListening}
                  disabled={!listening}
                  className="btn-secondary text-xs disabled:opacity-50"
                >
                  Stop Listening
                </button>
              </div>
              {!supportsSpeech && (
                <p className="text-xs text-amber-700 m-0">This browser does not support voice recognition. Use Paste or Upload and we are still good.</p>
              )}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white resize-y"
                placeholder="Voice transcript will appear here..."
              />
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-gray-500 m-0">Upload flyer/poster images or PDFs. I will OCR and extract the useful details.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={addCameraPhoto}>Take Photo</button>
                <button type="button" className="btn-secondary text-xs" onClick={addUploads}>Upload Image/PDF</button>
                <button type="button" className="btn-secondary text-xs" onClick={clearUploads} disabled={!files.length}>Clear Files</button>
              </div>
              {files.length > 0 ? (
                <p className="text-xs text-gray-600 m-0">Queued: {files.map((file) => file.name).join(', ')}</p>
              ) : (
                <p className="text-xs text-gray-500 m-0">No files queued yet. Upload one and I will extract what I can.</p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-50"
              onClick={runAssist}
              disabled={loading || extracting}
            >
              {loading || extracting ? 'Working on it...' : 'Analyze & Draft Fields'}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm disabled:opacity-50"
              onClick={applySelectedToForm}
              disabled={!proposals.length || selectedProposalCount === 0}
            >
              Apply Selected Changes
            </button>
            {proposals.length > 0 && (
              <>
                <button type="button" className="btn-secondary text-xs" onClick={() => setAllProposals(true)}>Select All</button>
                <button type="button" className="btn-secondary text-xs" onClick={() => setAllProposals(false)}>Clear Selection</button>
              </>
            )}
          </div>

          {error && <p className="text-xs text-red-600 mt-2 m-0">{error}</p>}
          {notes && <p className="text-xs text-gray-600 mt-2 m-0">{notes}</p>}
          {modelUsed && <p className="text-[10px] text-gray-400 mt-2 m-0">Model: {modelUsed}</p>}

          {proposals.length > 0 && (
            <div className="mt-3 border border-gray-200 rounded bg-white p-3">
              <p className="text-xs font-semibold text-gray-700 m-0 mb-2">Proposed changes (you approve what applies)</p>
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {proposals.map((row) => (
                  <label key={row.field} className="block border border-gray-100 rounded p-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleProposal(row.field)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold m-0">{row.field}</p>
                        <p className="text-[11px] text-gray-500 m-0">Current: {formatValue(row.currentValue) || '—'}</p>
                        <p className="text-[11px] text-gray-700 m-0">Suggested: {formatValue(row.suggestedValue)}</p>
                        <p className="text-[10px] text-gray-500 m-0">Confidence: {Math.round((row.confidence || 0) * 100)}%</p>
                        {row.evidence ? <p className="text-[10px] text-gray-500 m-0">Evidence: {row.evidence}</p> : null}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {(inferredEntities.contacts?.length || inferredEntities.venues?.length || inferredEntities.acts?.length || inferredEntities.bookings?.length || inferredEntities.suppliers?.length) ? (
            <div className="mt-3 border border-gray-200 rounded bg-white p-3">
              <p className="text-xs font-semibold text-gray-700 m-0 mb-2">Related items I spotted</p>
              <div className="text-[11px] text-gray-700 space-y-1">
                {inferredEntities.contacts?.length ? <p className="m-0">Contacts: {inferredEntities.contacts.length}</p> : null}
                {inferredEntities.venues?.length ? <p className="m-0">Venues: {inferredEntities.venues.length}</p> : null}
                {inferredEntities.acts?.length ? <p className="m-0">Acts: {inferredEntities.acts.length}</p> : null}
                {inferredEntities.bookings?.length ? <p className="m-0">Bookings/Events: {inferredEntities.bookings.length}</p> : null}
                {inferredEntities.suppliers?.length ? <p className="m-0">Suppliers: {inferredEntities.suppliers.length}</p> : null}
              </div>
            </div>
          ) : null}

          {suggestedActions.length > 0 && (
            <div className="mt-3 border border-gray-200 rounded bg-white p-3">
              <p className="text-xs font-semibold text-gray-700 m-0 mb-2">Suggested next moves</p>
              <div className="space-y-1">
                {suggestedActions.map((action, idx) => (
                  <label key={`${action.action_type}-${idx}`} className="text-[11px] inline-flex items-center gap-2 w-full">
                    <input
                      type="checkbox"
                      checked={!!selectedSuggestedActions[idx]}
                      onChange={() => setSelectedSuggestedActions((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    />
                    <span>{action.label || action.action_type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {missingFields.length > 0 && (
            <div className="mt-3 border border-amber-200 rounded bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 m-0 mb-2">Still needed</p>
              <div className="space-y-1 text-[11px] text-amber-800">
                {missingFields.map((item) => (
                  <p key={item.fieldKey} className="m-0">
                    {item.fieldKey}: {item.question}
                  </p>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={createCompletionTask}>Create Follow-Up Task</button>
                <button type="button" className="btn-secondary text-xs" onClick={sendReminderNow}>Send Friendly Reminder</button>
              </div>
            </div>
          )}

          {taskStatus && <p className="text-xs text-gray-600 mt-2 m-0">{taskStatus}</p>}
        </>
      )}
    </div>
  );
}
