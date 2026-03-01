import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function PublicPressPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/distribute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-press-page', slug }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Press page not found.');
        if (!cancelled) setPage(data.pressPage || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Press page not found.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied.');
    } catch (err) {
      alert('Copy failed. You can copy from the browser address bar.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-gray-600">Loading press page...</p>
      </div>
    );
  }

  if (error || !page?.html) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg text-center">
          <h1 className="text-xl mb-2">Press Page Unavailable</h1>
          <p className="text-sm text-gray-600 m-0">{error || 'I could not load this press page right now.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg m-0">📰 {page.title || 'Press Page'}</h1>
          {page.generatedAt && <p className="text-xs text-gray-500 m-0">Updated {new Date(page.generatedAt).toLocaleString()}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopyLink} className="btn-secondary text-xs">📋 Copy Link</button>
          <button onClick={() => window.print()} className="btn-secondary text-xs">🖨️ Print</button>
        </div>
      </div>
      <iframe
        title={page.title || 'Press Page'}
        srcDoc={page.html}
        className="w-full border-0"
        style={{ height: 'calc(100vh - 68px)' }}
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}
