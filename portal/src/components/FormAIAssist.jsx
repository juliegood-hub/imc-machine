import { useRef, useState } from 'react';
import { openCamera, openFileUpload } from '../services/photo-to-form';

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

function truncate(text, limit = 1200) {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function buildVisionPrompt(formType) {
  return `You are an OCR and visual extraction engine. Analyze the uploaded image and return JSON only.

Target form type: ${formType}

Extract:
{
  "rawText": "all readable text verbatim",
  "entities": {
    "names": ["people, businesses, venues, artists, authors, publishers"],
    "emails": ["email addresses"],
    "phones": ["phone numbers"],
    "urls": ["websites, social links, ticket links"],
    "addresses": ["mailing addresses"],
    "dates": ["event or publication dates"],
    "times": ["times"],
    "prices": ["ticket prices or costs"],
    "isbn": ["ISBN values if present on books or back covers"],
    "titles": ["event titles, book titles, artwork titles"],
    "organizations": ["publishers, schools, galleries, collectives, sponsors"]
  },
  "event": {
    "title": "",
    "date": "",
    "time": "",
    "venue": "",
    "description": "",
    "genre": "",
    "ticketLink": "",
    "ticketPrice": ""
  },
  "profile": {
    "personName": "",
    "organizationName": "",
    "bio": "",
    "role": ""
  },
  "artwork": {
    "description": "visual description of artwork if shown (painting, pottery, sculpture, etc.)",
    "medium": "",
    "style": "",
    "subject": ""
  },
  "confidence": 0.0
}

Rules:
- OCR first: prioritize exact text extraction.
- If this is a flyer/poster/one-sheet, extract all event and contact details.
- If this is a book cover/back, extract title, author, ISBN, publisher, and blurb details.
- If this is artwork with little text, provide strong visual description and inferred medium/style.
- Return valid JSON only.`;
}

function buildVisionContext(results) {
  return results.map((r, idx) => {
    const rawText = truncate(r.rawText || '');
    const entities = r.entities || {};
    const event = r.event || {};
    const profile = r.profile || {};
    const artwork = r.artwork || {};
    return [
      `IMAGE ${idx + 1}:`,
      rawText ? `OCR_TEXT:\n${rawText}` : '',
      `EXTRACTED_ENTITIES:\n${JSON.stringify(entities)}`,
      `EVENT_HINTS:\n${JSON.stringify(event)}`,
      `PROFILE_HINTS:\n${JSON.stringify(profile)}`,
      `ARTWORK_HINTS:\n${JSON.stringify(artwork)}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

export default function FormAIAssist({
  formType,
  currentForm,
  onApply,
  title = 'AI Form Assistant',
  description = 'Speak or type what should be filled, then apply AI suggestions.',
}) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState([]);
  const [notes, setNotes] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [extractingImages, setExtractingImages] = useState(false);
  const recognitionRef = useRef(null);

  const SpeechCtor = getSpeechRecognitionCtor();
  const supportsSpeech = !!SpeechCtor;

  const startListening = () => {
    if (!SpeechCtor || listening) return;
    setError('');

    const recognition = new SpeechCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalText += transcript + ' ';
        else interimText += transcript;
      }
      if (finalText) {
        setInputText(prev => `${prev}${prev ? '\n' : ''}${finalText}`.trim());
      }
      if (interimText) {
        setNotes(`Listening: ${interimText}`);
      }
    };

    recognition.onerror = (event) => {
      setError(`Voice input error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setNotes(prev => (prev.startsWith('Listening:') ? '' : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    if (notes.startsWith('Listening:')) setNotes('');
  };

  const addCameraPhoto = async () => {
    setError('');
    try {
      const file = await openCamera();
      setImageFiles(prev => [...prev, file].slice(0, 6));
    } catch {}
  };

  const addUploads = async () => {
    setError('');
    try {
      const files = await openFileUpload(true);
      const imageOnly = (files || []).filter(f => (f.type || '').startsWith('image/'));
      if (!imageOnly.length) {
        setError('Only image files are supported for AI photo extraction.');
        return;
      }
      setImageFiles(prev => [...prev, ...imageOnly].slice(0, 6));
    } catch {}
  };

  const clearPhotos = () => {
    setImageFiles([]);
  };

  const extractImageContext = async () => {
    if (!imageFiles.length) return '';
    setExtractingImages(true);
    const outputs = [];
    const failures = [];

    for (const file of imageFiles) {
      try {
        const imageData = await fileToBase64(file);
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'extract-photo',
            imageData,
            mimeType: file.type || 'image/jpeg',
            extractionPrompt: buildVisionPrompt(formType),
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Vision extraction failed');
        outputs.push(data.extracted || {});
      } catch (err) {
        failures.push(`${file.name}: ${err.message}`);
      }
    }

    setExtractingImages(false);

    if (failures.length) {
      setNotes(`Analyzed ${outputs.length}/${imageFiles.length} images. Some failed: ${failures.join(' | ')}`);
    } else if (outputs.length) {
      setNotes(`Analyzed ${outputs.length} image${outputs.length !== 1 ? 's' : ''} and extracted OCR/visual data.`);
    }

    if (!outputs.length) return '';
    return buildVisionContext(outputs);
  };

  const runAssist = async () => {
    if (!inputText.trim() && !imageFiles.length) {
      setError('Add voice/text input or upload photos first.');
      return;
    }
    setLoading(true);
    setError('');
    if (!notes.startsWith('Listening:')) setNotes('');
    setMissing([]);

    try {
      const visionContext = await extractImageContext();
      const finalInput = [
        inputText.trim(),
        visionContext ? `PHOTO_EXTRACTION_CONTEXT:\n${visionContext}` : '',
      ].filter(Boolean).join('\n\n');

      if (!finalInput.trim()) {
        throw new Error('No usable input found after photo extraction.');
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'form-assist',
          formType,
          inputText: finalInput,
          currentForm,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'AI form assist failed');

      const fields = data.fields || {};
      if (!Object.keys(fields).length) {
        setNotes('No confident fields found. Try giving more specific details.');
      } else {
        onApply(fields);
        setNotes(data.notes || `Applied ${Object.keys(fields).length} AI field suggestions to your form.`);
      }

      setMissing(data.missing || []);
      setModelUsed(data.modelUsed || '');
    } catch (err) {
      setError(err.message || 'AI form assist failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-6 border border-[#c8a45e] bg-[#faf8f3]">
      <h3 className="text-lg mb-1">🎙 {title}</h3>
      <p className="text-xs text-gray-500 m-0 mb-3">{description}</p>

      <textarea
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        rows={5}
        placeholder="Example: I'm Julie Good, owner of Blue Heron Ceramics Studio. We're in San Antonio at 1207 S St Mary's St..."
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] resize-y bg-white"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={addCameraPhoto}
          className="btn-secondary text-sm"
        >
          📷 Add Photo
        </button>
        <button
          type="button"
          onClick={addUploads}
          className="btn-secondary text-sm"
        >
          🖼 Upload Images
        </button>
        <button
          type="button"
          onClick={clearPhotos}
          disabled={!imageFiles.length}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          🧹 Clear Photos
        </button>
        <button
          type="button"
          onClick={startListening}
          disabled={!supportsSpeech || listening}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          🎤 Start Voice
        </button>
        <button
          type="button"
          onClick={stopListening}
          disabled={!listening}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          ⏹ Stop Voice
        </button>
        <button
          type="button"
          onClick={runAssist}
          disabled={loading || extractingImages}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {loading || extractingImages ? '⏳ Applying...' : '✨ Fill Form with AI'}
        </button>
      </div>

      {imageFiles.length > 0 && (
        <p className="text-xs text-gray-500 mt-2 m-0">
          Photos queued: {imageFiles.length} ({imageFiles.map(f => f.name).join(', ')})
        </p>
      )}

      {!supportsSpeech && (
        <p className="text-xs text-amber-700 mt-2 m-0">Voice input is not supported in this browser; text input still works.</p>
      )}
      {error && <p className="text-xs text-red-600 mt-2 m-0">{error}</p>}
      {notes && <p className="text-xs text-gray-600 mt-2 m-0">{notes}</p>}
      {missing.length > 0 && (
        <p className="text-xs text-gray-500 mt-2 m-0">Still needed: {missing.join(', ')}</p>
      )}
      {modelUsed && (
        <p className="text-[10px] text-gray-400 mt-2 m-0">Model: {modelUsed}</p>
      )}
    </div>
  );
}
