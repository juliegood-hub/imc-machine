import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MEDIA_CATEGORIES } from '../constants/mediaCategories';

export default function MediaLibrary({ eventId, onSelect, selectable = false }) {
  const { user } = useAuth();
  const [media, setMedia] = useState([]);
  const [category, setCategory] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (user?.id) loadMedia();
  }, [user?.id, category]);

  const loadMedia = async () => {
    try {
      const body = { action: 'list', userId: user.id };
      if (category !== 'all') body.category = category;
      if (eventId) body.eventId = eventId;
      const r = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.success) setMedia(data.media || []);
    } catch (err) {
      console.error('Failed to load media:', err);
    }
  };

  const handleUpload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            base64,
            category: uploadCategory,
            label: file.name.replace(/\.[^.]+$/, ''),
            eventId: eventId || null,
            userId: user.id,
            fileName: file.name,
            mimeType: file.type,
          }),
        });
      }
      await loadMedia();
      setShowUpload(false);
    } catch (err) {
      alert('I hit a snag uploading that image: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this image now?')) return;
    await fetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id, userId: user.id }),
    });
    await loadMedia();
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const getCatInfo = (key) => MEDIA_CATEGORIES.find(c => c.key === key) || { icon: '🖼️', label: key };

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('all')}
          style={{
            padding: '4px 10px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
            border: category === 'all' ? '2px solid #c8a45e' : '1px solid #e5e7eb',
            background: category === 'all' ? '#faf8f3' : '#f9fafb',
            fontWeight: category === 'all' ? '600' : '400',
          }}
        >
          All ({media.length})
        </button>
        {MEDIA_CATEGORIES.map(cat => {
          const count = category === 'all' ? media.filter(m => m.category === cat.key).length : (category === cat.key ? media.length : 0);
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              style={{
                padding: '4px 10px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                border: category === cat.key ? '2px solid #c8a45e' : '1px solid #e5e7eb',
                background: category === cat.key ? '#faf8f3' : '#f9fafb',
                fontWeight: category === cat.key ? '600' : '400',
              }}
            >
              {cat.icon} {cat.label}
            </button>
          );
        })}
      </div>

      {/* Upload area */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="text-sm px-4 py-2 bg-[#c8a45e] text-[#0d1b2a] rounded-lg font-semibold border-none cursor-pointer"
        >
          📤 Upload Images
        </button>
        {showUpload && (
          <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}
            className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white">
            {MEDIA_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
          </select>
        )}
      </div>

      {showUpload && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#c8a45e] transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#c8a45e'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#d1d5db'; handleUpload(e.dataTransfer.files); }}
        >
          <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files)} />
          {uploading ? (
            <p className="text-sm text-gray-500">⏳ Uploading...</p>
          ) : (
            <>
              <p className="text-2xl mb-2">📸</p>
              <p className="text-sm text-gray-500">Click or drag images here</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP. High-res preferred.</p>
            </>
          )}
        </div>
      )}

      {/* Image grid */}
      {media.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {media.map(item => (
            <div
              key={item.id}
              className={`relative group border rounded-lg overflow-hidden ${selectable ? 'cursor-pointer hover:ring-2 hover:ring-[#c8a45e]' : ''}`}
              onClick={() => selectable && onSelect?.(item)}
            >
              <img src={item.original_url} alt={item.label} className="w-full h-32 object-cover" />
              <div className="p-2">
                <p className="text-xs font-medium text-gray-800 truncate">{item.label || 'Untitled'}</p>
                <p className="text-[10px] text-gray-400">{getCatInfo(item.category).icon} {getCatInfo(item.category).label}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                className="absolute top-1 right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Delete"
              >×</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">📸</p>
          <p className="text-sm">No images yet. Upload your first photo above.</p>
        </div>
      )}
    </div>
  );
}
