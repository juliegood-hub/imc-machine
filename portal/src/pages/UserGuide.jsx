import { Link } from 'react-router-dom';
import { BUDDY_HELP_TOPICS, USER_GUIDE } from '../constants/helpCenterContent';

function buildGuideMarkdown() {
  const lines = [];
  lines.push(`# ${USER_GUIDE.title}`);
  lines.push(`Version: ${USER_GUIDE.version}`);
  lines.push(`Last Updated: ${USER_GUIDE.updatedAt}`);
  lines.push('');
  USER_GUIDE.intro.forEach((p) => lines.push(p, ''));
  lines.push('## Table of Contents');
  USER_GUIDE.sections.forEach((section) => {
    lines.push(`- [${section.title}](#${section.id})`);
  });
  lines.push('');
  USER_GUIDE.sections.forEach((section) => {
    lines.push(`## ${section.title}`);
    lines.push('', `### What It Does`, section.whatItDoes, '', `### Why It Matters`, section.whyItMatters, '');
    lines.push('### Step by Step');
    section.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    lines.push('', '### Pro Tips');
    section.proTips.forEach((tip) => lines.push(`- ${tip}`));
    lines.push('', '### Common Mistakes');
    section.commonMistakes.forEach((mistake) => lines.push(`- ${mistake}`));
    lines.push('', '### Basic vs Pro');
    lines.push(section.modeGuidance, '');
  });
  return lines.join('\n');
}

function downloadGuideMarkdown() {
  const content = buildGuideMarkdown();
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'imc-machine-user-guide-v1.md';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

export default function UserGuide() {
  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-4">
      <header className="card border border-[#0d1b2a1a] bg-[#faf8f3]">
        <p className="text-xs uppercase tracking-wide text-gray-500 m-0">User Guide</p>
        <h1 className="text-3xl mt-1 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{USER_GUIDE.title}</h1>
        <p className="text-xs text-gray-500 m-0">Version {USER_GUIDE.version} · Updated {USER_GUIDE.updatedAt}</p>
        <div className="mt-3 space-y-2">
          {USER_GUIDE.intro.map((paragraph) => (
            <p key={paragraph} className="text-sm text-gray-700 m-0">{paragraph}</p>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => window.print()}>🖨️ Print / PDF</button>
          <button type="button" className="btn-secondary text-xs" onClick={downloadGuideMarkdown}>⬇️ Download Markdown</button>
          <Link className="btn-secondary text-xs no-underline" to="/white-papers">📄 Open White Papers</Link>
          <Link className="btn-secondary text-xs no-underline" to="/buddy">🐈‍⬛ Ask CatBot Buddy</Link>
        </div>
      </header>

      <section id="toc" className="card">
        <h2 className="text-lg m-0 mb-2">Table of Contents</h2>
        <ol className="m-0 pl-5 space-y-1">
          {USER_GUIDE.sections.map((section) => (
            <li key={section.id} className="text-sm">
              <a className="text-[#0d1b2a] font-semibold" href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </section>

      {USER_GUIDE.sections.map((section) => (
        <article key={section.id} id={section.id} className="card scroll-mt-20">
          <h2 className="text-xl m-0 mb-2">{section.title}</h2>

          <h3 className="text-sm uppercase tracking-wide text-gray-500 m-0 mb-1">What It Does</h3>
          <p className="text-sm text-gray-700 mt-0 mb-3">{section.whatItDoes}</p>

          <h3 className="text-sm uppercase tracking-wide text-gray-500 m-0 mb-1">Why It Matters</h3>
          <p className="text-sm text-gray-700 mt-0 mb-3">{section.whyItMatters}</p>

          <h3 className="text-sm uppercase tracking-wide text-gray-500 m-0 mb-1">Step by Step</h3>
          <ol className="m-0 pl-5 text-sm text-gray-700 space-y-1 mb-3">
            {section.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border border-[#0d1b2a1a] bg-[#faf8f3] p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 m-0 mb-1">Pro Tips</p>
              <ul className="m-0 pl-4 text-sm text-gray-700 space-y-1">
                {section.proTips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            </div>
            <div className="rounded border border-[#0d1b2a1a] bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500 m-0 mb-1">Common Mistakes</p>
              <ul className="m-0 pl-4 text-sm text-gray-700 space-y-1">
                {section.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
              </ul>
            </div>
          </div>

          <div className="mt-3 rounded border border-[#c8a45e55] bg-[#fffaf0] p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 m-0 mb-1">Basic vs Pro</p>
            <p className="text-sm text-gray-700 m-0">{section.modeGuidance}</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <a href="#toc" className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Back to TOC</a>
            <Link to="/workflow" className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Open How It Works</Link>
            <Link to="/white-papers" className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Related White Papers</Link>
          </div>
        </article>
      ))}

      <section id="learn-with-buddy" className="card border border-[#0d1b2a1a] bg-[#f7f9ff]">
        <h2 className="text-lg m-0 mb-2">Learn with Buddy</h2>
        <p className="text-sm text-gray-600 mt-0 mb-3">
          Want the quick route instead of reading the full guide? Open CatBot Buddy and use one of these prompts.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {BUDDY_HELP_TOPICS.map((topic) => (
            <div key={topic.key} className="rounded border border-white bg-white p-3">
              <p className="text-sm font-semibold m-0">{topic.label}</p>
              <p className="text-xs text-gray-500 mt-1 mb-2">{topic.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Link to={topic.path} className="text-xs px-2 py-1 rounded border border-[#0d1b2a] text-[#0d1b2a] no-underline">Open Section</Link>
                <Link to="/buddy" className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Ask Buddy</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
