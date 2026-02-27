import { useEffect, useRef, useState } from 'react';

const DEFAULT_STYLE_OPTIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'feature', label: 'Feature' },
  { value: 'punchy', label: 'Punchy' },
];

const DEFAULT_STYLE_HELP = {
  clean: 'Clean keeps the copy direct and factual.',
  feature: 'Feature adds story and atmosphere while staying accurate.',
  punchy: 'Punchy keeps the same facts with tighter, high-energy phrasing.',
};

export default function DeepResearchPromptBox({
  title = 'Deep Research Draft',
  subtitle = 'I will research the names, context, and venue details, then draft copy you can edit before saving.',
  styleValue = 'feature',
  onStyleChange,
  defaultStyleLabel = '',
  showUseDefaultButton = false,
  onUseDefaultStyle,
  styleOptions = DEFAULT_STYLE_OPTIONS,
  styleHelp = DEFAULT_STYLE_HELP,
  correctionValue = '',
  onCorrectionChange,
  correctionLabel = 'Corrections or specifics',
  correctionPlaceholder = 'Type corrections, spelling fixes, or details you want included, then regenerate.',
  includeTermsValue = '',
  onIncludeTermsChange,
  includeTermsLabel = 'Use these words or phrases',
  includeTermsPlaceholder = 'Example: family-friendly, residency, first Friday, all-ages',
  avoidTermsValue = '',
  onAvoidTermsChange,
  avoidTermsLabel = 'Avoid these words or phrases',
  avoidTermsPlaceholder = 'Example: underground, rave, explicit, political',
  enableVoiceToText = true,
  onGenerate,
  onRegenerate,
  generating = false,
  canGenerate = true,
  statusText = '',
  metaText = '',
  className = '',
}) {
  const [voiceError, setVoiceError] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const correctionValueRef = useRef(String(correctionValue || ''));

  useEffect(() => {
    correctionValueRef.current = String(correctionValue || '');
  }, [correctionValue]);

  useEffect(() => {
    if (!enableVoiceToText) return undefined;
    if (typeof window === 'undefined') return undefined;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return undefined;
    }

    setVoiceSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      const base = correctionValueRef.current.trim();
      onCorrectionChange?.(`${base}${base ? ' ' : ''}${transcript}`.trim());
      setVoiceError('');
    };

    recognition.onerror = (event) => {
      const code = String(event?.error || '').trim();
      if (!code || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setVoiceError('Microphone permission is blocked. Enable mic access and try again.');
      } else {
        setVoiceError('Voice transcription failed. You can still type your guidance below.');
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {
        // no-op on teardown
      }
      recognitionRef.current = null;
    };
  }, [enableVoiceToText, onCorrectionChange]);

  const canRun = !!canGenerate && !generating;
  const hasGuidance = !!String(correctionValue || '').trim()
    || !!String(includeTermsValue || '').trim()
    || !!String(avoidTermsValue || '').trim();
  const canRegenerate = canRun && hasGuidance;

  const buildPayload = () => ({
    correctionPrompt: String(correctionValue || '').trim(),
    includeTerms: String(includeTermsValue || '').trim(),
    avoidTerms: String(avoidTermsValue || '').trim(),
  });

  const handleToggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceError('Voice transcription is unavailable in this browser.');
      return;
    }
    setVoiceError('');
    if (listening) {
      try {
        recognition.stop();
      } catch {
        // ignore stop errors
      }
      return;
    }
    try {
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setVoiceError('Voice transcription could not start. Try again.');
    }
  };

  return (
    <div className={`mt-2 p-3 rounded-lg bg-gray-50 border border-gray-100 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-700 m-0">{title}</p>
          <p className="text-[11px] text-gray-500 mt-1 mb-0">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">
            Style
            {defaultStyleLabel ? ` · default ${defaultStyleLabel}` : ''}
          </span>
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
            {styleOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStyleChange?.(opt.value)}
                className={`text-[11px] px-2.5 py-1 rounded ${styleValue === opt.value
                  ? 'bg-[#0d1b2a] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {showUseDefaultButton && (
            <button
              type="button"
              onClick={() => onUseDefaultStyle?.()}
              className="text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
            >
              Use Genre Default
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-[11px] text-gray-500 m-0"><strong>Clean:</strong> {styleHelp.clean || DEFAULT_STYLE_HELP.clean}</p>
        <p className="text-[11px] text-gray-500 m-0"><strong>Feature:</strong> {styleHelp.feature || DEFAULT_STYLE_HELP.feature}</p>
        <p className="text-[11px] text-gray-500 m-0"><strong>Punchy:</strong> {styleHelp.punchy || DEFAULT_STYLE_HELP.punchy}</p>
      </div>

      <div className="mt-3">
        <label className="block text-xs font-medium text-gray-700 mb-1">{correctionLabel}</label>
        <textarea
          value={correctionValue}
          onChange={(e) => onCorrectionChange?.(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#c8a45e] resize-y"
          placeholder={correctionPlaceholder}
        />
      </div>

      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1">{includeTermsLabel}</label>
          <input
            type="text"
            value={includeTermsValue}
            onChange={(e) => onIncludeTermsChange?.(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#c8a45e]"
            placeholder={includeTermsPlaceholder}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1">{avoidTermsLabel}</label>
          <input
            type="text"
            value={avoidTermsValue}
            onChange={(e) => onAvoidTermsChange?.(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#c8a45e]"
            placeholder={avoidTermsPlaceholder}
          />
        </div>
      </div>

      {enableVoiceToText && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleListening}
            disabled={!voiceSupported}
            className={`text-xs px-3 py-1.5 rounded border ${voiceSupported
              ? (listening
                ? 'bg-[#0d1b2a] text-white border-[#0d1b2a]'
                : 'bg-white text-[#0d1b2a] border-gray-300 hover:bg-gray-100')
              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
          >
            {listening ? 'Stop Voice Input' : 'Voice to Text Guidance'}
          </button>
          <span className="text-[11px] text-gray-500">
            {voiceSupported
              ? 'Speak corrections and I will add them to your guidance.'
              : 'Voice input not available in this browser.'}
          </span>
        </div>
      )}

      {voiceError && (
        <p className="text-[11px] text-amber-700 mt-2 mb-0">{voiceError}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onGenerate?.(buildPayload())}
          disabled={!canRun}
          className={`text-xs px-3 py-1.5 rounded border ${canRun
            ? 'bg-white text-[#0d1b2a] border-[#c8a45e] hover:bg-[#faf8f3]'
            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
          }`}
        >
          {generating ? 'Researching…' : 'Research + Draft'}
        </button>
        <button
          type="button"
          onClick={() => onRegenerate?.(buildPayload())}
          disabled={!canRegenerate}
          className={`text-xs px-3 py-1.5 rounded border ${canRegenerate
            ? 'bg-white text-[#0d1b2a] border-[#0d1b2a] hover:bg-gray-100'
            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
          }`}
        >
          {generating ? 'Working…' : 'Regenerate with Corrections'}
        </button>
      </div>

      {statusText && (
        <p className="text-xs text-gray-500 mt-2 mb-0">{statusText}</p>
      )}
      {metaText && (
        <p className="text-[11px] text-gray-400 mt-1 mb-0">{metaText}</p>
      )}
    </div>
  );
}
