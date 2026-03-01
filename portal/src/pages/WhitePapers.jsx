import { Link } from 'react-router-dom';
import { WHITE_PAPERS, getWhitePaperSectionOrder, HELP_CENTER_LAST_UPDATED } from '../constants/helpCenterContent';

function makeAnchorId(paperId, sectionKey) {
  return `${paperId}-${sectionKey}`;
}

function buildWhitePapersMarkdown() {
  const lines = [];
  lines.push('# IMC Machine White Papers');
  lines.push(`Last Updated: ${HELP_CENTER_LAST_UPDATED}`);
  lines.push('');
  lines.push('## Table of Contents');
  WHITE_PAPERS.forEach((paper) => {
    lines.push(`- [${paper.title}](#${paper.id})`);
  });
  lines.push('');
  WHITE_PAPERS.forEach((paper) => {
    lines.push(`## ${paper.title}`);
    lines.push(`Version: ${paper.version}`);
    lines.push(`Audience: ${paper.audience}`);
    lines.push('');
    getWhitePaperSectionOrder().forEach((section) => {
      lines.push(`### ${section.title}`);
      lines.push(paper.sections[section.key] || '');
      lines.push('');
    });
    if (Array.isArray(paper.versionHistory) && paper.versionHistory.length > 0) {
      lines.push('### Version History');
      paper.versionHistory.forEach((item) => {
        lines.push(`- ${item.version} (${item.date}): ${item.notes}`);
      });
      lines.push('');
    }
  });
  return lines.join('\n');
}

function downloadWhitePapersMarkdown() {
  const content = buildWhitePapersMarkdown();
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'imc-machine-white-papers-v1.md';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

export default function WhitePapers() {
  const sectionOrder = getWhitePaperSectionOrder();

  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-4">
      <header className="card border border-[#0d1b2a1a] bg-[#faf8f3]">
        <p className="text-xs uppercase tracking-wide text-gray-500 m-0">White Papers</p>
        <h1 className="text-3xl mt-1 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>IMC Machine White Papers</h1>
        <p className="text-sm text-gray-700 m-0">
          These papers explain the strategy and architecture behind IMC Machine in language fit for stakeholders, city partners, and professional production teams.
        </p>
        <p className="text-xs text-gray-500 mt-2 mb-0">Current release set: v1.0 · Updated {HELP_CENTER_LAST_UPDATED}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => window.print()}>🖨️ Print / PDF</button>
          <button type="button" className="btn-secondary text-xs" onClick={downloadWhitePapersMarkdown}>⬇️ Download Markdown</button>
          <Link className="btn-secondary text-xs no-underline" to="/user-guide">🧭 Open User Guide</Link>
          <Link className="btn-secondary text-xs no-underline" to="/buddy">🐈‍⬛ Ask CatBot Buddy</Link>
        </div>
      </header>

      <section id="toc" className="card">
        <h2 className="text-lg m-0 mb-2">Table of Contents</h2>
        <ol className="m-0 pl-5 space-y-1">
          {WHITE_PAPERS.map((paper) => (
            <li key={paper.id} className="text-sm">
              <a href={`#${paper.id}`} className="text-[#0d1b2a] font-semibold">{paper.title}</a>
            </li>
          ))}
        </ol>
      </section>

      {WHITE_PAPERS.map((paper) => (
        <article key={paper.id} id={paper.id} className="card scroll-mt-20">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div>
              <h2 className="text-2xl m-0" style={{ fontFamily: "'Playfair Display', serif" }}>{paper.title}</h2>
              <p className="text-xs text-gray-500 mt-1 mb-0">Version {paper.version} · Updated {paper.updatedAt}</p>
              <p className="text-xs text-gray-500 mt-1 mb-0">Audience: {paper.audience}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <a href="#toc" className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">Back to TOC</a>
              <Link to="/workflow" className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">How It Works</Link>
            </div>
          </div>

          <div className="rounded border border-[#0d1b2a1a] bg-[#f7f9ff] p-3 mb-3">
            <p className="text-xs uppercase tracking-wide text-gray-500 m-0 mb-1">Paper Outline</p>
            <ul className="m-0 pl-4 text-sm text-gray-700 grid grid-cols-1 md:grid-cols-2 gap-1">
              {sectionOrder.map((section) => (
                <li key={`${paper.id}-${section.key}`}>
                  <a href={`#${makeAnchorId(paper.id, section.key)}`} className="text-[#0d1b2a]">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            {sectionOrder.map((section) => (
              <section key={`${paper.id}-${section.key}`} id={makeAnchorId(paper.id, section.key)} className="rounded border border-gray-200 bg-white p-3 scroll-mt-20">
                <h3 className="text-lg m-0 mb-1">{section.title}</h3>
                <p className="text-sm text-gray-700 m-0">{paper.sections[section.key]}</p>
              </section>
            ))}
          </div>

          <section className="mt-3 rounded border border-[#c8a45e55] bg-[#fffaf0] p-3">
            <h3 className="text-base m-0 mb-2">Version History</h3>
            <ul className="m-0 pl-4 text-sm text-gray-700 space-y-1">
              {paper.versionHistory.map((item) => (
                <li key={`${paper.id}-${item.version}`}>{item.version} ({item.date}): {item.notes}</li>
              ))}
            </ul>
          </section>
        </article>
      ))}
    </div>
  );
}
