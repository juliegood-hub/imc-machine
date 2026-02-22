import { useState, useEffect } from 'react';

export default function GeneratedContent({ 
  channel, 
  channelKey, 
  icon, 
  content, 
  onDistribute, 
  onEdit, 
  onRegenerate,
  distributed,
  generating = false
}) {
  const [text, setText] = useState(content || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(content || '');
  }, [content]);

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    onEdit?.(channelKey, newText);
  };

  const handleDistribute = () => {
    onDistribute?.(channelKey, text);
  };

  const handleRegenerate = () => {
    onRegenerate?.(channelKey);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDistributedStatus = () => {
    if (distributed === 'sending') return { text: 'Sending...', class: 'bg-blue-500 text-white' };
    if (distributed === 'ready') return { text: 'Ready', class: 'bg-yellow-500 text-white' };
    if (distributed === true) return { text: '✓ Sent', class: 'bg-green-500 text-white' };
    if (distributed === false) return { text: '✗ Failed', class: 'bg-red-500 text-white' };
    return { text: 'Distribute', class: 'bg-[#c8a45e] text-[#0d1b2a] hover:bg-[#b8943e]' };
  };

  const status = getDistributedStatus();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h4 className="m-0 text-base">{channel}</h4>
          {generating && (
            <span className="text-xs text-gray-500">
              <span className="animate-spin inline-block">⟳</span> Regenerating...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {text && (
            <>
              <button
                onClick={handleCopy}
                className="text-xs font-semibold px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 transition-all"
                title="Copy to clipboard"
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={generating}
                className="text-xs font-semibold px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
                title="Regenerate content"
              >
                {generating ? '⟳' : '🔄 Regenerate'}
              </button>
            </>
          )}
          <button
            onClick={handleDistribute}
            disabled={!text || generating}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md cursor-pointer border-none transition-all ${status.class} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {status.text}
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={handleTextChange}
        rows={6}
        style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%' }}
        className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-y focus:outline-none focus:border-[#c8a45e]"
        placeholder={`Generated ${channel} content will appear here...`}
      />
      {text && (
        <div className="mt-2 text-xs text-gray-500">
          {text.length} characters • {Math.ceil(text.length / 5)} words
        </div>
      )}
    </div>
  );
}
