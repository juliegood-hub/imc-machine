import { useMemo, useRef, useState } from 'react';
import { INTAKE_PROMPTS, buildIntakeQuestionDigest } from '../constants/intakePrompts';

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function normalizePromptKey(value = '') {
  const key = String(value || '').trim().toLowerCase();
  if (INTAKE_PROMPTS[key]) return key;
  return 'event';
}

function compileInputText(promptConfig, pasteText, answerText) {
  const digest = buildIntakeQuestionDigest(promptConfig);
  return [
    `PROMPT_TITLE: ${promptConfig.title || ''}`,
    `QUESTIONS:\n${digest}`,
    pasteText ? `PASTE_EXISTING:\n${pasteText}` : '',
    answerText ? `USER_ANSWERS:\n${answerText}` : '',
  ].filter(Boolean).join('\n\n');
}

export default function IntakePromptPanel({
  promptKey = 'event',
  formType = 'event',
  currentForm = {},
  onApply,
  titleOverride = '',
  className = '',
  defaultOpen = false,
}) {
  const resolvedPromptKey = normalizePromptKey(promptKey);
  const promptConfig = INTAKE_PROMPTS[resolvedPromptKey] || INTAKE_PROMPTS.event;
  const SpeechCtor = getSpeechRecognitionCtor();
  const supportsSpeech = !!SpeechCtor;
  const recognitionRef = useRef(null);

  const [open, setOpen] = useState(defaultOpen);
  const [pasteText, setPasteText] = useState('');
  const [answersText, setAnswersText] = useState('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState([]);
  const [missingFields, setMissingFields] = useState([]);

  const finalTitle = titleOverride || promptConfig.title;

  const canRun = useMemo(
    () => String(pasteText || '').trim().length > 0 || String(answersText || '').trim().length > 0,
    [pasteText, answersText]
  );

  const startListening = () => {
    if (!SpeechCtor || listening) return;
    setError('');
    const recognition = new SpeechCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalText += `${transcript} `;
      }
      if (finalText.trim()) {
        setAnswersText((prev) => `${prev}${prev ? '\n' : ''}${finalText}`.trim());
      }
    };
    recognition.onerror = (event) => {
      setError(`Voice input hit a snag: ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const runAutoFill = async () => {
    if (!canRun) {
      setError('Give me your notes first, then I will auto-fill the form.');
      return;
    }
    setLoading(true);
    setStatus('');
    setError('');
    setNeedsConfirm([]);
    setMissingFields([]);

    try {
      const payloadText = compileInputText(promptConfig, pasteText, answersText);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'form-assist',
          formType,
          inputText: payloadText,
          currentForm,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'AI assist did not complete.');

      const fields = data.fields || {};
      const keys = Object.keys(fields);
      if (keys.length === 0) {
        setStatus('I did not find enough high-confidence fields yet. Add a little more detail and run it again.');
        return;
      }

      if (typeof onApply === 'function') onApply(fields);

      const fieldMeta = data.fieldMeta || {};
      const uncertainRows = keys
        .map((key) => ({
          field: key,
          confidence: Number(fieldMeta?.[key]?.confidence ?? 0.7),
          evidence: fieldMeta?.[key]?.evidence || fieldMeta?.[key]?.sourceSnippet || '',
        }))
        .filter((row) => row.confidence < 0.75);
      setNeedsConfirm(uncertainRows);
      setMissingFields(Array.isArray(data.missingFields) ? data.missingFields : []);
      setStatus(`Applied ${keys.length} field suggestion${keys.length === 1 ? '' : 's'} to your form.`);
    } catch (err) {
      setError(err.message || 'AI assist hit a snag.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`card mb-6 border border-[#c8a45e] bg-[#faf8f3] ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base md:text-lg mb-1 m-0">{finalTitle}</h3>
          <div className="text-xs text-gray-600 space-y-1">
            {(promptConfig.intro || []).map((line, index) => (
              <p key={`intro-${index}`} className="m-0">{line}</p>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? 'Hide Questions' : 'Answer These Questions'}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="border border-gray-200 rounded-lg p-3 bg-white">
            <p className="text-xs font-semibold text-gray-700 m-0 mb-2">{promptConfig.pasteLabel || 'Paste anything you already have'}</p>
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white resize-y"
              placeholder={promptConfig.pastePlaceholder || 'Paste source text here...'}
            />
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-gray-700 m-0">{promptConfig.answerLabel || 'Your answers'}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs disabled:opacity-50"
                  onClick={startListening}
                  disabled={!supportsSpeech || listening}
                >
                  {listening ? 'Listening…' : 'Record voice answer'}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs disabled:opacity-50"
                  onClick={stopListening}
                  disabled={!listening}
                >
                  Stop
                </button>
              </div>
            </div>
            <textarea
              rows={6}
              value={answersText}
              onChange={(e) => setAnswersText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white resize-y"
              placeholder={promptConfig.answerPlaceholder || 'Answer here...'}
            />
            {promptConfig.examplePlaceholder ? (
              <p className="text-[11px] text-gray-500 m-0 mt-1">{promptConfig.examplePlaceholder}</p>
            ) : null}
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-white">
            <p className="text-xs font-semibold text-gray-700 m-0 mb-2">Question set</p>
            <div className="space-y-2">
              {(promptConfig.sections || []).map((section) => (
                <div key={section.heading}>
                  <p className="text-xs font-semibold text-gray-700 m-0">{section.heading}</p>
                  <ul className="m-0 mt-1 pl-4 text-xs text-gray-600 space-y-1">
                    {(section.questions || []).map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {promptConfig.finalLine ? (
              <p className="text-xs text-[#8c6d2f] mt-2 mb-0">{promptConfig.finalLine}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-50"
              onClick={runAutoFill}
              disabled={loading || !canRun}
            >
              {loading ? 'Auto-filling...' : 'Use this to auto-fill my form'}
            </button>
          </div>

          {status ? <p className="text-xs text-gray-700 m-0">{status}</p> : null}
          {error ? <p className="text-xs text-red-700 m-0">{error}</p> : null}

          {needsConfirm.length > 0 ? (
            <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
              <p className="text-xs font-semibold text-amber-800 m-0 mb-1">Needs a quick confirm</p>
              <div className="space-y-1">
                {needsConfirm.map((row) => (
                  <p key={`confirm-${row.field}`} className="text-xs text-amber-900 m-0">
                    {row.field}: {Math.round(row.confidence * 100)}% confidence
                    {row.evidence ? ` · ${row.evidence}` : ''}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {missingFields.length > 0 ? (
            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
              <p className="text-xs font-semibold text-blue-900 m-0 mb-1">Still needed for completion</p>
              <div className="space-y-1">
                {missingFields.map((item, index) => (
                  <p key={`missing-${item.fieldKey || item.field_key || index}`} className="text-xs text-blue-900 m-0">
                    {(item.question || item.fieldKey || item.field_key || 'Add one more field').trim()}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
