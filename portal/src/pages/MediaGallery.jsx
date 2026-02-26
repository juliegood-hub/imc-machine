import { parseLocalDate } from '../lib/dateUtils';
import { useState, useEffect } from 'react';
import { useVenue } from '../context/VenueContext';
import { useSearchParams } from 'react-router-dom';
import { getEventImages } from '../lib/supabase';
// Dynamic import for JSZip to avoid build issues

const PLATFORM_FORMATS = {
  'ig_post_square': 'Instagram Post (1080x1080)',
  'ig_story': 'Instagram Story (1080x1920)',
  'fb_post': 'Facebook Post (1200x630)',
  'fb_event_banner': 'Facebook Event Banner (1920x1080)',
  'fb_cover': 'Facebook Cover (1640x856)',
  'twitter_post': 'Twitter Post (1200x675)',
  'twitter_header': 'Twitter Header (1500x500)',
  'linkedin_post': 'LinkedIn Post (1200x627)',
  'linkedin_banner': 'LinkedIn Banner (1584x396)',
  'youtube_thumbnail': 'YouTube Thumbnail (1280x720)',
  'tiktok_post': 'TikTok Post (1080x1080)',
  'pinterest_pin': 'Pinterest Pin (1000x1500)',
  'poster_11x17': 'Poster 11x17 (1700x2200)',
  'poster_18x24': 'Poster 18x24 (2160x2880)',
  'flyer_letter': 'Flyer Letter Size (816x1056)',
  'postcard_4x6': 'Postcard 4x6 (480x720)',
  'banner_web': 'Web Banner (1200x300)',
  'email_header': 'Email Header (600x200)',
  'press_kit_image': 'Press Kit Image (1920x1080)',
  'event_program': 'Event Program (612x792)',
  'ticket_design': 'Ticket Design (300x150)',
  'merchandise': 'Merchandise Design (Various)',
};

export default function MediaGallery() {
  const { events } = useVenue();
  const [searchParams] = useSearchParams();
  const preselectedEventId = searchParams.get('eventId');
  
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [filter, setFilter] = useState('All');

  const selectedEvent = events.find(e => e.id === selectedEventId);

  useEffect(() => {
    if (selectedEventId) {
      loadImages();
    } else {
      setImages([]);
    }
  }, [selectedEventId]);

  const loadImages = async () => {
    if (!selectedEventId) return;
    
    setLoading(true);
    try {
      const eventImages = await getEventImages(selectedEventId);
      setImages(eventImages);
    } catch (err) {
      console.error('Failed to load images:', err);
      // Show demo data for development
      setImages([
        {
          id: '1',
          event_id: selectedEventId,
          format_key: 'ig_post_square',
          image_url: 'https://via.placeholder.com/1080x1080/c8a45e/ffffff?text=IG+Post',
          model_used: 'dalle-3',
          width: 1080,
          height: 1080,
          created_at: '2026-02-20T10:00:00Z'
        },
        {
          id: '2', 
          event_id: selectedEventId,
          format_key: 'fb_event_banner',
          image_url: 'https://via.placeholder.com/1920x1080/0d1b2a/c8a45e?text=FB+Banner',
          model_used: 'midjourney',
          width: 1920,
          height: 1080,
          created_at: '2026-02-20T10:15:00Z'
        },
        {
          id: '3',
          event_id: selectedEventId, 
          format_key: 'poster_11x17',
          image_url: 'https://via.placeholder.com/1700x2200/c8a45e/0d1b2a?text=Event+Poster',
          model_used: 'dalle-3',
          width: 1700,
          height: 2200,
          created_at: '2026-02-20T10:30:00Z'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatFilters = ['All', 'Social Media', 'Posters', 'Print', 'Web'];

  const getFormatCategory = (formatKey) => {
    if (['ig_post_square', 'ig_story', 'fb_post', 'fb_event_banner', 'twitter_post', 'linkedin_post', 'tiktok_post'].includes(formatKey)) {
      return 'Social Media';
    }
    if (['poster_11x17', 'poster_18x24'].includes(formatKey)) {
      return 'Posters';
    }
    if (['flyer_letter', 'postcard_4x6', 'event_program', 'ticket_design'].includes(formatKey)) {
      return 'Print';
    }
    if (['banner_web', 'email_header', 'youtube_thumbnail'].includes(formatKey)) {
      return 'Web';
    }
    return 'Other';
  };

  const filteredImages = images.filter(img => {
    if (filter === 'All') return true;
    return getFormatCategory(img.format_key) === filter;
  });

  const downloadImage = async (image) => {
    try {
      const response = await fetch(image.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedEvent?.title || 'event'}-${image.format_key}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('I hit a snag downloading that image: ' + err.message);
    }
  };

  const bulkDownload = async () => {
    if (filteredImages.length === 0) return;

    try {
      // Dynamic import JSZip to avoid build issues
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const eventName = selectedEvent?.title || 'event';
      
      // Add all filtered images to zip
      for (const image of filteredImages) {
        try {
          const response = await fetch(image.image_url);
          const blob = await response.blob();
          const filename = `${eventName}-${image.format_key}-${image.width}x${image.height}.jpg`;
          zip.file(filename, blob);
        } catch (err) {
          console.warn(`Failed to add ${image.format_key} to zip:`, err);
        }
      }

      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${eventName}-media-gallery.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Bulk download failed:', err);
      alert('I hit a snag downloading the ZIP: ' + err.message);
    }
  };

  const regenerateImage = async (image) => {
    if (!confirm(`Regenerate ${PLATFORM_FORMATS[image.format_key] || image.format_key}?\n\nThis will create a new version of the image.`)) {
      return;
    }

    alert(`I queued regeneration for ${PLATFORM_FORMATS[image.format_key] || image.format_key}. This flow is being wired to IMC Composer next.`);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl">🖼️ Media Gallery</h1>
        <div className="flex gap-3">
          {filteredImages.length > 0 && (
            <button onClick={bulkDownload} className="btn-secondary text-sm">
              📦 Download All ({filteredImages.length})
            </button>
          )}
        </div>
      </div>
      <p className="text-gray-500 mb-6">All generated images for your events, organized by platform format.</p>

      {/* Event Selection */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
        <select 
          value={selectedEventId} 
          onChange={e => setSelectedEventId(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
        >
          <option value="">Choose an event...</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>
              {e.title} · {parseLocalDate(e.date).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <>
          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {formatFilters.map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm border transition-colors cursor-pointer ${
                  filter === f
                    ? 'bg-[#c8a45e] text-white border-[#c8a45e]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#c8a45e]'
                }`}
              >
                {f} {f === 'All' ? `(${images.length})` : `(${images.filter(img => getFormatCategory(img.format_key) === f).length})`}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🎨</div>
              <p>Loading generated images...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎨</div>
              <h3 className="text-xl mb-2">No generated images yet</h3>
              <p className="text-gray-500 mb-4">
                Generate images for this event using the IMC Composer to see them here.
              </p>
              <button 
                onClick={() => window.location.href = `/imc-composer?eventId=${selectedEventId}`}
                className="btn-primary"
              >
                🚀 Generate Images
              </button>
            </div>
          ) : (
            /* Image Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredImages.map(image => (
                <div key={image.id} className="card p-0 overflow-hidden hover:shadow-lg transition-shadow group">
                  {/* Image Preview */}
                  <div 
                    className="h-48 bg-gray-100 cursor-pointer relative overflow-hidden"
                    onClick={() => setPreview(image)}
                  >
                    <img 
                      src={image.image_url} 
                      alt={PLATFORM_FORMATS[image.format_key] || image.format_key}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium transition-opacity">
                        👁️ Preview
                      </span>
                    </div>
                  </div>

                  {/* Image Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-sm mb-1 truncate">
                      {PLATFORM_FORMATS[image.format_key] || image.format_key}
                    </h3>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span>{image.width}×{image.height}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Model:</span>
                        <span className="capitalize">{image.model_used || 'AI'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{new Date(image.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <button 
                        onClick={() => downloadImage(image)}
                        className="flex-1 px-3 py-1.5 bg-[#c8a45e] text-white text-xs rounded hover:bg-[#b8945e] transition-colors"
                      >
                        📥 Download
                      </button>
                      <button 
                        onClick={() => regenerateImage(image)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 transition-colors"
                        title="Regenerate this image"
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">
                  {PLATFORM_FORMATS[preview.format_key] || preview.format_key}
                </h3>
                <p className="text-sm text-gray-500">
                  {preview.width}×{preview.height} • {preview.model_used || 'AI Generated'}
                </p>
              </div>
              <button 
                onClick={() => setPreview(null)} 
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Image */}
            <div className="p-4 max-h-[70vh] overflow-auto flex justify-center">
              <img 
                src={preview.image_url} 
                alt={PLATFORM_FORMATS[preview.format_key] || preview.format_key}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 border-t bg-gray-50 justify-end">
              <button 
                onClick={() => downloadImage(preview)}
                className="px-4 py-2 bg-[#c8a45e] text-white rounded hover:bg-[#b8945e] transition-colors"
              >
                📥 Download
              </button>
              <button 
                onClick={() => regenerateImage(preview)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                🔄 Regenerate
              </button>
              <button 
                onClick={() => setPreview(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
