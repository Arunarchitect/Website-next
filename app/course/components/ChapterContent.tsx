import type { ContentBlock, InlineRun, Reference } from "../types";

interface ChapterContentProps {
  content: ContentBlock[];
  references?: Reference[];
}

/** Builds a stable citation number for each reference, in the order the reference list is given. */
function buildRefIndex(references: Reference[] = []): Map<string, number> {
  const map = new Map<string, number>();
  references.forEach((ref, i) => map.set(ref.id, i + 1));
  return map;
}

function RunList({ runs, refIndex }: { runs: InlineRun[]; refIndex: Map<string, number> }) {
  return (
    <>
      {runs.map((run, i) => {
        switch (run.type) {
          case "bold":
            return <strong key={i}>{run.text}</strong>;
          case "italic":
            return <em key={i}>{run.text}</em>;
          case "highlight":
            return (
              <mark key={i} className="cc-highlight">
                {run.text}
              </mark>
            );
          case "code":
            return (
              <code key={i} className="cc-code">
                {run.text}
              </code>
            );
          case "link":
            return (
              <a key={i} href={run.href} target="_blank" rel="noopener noreferrer" className="cc-link">
                {run.text}
              </a>
            );
          case "ref": {
            const n = refIndex.get(run.refId);
            if (!n) return null;
            return (
              <sup key={i} className="cc-ref-sup">
                <a href={`#ref-${run.refId}`} className="cc-ref-link" aria-label={`Jump to reference ${n}`}>
                  [{n}]
                </a>
              </sup>
            );
          }
          case "text":
          default:
            return <span key={i}>{run.text}</span>;
        }
      })}
    </>
  );
}

const CALLOUT_LABEL: Record<string, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Caution",
};

export default function ChapterContent({ content, references = [] }: ChapterContentProps) {
  const refIndex = buildRefIndex(references);

  return (
    <div className="chapter-content">
      <style>{`
        .chapter-content {
          font-size: 16px;
          line-height: 1.7;
          color: var(--ink);
        }
        .chapter-content h2.cc-h2 {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: clamp(1.15rem, 2.6vw, 1.5rem);
          letter-spacing: -0.01em;
          margin: 40px 0 12px;
          padding-top: 4px;
          border-top: 1px solid var(--line);
        }
        .chapter-content h2.cc-h2:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
        }
        .chapter-content h3.cc-h3 {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: clamp(1rem, 2vw, 1.15rem);
          color: var(--blue-deep);
          margin: 26px 0 8px;
        }
        .chapter-content p.cc-p {
          margin: 0 0 16px;
          max-width: 68ch;
        }
        .cc-highlight {
          background: linear-gradient(180deg, rgba(240,201,93,0) 55%, rgba(240,201,93,0.55) 55%);
          padding: 0 1px;
          color: var(--ink);
        }
        .cc-code {
          font-family: var(--font-mono), monospace;
          font-size: 0.86em;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 1px 5px;
        }
        .cc-link {
          color: var(--blue);
          text-decoration: underline;
          text-decoration-color: var(--line);
          text-underline-offset: 2px;
        }
        .cc-link:hover { text-decoration-color: var(--blue); }
        .cc-ref-sup {
          font-size: 0.72em;
          margin-left: 1px;
        }
        .cc-ref-link {
          color: var(--blue);
          font-family: var(--font-mono), monospace;
          text-decoration: none;
        }
        .cc-ref-link:hover { text-decoration: underline; }

        .cc-list {
          margin: 0 0 20px;
          padding: 0 0 0 4px;
          max-width: 68ch;
          list-style: none;
        }
        .cc-list li {
          position: relative;
          padding-left: 22px;
          margin-bottom: 10px;
        }
        .cc-list:not(.cc-ordered) li::before {
          content: "";
          position: absolute;
          left: 2px;
          top: 9px;
          width: 6px;
          height: 6px;
          background: var(--blue);
          border-radius: 1px;
          transform: rotate(45deg);
        }
        .cc-list.cc-ordered {
          counter-reset: cc-count;
        }
        .cc-list.cc-ordered li {
          counter-increment: cc-count;
        }
        .cc-list.cc-ordered li::before {
          content: counter(cc-count);
          position: absolute;
          left: 0;
          top: 0;
          font-family: var(--font-mono), monospace;
          font-size: 0.72rem;
          color: var(--blue);
          background: none;
          width: auto;
          height: auto;
          transform: none;
        }

        .cc-callout {
          display: flex;
          gap: 12px;
          margin: 20px 0 24px;
          padding: 14px 16px;
          border: 1px dashed var(--line);
          border-left: 3px solid var(--blue);
          border-radius: 4px;
          background: #fff;
          max-width: 68ch;
        }
        .cc-callout.variant-warning { border-left-color: #b8582f; }
        .cc-callout.variant-tip { border-left-color: var(--green); }
        .cc-callout-body { flex: 1; min-width: 0; }
        .cc-callout-label {
          display: block;
          font-family: var(--font-mono), monospace;
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--blue);
          margin-bottom: 4px;
        }
        .cc-callout.variant-warning .cc-callout-label { color: #b8582f; }
        .cc-callout.variant-tip .cc-callout-label { color: var(--green); }
        .cc-callout-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: 0.94rem;
          display: block;
          margin-bottom: 4px;
        }
        .cc-callout-text { font-size: 0.92rem; color: var(--ink); }

        .cc-figure {
          margin: 24px 0 28px;
        }
        .cc-figure img {
          width: 100%;
          height: auto;
          display: block;
          border: 1px solid var(--line);
          border-radius: 4px;
          background: #eee;
        }
        .cc-figcaption {
          margin-top: 8px;
          font-size: 0.86rem;
          color: var(--ink);
          max-width: 68ch;
        }
        .cc-figsource {
          margin-top: 2px;
          font-family: var(--font-mono), monospace;
          font-size: 0.72rem;
          color: var(--slate);
        }

        .cc-divider {
          border: none;
          border-top: 1px dashed var(--line);
          margin: 32px 0;
        }

        .cc-references {
          margin-top: 44px;
          padding-top: 20px;
          border-top: 1px solid var(--line);
        }
        .cc-references-title {
          font-family: var(--font-mono), monospace;
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--slate);
          margin: 0 0 14px;
        }
        .cc-references ol {
          margin: 0;
          padding: 0;
          list-style: none;
          counter-reset: cc-ref-count;
        }
        .cc-references li {
          counter-increment: cc-ref-count;
          position: relative;
          padding-left: 30px;
          margin-bottom: 10px;
          font-size: 0.88rem;
          line-height: 1.55;
          color: var(--ink);
          scroll-margin-top: 90px;
        }
        .cc-references li::before {
          content: "[" counter(cc-ref-count) "]";
          position: absolute;
          left: 0;
          top: 0;
          font-family: var(--font-mono), monospace;
          font-size: 0.78rem;
          color: var(--blue);
        }
        .cc-ref-style {
          font-family: var(--font-mono), monospace;
          font-size: 0.66rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--slate);
          margin-right: 6px;
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 1px 5px;
          white-space: nowrap;
        }
        .cc-ref-url {
          display: block;
          color: var(--blue);
          word-break: break-all;
          font-size: 0.82rem;
        }

        @media (max-width: 640px) {
          .chapter-content { font-size: 15.5px; }
          .cc-callout { padding: 12px; gap: 10px; }
          .cc-references li { padding-left: 26px; }
        }
      `}</style>

      {content.map((block, i) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={i} id={block.id} className="cc-h2">
                {block.text}
              </h2>
            ) : (
              <h3 key={i} id={block.id} className="cc-h3">
                {block.text}
              </h3>
            );

          case "paragraph":
            return (
              <p key={i} className="cc-p">
                <RunList runs={block.runs} refIndex={refIndex} />
              </p>
            );

          case "list":
            return block.ordered ? (
              <ol key={i} className="cc-list cc-ordered">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <RunList runs={item} refIndex={refIndex} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="cc-list">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <RunList runs={item} refIndex={refIndex} />
                  </li>
                ))}
              </ul>
            );

          case "callout": {
            const variant = block.variant ?? "note";
            return (
              <div key={i} className={`cc-callout variant-${variant}`}>
                <div className="cc-callout-body">
                  <span className="cc-callout-label">{CALLOUT_LABEL[variant]}</span>
                  {block.title && <span className="cc-callout-title">{block.title}</span>}
                  <span className="cc-callout-text">
                    <RunList runs={block.runs} refIndex={refIndex} />
                  </span>
                </div>
              </div>
            );
          }

          case "image":
            return (
              <figure key={i} className="cc-figure">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.src} alt={block.alt} width={block.width} height={block.height} loading="lazy" />
                {(block.caption || block.source) && (
                  <figcaption>
                    {block.caption && <div className="cc-figcaption">{block.caption}</div>}
                    {block.source && <div className="cc-figsource">{block.source}</div>}
                  </figcaption>
                )}
              </figure>
            );

          case "divider":
            return <hr key={i} className="cc-divider" />;

          default:
            return null;
        }
      })}

      {references.length > 0 && (
        <div className="cc-references">
          <p className="cc-references-title">References</p>
          <ol>
            {references.map((ref) => (
              <li key={ref.id} id={`ref-${ref.id}`}>
                {ref.style && <span className="cc-ref-style">{ref.style}</span>}
                {ref.text}
                {ref.url && (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" className="cc-ref-url">
                    {ref.url}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}