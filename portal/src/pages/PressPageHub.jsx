import { parseLocalDate } from '../lib/dateUtils';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { getEventImages, getEventCampaigns, supabase } from '../lib/supabase';
import { generatePressPageHTML } from '../services/press-page';

function triggerDataUrlDownload(url = '', fileName = 'report.pdf') {
  if (!url) return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function mapCampaignRows(rows = []) {
  const byChannel = {};
  for (const row of rows || []) {
    if (row?.channel) byChannel[row.channel] = row;
  }
  return byChannel;
}

function getEventVenuePayload(selectedEvent, venue) {
  if (!selectedEvent) return venue || {};
  return {
    ...(venue || {}),
    name: selectedEvent.venue || venue?.name || '',
    address: selectedEvent.venueAddress || venue?.address || '',
    city: selectedEvent.venueCity || venue?.city || 'San Antonio',
    state: selectedEvent.venueState || venue?.state || 'TX',
    website: selectedEvent.venueWebsite || venue?.website || '',
  };
}

function buildPressPageContent(selectedEvent, generated = {}) {
  const fallbackPress = selectedEvent?.description
    || `${selectedEvent?.title || 'This event'} is happening on ${selectedEvent?.date || 'TBD'} at ${selectedEvent?.venue || 'the venue'}.`;

  return {
    press: generated.press || fallbackPress,
    bilingual: generated.bilingual || '',
    social: generated.social || '',
    calendar: generated.calendar || '',
    email: generated.email || '',
    sms: generated.sms || '',
  };
}

export default function PressPageHub() {
  const { id } = useParams();
  const { events, venue } = useVenue();
  const [selectedEventId, setSelectedEventId] = useState(id && id !== 'new' ? id : '');
  const [previewHtml, setPreviewHtml] = useState('');
  const [images, setImages] = useState([]);
  const [generatedByType, setGeneratedByType] = useState({});
  const [campaignRows, setCampaignRows] = useState([]);
  const [loadingEventData, setLoadingEventData] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [pressPageRecord, setPressPageRecord] = useState(null);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  useEffect(() => {
    if (!selectedEventId || selectedEventId === 'new') {
      setImages([]);
      setGeneratedByType({});
      setCampaignRows([]);
      setPreviewHtml('');
      setShareableLink('');
      setPressPageRecord(null);
      return;
    }

    let cancelled = false;
    const loadEventData = async () => {
      setLoadingEventData(true);
      try {
        const [eventImages, generatedRes, campaigns] = await Promise.all([
          getEventImages(selectedEventId),
          supabase.from('generated_content').select('content_type, content').eq('event_id', selectedEventId),
          getEventCampaigns(selectedEventId),
        ]);

        if (cancelled) return;

        setImages(eventImages || []);

        const byType = {};
        (generatedRes?.data || []).forEach((row) => {
          byType[row.content_type] = row.content || '';
        });
        setGeneratedByType(byType);
        setCampaignRows(campaigns || []);

        const pressCampaign = (campaigns || []).find((row) => row.channel === 'press_page');
        if (pressCampaign?.external_url) {
          setShareableLink(pressCampaign.external_url);
        } else {
          setShareableLink('');
        }

        const existingHtml = pressCampaign?.metadata?.html;
        if (typeof existingHtml === 'string' && existingHtml.trim()) {
          setPreviewHtml(existingHtml);
          setPressPageRecord({
            slug: pressCampaign.external_id || '',
            shareUrl: pressCampaign.external_url || '',
            title: selectedEvent?.title || 'Press Page',
            html: existingHtml,
            event: pressCampaign?.metadata?.event || selectedEvent,
            venue: pressCampaign?.metadata?.venue || getEventVenuePayload(selectedEvent, venue),
            content: pressCampaign?.metadata?.content || buildPressPageContent(selectedEvent, byType),
            distribution: pressCampaign?.metadata?.distribution || mapCampaignRows(campaigns || []),
            distributionLines: pressCampaign?.metadata?.distribution_lines || [],
          });
        } else {
          setPreviewHtml('');
          setPressPageRecord(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load press page source data:', err);
          setImages([]);
          setGeneratedByType({});
          setCampaignRows([]);
          setPreviewHtml('');
          setPressPageRecord(null);
        }
      } finally {
        if (!cancelled) setLoadingEventData(false);
      }
    };

    loadEventData();
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, selectedEvent, venue]);

  const handleGenerate = async () => {
    if (!selectedEvent) return;

    setGenerating(true);
    try {
      const eventVenue = getEventVenuePayload(selectedEvent, venue);
      const campaignByChannel = mapCampaignRows(campaignRows);
      const content = buildPressPageContent(selectedEvent, generatedByType);

      const pressImages = images
        .filter((img) => ['fb_event_banner', 'poster_11x17', 'poster_18x24', 'press_kit_image'].includes(img.format_key))
        .map((img) => ({
          url: img.image_url,
          label: img.format_key?.replace(/_/g, ' ') || 'Image',
          format: img.format_key,
          dimensions: `${img.width}×${img.height}`,
        }));

      const research = {
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedEvent.venue || '') + ' ' + (selectedEvent.venueAddress || '') + ' San Antonio TX')}`,
        venue: {
          name: eventVenue?.name || selectedEvent.venue || '',
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedEvent.venue || '') + ' San Antonio TX')}`,
        },
      };

      const html = generatePressPageHTML(selectedEvent, eventVenue, content, research, pressImages, campaignByChannel);
      setPreviewHtml(html);

      const saveRes = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-press-page',
          event: selectedEvent,
          venue: eventVenue,
          content,
          research,
          images: pressImages,
          html,
          baseUrl: window.location.origin,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error || 'I could not save the press page yet.');

      const shareUrl = saveData.pressPage?.shareUrl || '';
      const slug = saveData.pressPage?.slug || '';
      setShareableLink(shareUrl);
      setPressPageRecord({
        ...(saveData.pressPage || {}),
        slug,
        shareUrl,
        title: selectedEvent.title,
        html,
        event: selectedEvent,
        venue: eventVenue,
        content,
        distribution: campaignByChannel,
      });
    } catch (err) {
      console.error('Failed to generate press page:', err);
      alert('I hit a snag generating that press page: ' + err.message);
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

  const handleDownloadPdf = async () => {
    if (!selectedEvent) return;
    if (!shareableLink) {
      alert('Generate the press page first so I can export the PDF with the live share link.');
      return;
    }

    setDownloadingPdf(true);
    try {
      const payload = {
        action: 'export-press-page-pdf',
        title: `${selectedEvent.title} Press Page`,
        event: pressPageRecord?.event || selectedEvent,
        venue: pressPageRecord?.venue || getEventVenuePayload(selectedEvent, venue),
        content: pressPageRecord?.content || buildPressPageContent(selectedEvent, generatedByType),
        shareUrl: shareableLink,
        distributionLines: pressPageRecord?.distributionLines || [],
      };

      if (pressPageRecord?.slug) payload.slug = pressPageRecord.slug;

      const res = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'PDF export did not complete.');
      triggerDataUrlDownload(data.downloadUrl, data.fileName || 'press-page.pdf');
    } catch (err) {
      alert('I hit a snag exporting PDF: ' + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const copyShareableLink = async () => {
    if (!shareableLink) return;

    try {
      await navigator.clipboard.writeText(shareableLink);
      alert('Shareable link copied.');
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shareableLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Shareable link copied.');
    }
  };

  const handleEmailPressPage = async () => {
    if (!selectedEvent) return;
    if (!shareableLink || !pressPageRecord?.slug) {
      alert('Generate the press page first so I can email the live link.');
      return;
    }

    setEmailing(true);
    try {
      const res = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'email-press-page',
          eventId: selectedEvent.id,
          slug: pressPageRecord.slug,
          title: selectedEvent.title,
          recipients: emailRecipients,
          note: emailNote,
          shareUrl: shareableLink,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Email send did not complete.');
      alert(`📧 Sent to ${data.sent} recipient${data.sent === 1 ? '' : 's'}.`);
    } catch (err) {
      alert('I hit a snag sending email: ' + err.message);
    } finally {
      setEmailing(false);
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

  const campaignByChannel = mapCampaignRows(campaignRows);
  const distributionSnapshot = [
    { key: 'press', label: 'Press' },
    { key: 'eventbrite', label: 'Eventbrite' },
    { key: 'facebook_event', label: 'Facebook Event' },
    { key: 'social_facebook', label: 'Facebook' },
    { key: 'social_instagram', label: 'Instagram' },
    { key: 'social_linkedin', label: 'LinkedIn' },
    { key: 'social_twitter', label: 'Twitter/X' },
    { key: 'calendar_do210', label: 'Do210' },
    { key: 'calendar_sacurrent', label: 'SA Current' },
    { key: 'calendar_evvnt', label: 'Evvnt' },
  ].filter((item) => campaignByChannel[item.key]);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl mb-1">📰 Press Page Generator</h1>
          <p className="text-gray-500 m-0">
            Build a shareable press kit page with bilingual copy, images, venue details, and live distribution records.
          </p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setPreviewHtml('');
                setShareableLink('');
                setPressPageRecord(null);
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
            >
              <option value="">Choose an event...</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {parseLocalDate(e.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleGenerate}
                disabled={!selectedEvent || generating || loadingEventData}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {generating ? '⏳ Generating...' : '✨ Generate Press Page'}
              </button>

              {previewHtml && (
                <>
                  <button onClick={handleDownload} className="btn-secondary text-sm" title="Download HTML file">
                    ⬇️ HTML
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="btn-secondary text-sm"
                    title="Download PDF"
                    disabled={downloadingPdf}
                  >
                    {downloadingPdf ? '⏳ PDF...' : '⬇️ PDF'}
                  </button>
                  <button onClick={handlePrint} className="btn-secondary text-sm" title="Print or save as PDF">
                    🖨️ Print/PDF
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

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
              Share this link with media contacts, sponsors, stakeholders, and board members.
            </p>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
              <input
                type="text"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                placeholder="emails separated by commas"
                className="lg:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={handleEmailPressPage}
                disabled={emailing || !emailRecipients.trim()}
                className="px-4 py-2 bg-[#0d1b2a] text-white text-sm rounded-lg hover:bg-[#12263d] transition-colors disabled:opacity-50"
              >
                {emailing ? '⏳ Sending...' : '📧 Email Press Page'}
              </button>
            </div>
            <textarea
              value={emailNote}
              onChange={(e) => setEmailNote(e.target.value)}
              rows={2}
              placeholder="Optional note to include in the email"
              className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        )}
      </div>

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
                    year: 'numeric',
                  })}
                  {selectedEvent.time && (
                    <span> at {new Date(`1970-01-01T${selectedEvent.time}`).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
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

          {distributionSnapshot.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-semibold text-gray-700 mb-2">Distribution Records (from IMC Composer)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700">
                {distributionSnapshot.map((item) => {
                  const row = campaignByChannel[item.key];
                  return (
                    <p key={item.key} className="m-0">
                      {row?.status === 'sent' || row?.status === 'published' || row?.status === 'created' ? '✅' : '⚠️'} {item.label}: {row?.status || 'not_started'}
                      {row?.external_url ? (
                        <a className="ml-1 text-[#c8a45e]" href={row.external_url} target="_blank" rel="noopener noreferrer">Link</a>
                      ) : null}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedEvent && images.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg mb-4">Press Kit Images ({images.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.slice(0, 8).map((image) => (
              <div key={image.id} className="bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={image.image_url}
                  alt={image.format_key}
                  className="w-full h-24 object-cover"
                />
                <div className="p-2">
                  <p className="text-xs font-medium truncate">
                    {image.format_key?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Image'}
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
            Click "Generate Press Page" to create a shareable live page for{' '}
            <span className="font-medium">{selectedEvent.title}</span>
          </p>
          <div className="text-sm text-gray-400 space-y-1">
            <p>Press page will include:</p>
            <ul className="inline-block text-left space-y-1">
              <li>• Event details and description</li>
              <li>• High-resolution images</li>
              <li>• Venue information with map</li>
              <li>• Distribution records from IMC Composer</li>
              <li>• Share link + PDF + direct email actions</li>
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
