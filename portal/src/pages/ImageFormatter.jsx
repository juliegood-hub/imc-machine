import { useState, useRef, useCallback } from 'react';
import { PLATFORM_FORMATS, getFormatsByPlatform } from '../constants/platformFormats';
import JSZip from 'jszip';

export default function ImageFormatter() {
  const [sourceImage, setSourceImage] = useState(null); // { url, width, height, name }
  const [padding, setPadding] = useState('black');
  const [selectedFormats, setSelectedFormats] = useState(new Set());
  const [generated, setGenerated] = useState([]); // [{ key, label, width, height, blob, url }]
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const fileRef = useRef();

  const platforms = getFormatsByPlatform();

  // Load source image
  const handleFile = (file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImage({ url, width: img.naturalWidth, height: img.naturalHeight, name: file.name });
      setStep(1);
    };
    img.src = url;
  };

  const handleUrl = (url) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImage({ url, width: img.naturalWidth, height: img.naturalHeight, name: 'image' });
      setStep(1);
    };
    img.onerror = () => alert('Could not load image from URL');
    img.src = url;
  };

  // Toggle format selection
  const toggleFormat = (key) => {
    setSelectedFormats(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFormats.size === PLATFORM_FORMATS.length) {
      setSelectedFormats(new Set());
    } else {
      setSelectedFormats(new Set(PLATFORM_FORMATS.map(f => f.key)));
    }
  };

  const selectPlatform = (platform) => {
    const keys = platforms[platform].map(f => f.key);
    const allSelected = keys.every(k => selectedFormats.has(k));
    setSelectedFormats(prev => {
      const next = new Set(prev);
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  // Generate all sizes using Canvas API (client-side)
  const generateAll = useCallback(async () => {
    if (!sourceImage || selectedFormats.size === 0) return;
    setGenerating(true);
    setGenerated([]);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = sourceImage.url;
    });

    const results = [];
    const formats = PLATFORM_FORMATS.filter(f => selectedFormats.has(f.key));

    for (const fmt of formats) {
      const canvas = document.createElement('canvas');
      canvas.width = fmt.width;
      canvas.height = fmt.height;
      const ctx = canvas.getContext('2d');

      // Fill with padding color
      ctx.fillStyle = padding;
      ctx.fillRect(0, 0, fmt.width, fmt.height);

      // Calculate contain fit
      const scale = Math.min(fmt.width / img.naturalWidth, fmt.height / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const x = (fmt.width - drawW) / 2;
      const y = (fmt.height - drawH) / 2;

      ctx.drawImage(img, x, y, drawW, drawH);

      // Convert to blob
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob);

      results.push({ ...fmt, blob, url });
    }

    setGenerated(results);
    setGenerating(false);
    setStep(3);
  }, [sourceImage, selectedFormats, padding]);

  // Download all as ZIP
  const downloadAll = async () => {
    const zip = new JSZip();
    for (const item of generated) {
      const arrayBuf = await item.blob.arrayBuffer();
      zip.file(`${item.platform}/${item.label.replace(/[/\\]/g, '-')} (${item.width}x${item.height}).png`, arrayBuf);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${sourceImage.name || 'formatted'}-all-sizes.zip`;
    a.click();
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl md:text-3xl mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
        🖼️ Image Formatter
      </h1>
      <p className="text-gray-500 mb-6 text-sm">
        Your real photos, properly sized for every platform. No AI manipulation. Just smart formatting.
      </p>

      {/* Step 1: Source Image */}
      <div className="card mb-6">
        <h3 className="text-lg mb-3">1. Choose Your Image</h3>
        {sourceImage ? (
          <div className="flex items-start gap-4">
            <img src={sourceImage.url} alt="Source" className="w-32 h-32 object-contain border border-gray-200 rounded-lg" style={{ background: padding }} />
            <div>
              <p className="text-sm font-semibold">{sourceImage.name}</p>
              <p className="text-xs text-gray-500">{sourceImage.width} × {sourceImage.height} px</p>
              <button onClick={() => { setSourceImage(null); setGenerated([]); setStep(0); }}
                className="text-xs text-red-500 mt-2 bg-transparent border-none cursor-pointer">Change Image</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#c8a45e] transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#c8a45e'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#d1d5db'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              <p className="text-3xl mb-2">📸</p>
              <p className="text-sm text-gray-500">Click or drag your image here</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP. Use the highest resolution you have.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">or paste a URL:</span>
              <input type="url" placeholder="https://..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                onKeyDown={e => { if (e.key === 'Enter' && e.target.value) handleUrl(e.target.value); }} />
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Padding Color */}
      {sourceImage && (
        <div className="card mb-6">
          <h3 className="text-lg mb-3">2. Padding Color</h3>
          <p className="text-xs text-gray-500 mb-3">The space around your image when it doesn't match the target aspect ratio.</p>
          <div className="flex gap-3">
            {['black', 'white'].map(color => (
              <button key={color} onClick={() => setPadding(color)}
                style={{
                  width: 80, height: 50, borderRadius: 8, cursor: 'pointer',
                  background: color, border: padding === color ? '3px solid #c8a45e' : '2px solid #e5e7eb',
                  position: 'relative',
                }}>
                {padding === color && <span style={{ position: 'absolute', top: -8, right: -8, fontSize: 16 }}>✅</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Select Formats */}
      {sourceImage && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg">3. Choose Sizes</h3>
            <button onClick={selectAll}
              className="text-xs px-3 py-1 border border-gray-200 rounded-lg bg-white cursor-pointer hover:bg-gray-50">
              {selectedFormats.size === PLATFORM_FORMATS.length ? 'Deselect All' : `Select All (${PLATFORM_FORMATS.length})`}
            </button>
          </div>
          <div className="space-y-4">
            {Object.entries(platforms).map(([platform, formats]) => (
              <div key={platform}>
                <button onClick={() => selectPlatform(platform)}
                  className="text-sm font-semibold text-gray-700 mb-2 bg-transparent border-none cursor-pointer hover:text-[#c8a45e]">
                  {platform} ({formats.filter(f => selectedFormats.has(f.key)).length}/{formats.length})
                </button>
                <div className="flex flex-wrap gap-2">
                  {formats.map(fmt => (
                    <button key={fmt.key} onClick={() => toggleFormat(fmt.key)}
                      style={{
                        padding: '4px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer',
                        border: selectedFormats.has(fmt.key) ? '2px solid #c8a45e' : '1px solid #e5e7eb',
                        background: selectedFormats.has(fmt.key) ? '#faf8f3' : '#f9fafb',
                        fontWeight: selectedFormats.has(fmt.key) ? '600' : '400',
                      }}>
                      {fmt.label} ({fmt.width}×{fmt.height})
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selectedFormats.size > 0 && (
            <button onClick={generateAll} disabled={generating}
              className="mt-4 px-6 py-2.5 bg-[#c8a45e] text-[#0d1b2a] rounded-lg font-semibold border-none cursor-pointer text-sm disabled:opacity-50">
              {generating ? '⏳ Generating...' : `🚀 Generate ${selectedFormats.size} Sizes`}
            </button>
          )}
        </div>
      )}

      {/* Step 4: Results */}
      {generated.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg">4. Your Formatted Images</h3>
            <button onClick={downloadAll}
              className="px-4 py-2 bg-[#0d1b2a] text-white rounded-lg font-semibold border-none cursor-pointer text-sm">
              ⬇️ Download All as ZIP
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {generated.map(item => (
              <div key={item.key} className="border border-gray-200 rounded-lg overflow-hidden">
                <img src={item.url} alt={item.label} className="w-full h-32 object-contain" style={{ background: padding }} />
                <div className="p-2">
                  <p className="text-xs font-semibold text-gray-800">{item.label}</p>
                  <p className="text-[10px] text-gray-400">{item.width}×{item.height} · {item.platform}</p>
                  <a href={item.url} download={`${item.label} (${item.width}x${item.height}).png`}
                    className="text-[10px] text-[#c8a45e] font-semibold no-underline hover:underline">
                    ⬇ Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
