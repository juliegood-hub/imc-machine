import { parseLocalDate } from '../lib/dateUtils';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { getEventImages } from '../lib/supabase';
import { generatePressPageHTML } from '../services/press-page';

export default function PressPagePreview() {
  const { id } = useParams();
  const { events, venue } = useVenue();
  const [selectedEventId, setSelectedEventId] = useState(id || '');
  const [previewHtml, setPreviewHtml] = useState('');
  const [images, setImages] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [shareableLink, setShareableLink] = useState('');

  const selectedEvent = events.find(e => e.id === selectedEventId);

  useEffect(() => {
    if (selectedEventId) {
      loadEventImages();
    }
  }, [selectedEventId]);

  const loadEventImages = async () => {
    if (!selectedEventId) return;
    
    try {
      const eventImages = await getEventImages(selectedEventId);
      setImages(eventImages);
    } catch (err) {
      console.error('Failed to load images:', err);
      // Use demo images for development
      setImages([
        {
          id: '1',
          image_url: 'https://via.placeholder.com/1200x630/c8a45e/ffffff?text=Event+Banner',
          format_key: 'fb_event_banner',
          width: 1200,
          height: 630
        },
        {
          id: '2',
          image_url: 'https://via.placeholder.com/1080x1080/0d1b2a/c8a45e?text=Square+Post',
          format_key: 'ig_post_square',
          width: 1080,
          height: 1080
        }
      ]);
    }
  };

  const handleGenerate = async () => {
    if (!selectedEvent) return;

    setGenerating(true);
    try {
      // Prepare high-res images for press use
      const pressImages = images
        .filter(img => ['fb_event_banner', 'poster_11x17', 'poster_18x24', 'press_kit_image'].includes(img.format_key))
        .map(img => ({
          url: img.image_url,
          format: img.format_key,
          dimensions: `${img.width}×${img.height}`,
        }));

      // Prepare event research data (mock for now)
      const research = {
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedEvent.venue || '') + ' ' + (selectedEvent.venueAddress || '') + ' San Antonio TX')}`,
        venue: {
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedEvent.venue || '') + ' San Antonio TX')}`,
        }
      };

      // Prepare mock content (would come from generated_content table in real implementation)
      const content = {
        pressRelease: selectedEvent.description || `${selectedEvent.title} is an exciting ${selectedEvent.genre || 'music'} event taking place at ${selectedEvent.venue || 'the venue'} on ${parseLocalDate(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.\n\nJoin us for an unforgettable evening of ${selectedEvent.genre || 'entertainment'} featuring incredible performers and an amazing atmosphere. This is an event you won't want to miss!\n\nFor tickets and more information, visit our event page.`,
        pressReleaseSpanish: `${selectedEvent.title} es un emocionante evento de ${selectedEvent.genre || 'música'} que tendrá lugar en ${selectedEvent.venue || 'el lugar'} el ${parseLocalDate(selectedEvent.date).toLocaleDateString('es-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.\n\nÚnete a nosotros para una noche inolvidable de ${selectedEvent.genre || 'entretenimiento'} con artistas increíbles y un ambiente fantástico. ¡Este es un evento que no querrás perderte!\n\nPara boletos y más información, visita nuestra página del evento.`,
      };

      // Mock campaign data
      const campaign = null;

      const html = generatePressPageHTML(selectedEvent, venue, content, research, pressImages, campaign);
      setPreviewHtml(html);

      // Generate a mock shareable link (in real implementation, this would upload to hosting)
      const mockId = Date.now().toString(36);
      setShareableLink(`https://imcmachine.vercel.app/press/${mockId}`);

    } catch (err) {
      console.error('Failed to generate press page:', err);
      alert('Failed to generate press page: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!previewHtml) return;
    
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `press-page-${selectedEvent?.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'event'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyShareableLink = async () => {
    if (!shareableLink) return;
    
    try {
      await navigator.clipboard.writeText(shareableLink);
      alert('Shareable link copied to clipboard!');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareableLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Shareable link copied to clipboard!');
    }
  };

  const handlePrint = () => {
    if (!previewHtml) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(previewHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl mb-1">📰 Press Page Generator</h1>
          <p className="text-gray-500 m-0">
            Auto-generated event press kit page with bilingual content, images, and venue details
          </p>
        </div>
      </div>

      {/* Event Selection & Controls */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Event Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
            <select 
              value={selectedEventId} 
              onChange={e => { 
                setSelectedEventId(e.target.value); 
                setPreviewHtml(''); 
                setShareableLink(''); 
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
            >
              <option value="">Choose an event...</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title} · {parseLocalDate(e.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-col justify-end">
            <div className="flex gap-3 flex-wrap">
              <button 
                onClick={handleGenerate} 
                disabled={!selectedEvent || generating}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {generating ? '⏳ Generating...' : '✨ Generate Press Page'}
              </button>
              
              {previewHtml && (
                <>
                  <button 
                    onClick={handleDownload} 
                    className="btn-secondary text-sm"
                    title="Download HTML file"
                  >
                    ⬇️ Download
                  </button>
                  <button 
                    onClick={handlePrint} 
                    className="btn-secondary text-sm"
                    title="Print or save as PDF"
                  >
                    🖨️ Print/PDF
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Shareable Link */}
        {shareableLink && (
          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">Shareable Link</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={shareableLink}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
              />
              <button 
                onClick={copyShareableLink}
                className="px-4 py-2 bg-[#c8a45e] text-white text-sm rounded-lg hover:bg-[#b8945e] transition-colors"
              >
                📋 Copy
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Share this link with media contacts, sponsors, and stakeholders
            </p>
          </div>
        )}
      </div>

      {/* Event Details Preview */}
      {selectedEvent && (
        <div className="card mb-6">
          <h3 className="text-lg mb-4">Event Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <div>
                <span className="text-gray-500 block mb-1">Event</span>
                <span className="font-medium">{selectedEvent.title}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Date & Time</span>
                <span className="font-medium">
                  {parseLocalDate(selectedEvent.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                  {selectedEvent.time && (
                    <span> at {new Date(`1970-01-01T${selectedEvent.time}`).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit' 
                    })}</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Venue</span>
                <span className="font-medium">
                  {selectedEvent.venue || '—'}
                  {selectedEvent.venueAddress && (
                    <span className="block text-gray-600">{selectedEvent.venueAddress}</span>
                  )}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-gray-500 block mb-1">Genre</span>
                <span className="font-medium">{selectedEvent.genre || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Tickets</span>
                {selectedEvent.ticketLink ? (
                  <a 
                    href={selectedEvent.ticketLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#c8a45e] hover:underline font-medium"
                  >
                    Available →
                  </a>
                ) : (
                  <span className="font-medium">—</span>
                )}
                {selectedEvent.ticketPrice && (
                  <span className="block text-gray-600">{selectedEvent.ticketPrice}</span>
                )}
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Available Images</span>
                <span className="font-medium">{images.length} generated images</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Images Preview */}
      {selectedEvent && images.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg mb-4">Press Kit Images ({images.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.slice(0, 8).map(image => (
              <div key={image.id} className="bg-gray-100 rounded-lg overflow-hidden">
                <img 
                  src={image.image_url} 
                  alt={image.format_key}
                  className="w-full h-24 object-cover"
                />
                <div className="p-2">
                  <p className="text-xs font-medium truncate">
                    {image.format_key?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Image'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {image.width}×{image.height}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {images.length > 8 && (
            <p className="text-sm text-gray-500 mt-3">
              +{images.length - 8} more images will be included in the press page
            </p>
          )}
        </div>
      )}

      {/* Press Page Preview */}
      {previewHtml ? (
        <div className="card p-0 overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Press Page Preview</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setPreviewHtml('')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ✕ Close Preview
              </button>
            </div>
          </div>
          <div style={{ height: '80vh' }} className="overflow-hidden">
            <iframe 
              srcDoc={previewHtml} 
              className="w-full h-full border-0" 
              title="Press Page Preview"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>
      ) : selectedEvent && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📰</div>
          <h3 className="text-xl mb-2">Ready to Generate Press Page</h3>
          <p className="text-gray-500 mb-6">
            Click "Generate Press Page" to create a professional press kit page for{' '}
            <span className="font-medium">{selectedEvent.title}</span>
          </p>
          <div className="text-sm text-gray-400 space-y-1">
            <p>Press page will include:</p>
            <ul className="inline-block text-left space-y-1">
              <li>• Event details and description</li>
              <li>• High-resolution images</li>
              <li>• Venue information with map</li>
              <li>• Contact information</li>
              <li>• Social media links</li>
              <li>• Bilingual content (English + Spanish)</li>
            </ul>
          </div>
        </div>
      )}

      {!selectedEvent && !selectedEventId && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl mb-2">Select an Event</h3>
          <p className="text-gray-500">
            Choose an event from the dropdown above to generate its press page
          </p>
        </div>
      )}
    </div>
  );
}