import { parseLocalDate } from '../lib/dateUtils';
import { useState, useEffect } from 'react';
import { useVenue } from '../context/VenueContext';

export default function PodcastStudio() {
  const { events } = useVenue();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sourceDocument, setSourceDocument] = useState('');
  const [generatingDocument, setGeneratingDocument] = useState(false);
  const [uploadedAudio, setUploadedAudio] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [publishingToYoutube, setPublishingToYoutube] = useState(false);
  const [youtubeResult, setYoutubeResult] = useState(null);
  const [activeStep, setActiveStep] = useState(1);

  // Auto-select first event if available
  useEffect(() => {
    if (events.length > 0 && !selectedEvent) {
      setSelectedEvent(events[0]);
    }
  }, [events, selectedEvent]);

  const generateSourceDocument = async () => {
    if (!selectedEvent) return;
    
    setGeneratingDocument(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'podcast-source',
          event: selectedEvent,
          venue: selectedEvent.venue,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSourceDocument(data.sourceDocument);
        setActiveStep(2);
      } else {
        alert('Failed to generate source document: ' + data.error);
      }
    } catch (error) {
      alert('Error generating document: ' + error.message);
    } finally {
      setGeneratingDocument(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sourceDocument);
    alert('Source document copied to clipboard!');
  };

  const openNotebookLM = () => {
    window.open('https://notebooklm.google.com', '_blank');
  };

  const handleAudioUpload = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'audio/mpeg' || file.type === 'audio/wav' || file.type === 'audio/mp3')) {
      setAudioFile(file);
      const audioUrl = URL.createObjectURL(file);
      setUploadedAudio(audioUrl);
      setActiveStep(3);
    } else {
      alert('Please upload a valid audio file (MP3 or WAV)');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'audio/mpeg' || file.type === 'audio/wav' || file.type === 'audio/mp3')) {
      setAudioFile(file);
      const audioUrl = URL.createObjectURL(file);
      setUploadedAudio(audioUrl);
      setActiveStep(3);
    } else {
      alert('Please upload a valid audio file (MP3 or WAV)');
    }
  };

  const publishToYoutube = async () => {
    if (!audioFile || !selectedEvent) return;

    setPublishingToYoutube(true);
    try {
      // Convert file to base64
      const arrayBuffer = await audioFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const title = `${selectedEvent.title} — Event Preview | Good Creative Media Presents`;
      const description = buildYouTubeDescription(selectedEvent);

      const response = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          title,
          description,
          tags: ['San Antonio', 'SATX', 'Good Creative Media', selectedEvent.genre || 'Live Music'],
          categoryId: '22', // People & Blogs (suitable for podcasts)
          audioBase64: base64,
        }),
      });

      const data = await response.json();
      setYoutubeResult(data);
      if (data.success) {
        setActiveStep(4);
      }
    } catch (error) {
      setYoutubeResult({ success: false, error: error.message });
    } finally {
      setPublishingToYoutube(false);
    }
  };

  const buildYouTubeDescription = (event) => {
    const eventDate = parseLocalDate(event.date).toLocaleDateString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });
    
    let desc = `🎙️ Good Creative Media Presents: ${event.title}\n\n`;
    desc += `An AI-generated event preview podcast for ${event.title} at ${event.venue} in San Antonio, TX.\n\n`;
    desc += `📅 ${eventDate} at ${event.time || '7:00 PM'}\n`;
    desc += `📍 ${event.venue} — ${event.venueAddress || 'San Antonio, TX'}\n`;
    desc += `🎵 ${event.genre || 'Live Entertainment'}\n`;
    if (event.ticketLink) desc += `🎟️ Tickets: ${event.ticketLink}\n`;
    desc += `\n---\n\n`;
    desc += `Produced by Good Creative Media\n`;
    desc += `goodcreativemedia.com\n`;
    desc += `thisisthegoodlife@juliegood.com\n\n`;
    desc += `#SanAntonio #SATX #LiveMusic #${(event.genre || 'Entertainment').replace(/[^a-zA-Z0-9]/g, '')} #GoodCreativeMedia`;
    
    return desc;
  };

  const shareEpisode = (platform) => {
    if (!youtubeResult?.videoUrl) return;
    
    const url = youtubeResult.videoUrl;
    const text = `Check out this AI-generated podcast preview for ${selectedEvent.title}!`;
    
    switch (platform) {
      case 'copy':
        navigator.clipboard.writeText(url);
        alert('Episode link copied to clipboard!');
        break;
      case 'embed':
        const embedCode = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeResult.videoId}" frameborder="0" allowfullscreen></iframe>`;
        navigator.clipboard.writeText(embedCode);
        alert('Embed code copied to clipboard!');
        break;
      default:
        window.open(`${platform}?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0d1b2a] mb-2" style={{ fontFamily: 'Playfair Display' }}>
          🎙️ Podcast Studio
        </h1>
        <p className="text-gray-600 text-lg">
          Create NotebookLM Audio Overview podcasts with a semi-automated workflow
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 p-4 bg-gray-50 rounded-lg">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              activeStep >= step ? 'bg-[#c8a45e] text-[#0d1b2a]' : 'bg-gray-300 text-gray-600'
            }`}>
              {step}
            </div>
            <span className={`ml-2 text-sm ${activeStep >= step ? 'text-[#0d1b2a] font-semibold' : 'text-gray-500'}`}>
              {step === 1 && 'Source Document'}
              {step === 2 && 'Upload Audio'}
              {step === 3 && 'Publish YouTube'}
              {step === 4 && 'Distribution'}
            </span>
            {step < 4 && <div className="mx-4 w-8 h-0.5 bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Generate Source Document */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-[#0d1b2a] mb-4">
          Step 1 — Generate Source Document
        </h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Event
          </label>
          <select 
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c8a45e] focus:border-transparent"
            value={selectedEvent?.id || ''}
            onChange={(e) => {
              const event = events.find(ev => ev.id === e.target.value);
              setSelectedEvent(event);
              setSourceDocument('');
              setActiveStep(1);
            }}
          >
            <option value="">Choose an event...</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} - {parseLocalDate(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-[#0d1b2a] mb-2">Selected Event</h3>
            <p><strong>Title:</strong> {selectedEvent.title}</p>
            <p><strong>Date:</strong> {parseLocalDate(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}</p>
            <p><strong>Venue:</strong> {selectedEvent.venue}</p>
            <p><strong>Genre:</strong> {selectedEvent.genre}</p>
          </div>
        )}

        <button
          onClick={generateSourceDocument}
          disabled={!selectedEvent || generatingDocument}
          className="w-full bg-[#c8a45e] text-[#0d1b2a] font-semibold py-3 px-6 rounded-lg hover:bg-opacity-90 transition-colors disabled:bg-gray-300 disabled:text-gray-500 mb-4"
        >
          {generatingDocument ? 'Generating Document...' : 'Generate Source Document'}
        </button>

        {sourceDocument && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
              <h3 className="font-semibold text-[#0d1b2a] mb-2">Generated Source Document</h3>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                {sourceDocument}
              </pre>
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyToClipboard}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={openNotebookLM}
                className="flex-1 bg-[#0d1b2a] text-white font-medium py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Open NotebookLM
              </button>
            </div>
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <strong>Next steps:</strong> Copy this document, open NotebookLM, create a new notebook, paste the content, 
              and generate an Audio Overview. Then download the MP3 and upload it below.
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Upload Audio */}
      <div className={`bg-white border border-gray-200 rounded-lg p-6 mb-6 ${activeStep < 2 ? 'opacity-50' : ''}`}>
        <h2 className="text-xl font-semibold text-[#0d1b2a] mb-4">
          Step 2 — Upload Audio Overview
        </h2>
        
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#c8a45e] transition-colors"
        >
          <div className="mb-4">
            <span className="text-4xl">🎵</span>
          </div>
          <p className="text-gray-600 mb-4">
            Drag and drop your NotebookLM Audio Overview MP3/WAV here, or click to select
          </p>
          <input
            type="file"
            accept="audio/mp3,audio/wav,audio/mpeg"
            onChange={handleAudioUpload}
            className="hidden"
            id="audioUpload"
            disabled={activeStep < 2}
          />
          <label
            htmlFor="audioUpload"
            className="inline-block bg-[#c8a45e] text-[#0d1b2a] font-medium py-2 px-6 rounded-lg cursor-pointer hover:bg-opacity-90 transition-colors"
          >
            Choose Audio File
          </label>
        </div>

        {uploadedAudio && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-[#0d1b2a] mb-2">Audio Preview</h3>
            <audio controls className="w-full">
              <source src={uploadedAudio} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
            <p className="text-sm text-gray-600 mt-2">
              File: {audioFile?.name} ({(audioFile?.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          </div>
        )}
      </div>

      {/* Step 3: Publish to YouTube */}
      <div className={`bg-white border border-gray-200 rounded-lg p-6 mb-6 ${activeStep < 3 ? 'opacity-50' : ''}`}>
        <h2 className="text-xl font-semibold text-[#0d1b2a] mb-4">
          Step 3 — Publish to YouTube Podcasts
        </h2>

        {selectedEvent && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-[#0d1b2a] mb-2">Episode Details</h3>
            <p><strong>Title:</strong> {selectedEvent.title} — Event Preview | Good Creative Media Presents</p>
            <p><strong>Description:</strong> AI-generated event preview podcast...</p>
            <p><strong>Tags:</strong> San Antonio, SATX, Good Creative Media, {selectedEvent.genre}</p>
          </div>
        )}

        <button
          onClick={publishToYoutube}
          disabled={!uploadedAudio || publishingToYoutube || activeStep < 3}
          className="w-full bg-red-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 mb-4"
        >
          {publishingToYoutube ? 'Publishing to YouTube...' : '🎬 Publish to YouTube'}
        </button>

        {youtubeResult && (
          <div className={`p-4 rounded-lg ${youtubeResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {youtubeResult.success ? (
              <div>
                <h3 className="font-semibold text-green-800 mb-2">✅ Published Successfully!</h3>
                <p className="text-green-700">
                  <a href={youtubeResult.videoUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    View on YouTube
                  </a>
                </p>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold text-red-800 mb-2">❌ Publishing Failed</h3>
                <p className="text-red-700">{youtubeResult.error}</p>
                {youtubeResult.setup && (
                  <div className="mt-2">
                    <p className="text-red-700 font-medium">Setup required:</p>
                    <ul className="text-sm text-red-600 ml-4 mt-1">
                      {youtubeResult.setup.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 4: Distribution */}
      <div className={`bg-white border border-gray-200 rounded-lg p-6 ${activeStep < 4 ? 'opacity-50' : ''}`}>
        <h2 className="text-xl font-semibold text-[#0d1b2a] mb-4">
          Step 4 — Distribution
        </h2>

        {youtubeResult?.success && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-[#0d1b2a] mb-2">Episode Published</h3>
              <p className="text-gray-700">
                <a 
                  href={youtubeResult.videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#c8a45e] underline font-medium"
                >
                  {youtubeResult.videoUrl}
                </a>
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#0d1b2a] mb-3">Quick Share</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => shareEpisode('copy')}
                  className="flex items-center justify-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  📋 Copy Link
                </button>
                <button
                  onClick={() => shareEpisode('embed')}
                  className="flex items-center justify-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  📺 Embed Code
                </button>
                <button
                  onClick={() => shareEpisode('https://twitter.com/intent/tweet')}
                  className="flex items-center justify-center gap-2 p-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  🐦 Twitter
                </button>
                <button
                  onClick={() => shareEpisode('https://www.facebook.com/sharer/sharer.php')}
                  className="flex items-center justify-center gap-2 p-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  📘 Facebook
                </button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">💡 Next Steps</h3>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Share the episode link in your email campaigns</li>
                <li>• Embed the player on your event webpage</li>
                <li>• Post to social media with custom messaging</li>
                <li>• Include in your press kit materials</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}