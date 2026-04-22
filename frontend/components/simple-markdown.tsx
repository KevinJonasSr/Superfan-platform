/**
 * Minimal server-rendered markdown suitable for policy pages. Supports:
 *   # / ## / ### headings
 *   **bold**, *italic*, `inline code`
 *   [text](url) links (opened in same tab; external is fine for policy)
 *   - unordered and 1. ordered lists
 *   --- horizontal rules
 *   > blockquotes
 *   blank-line paragraph breaks
 *
 * Keeps a zero-deps posture and is plenty for static legal copy. If we
 * ever need tables / images / code blocks, swap in `marked` or similar.
 */

import * as React from "react";

function escape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInline(md: string): string {
  let out = escape(md);
  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => {
    const safeHref = /^(https?:|mailto:|tel:|\/)/i.test(href) ? href : "#";
    return `<a href="${safeHref}" class="text-aurora underline underline-offset-2 hover:text-white">${text}</a>`;
  });
  // Bold (before italic so it takes precedence)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-black/40 px-1 py-0.5 text-[12px]">$1</code>');
  return out;
}

export function SimpleMarkdown({ source }: { source: string }) {
  if (!source) return null;
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-white/80">
      {blocks.map((raw, i) => {
        const block = raw.trim();
        if (!block) return null;

        // Horizontal rule
        if (/^-{3,}$/.test(block)) return <hr key={i} className="border-white/10" />;

        // Headings
        const h = /^(#{1,3})\s+(.*)$/.exec(block);
        if (h) {
          const text = renderInline(h[2]);
          if (h[1].length === 1)
            return (
              <h1
                key={i}
                className="mt-4 text-3xl font-semibold text-white"
                style={{ fontFamily: "var(--font-display)" }}
                dangerouslySetInnerHTML={{ __html: text }}
              />
            );
          if (h[1].length === 2)
            return (
              <h2
                key={i}
                className="mt-6 text-xl font-semibold text-white"
                style={{ fontFamily: "var(--font-display)" }}
                dangerouslySetInnerHTML={{ __html: text }}
              />
            );
          return (
            <h3
              key={i}
              className="mt-4 text-base font-semibold text-white"
              dangerouslySetInnerHTML={{ __html: text }}
            />
          );
        }

        // Blockquote
        if (block.startsWith(">")) {
          const text = renderInline(
            block
              .split("\n")
              .map((l) => l.replace(/^>\s?/, ""))
              .join(" "),
          );
          return (
            <blockquote
              key={i}
              className="border-l-2 border-white/20 pl-4 italic text-white/70"
              dangerouslySetInnerHTML={{ __html: text }}
            />
          );
        }

        // Ordered list
        if (/^1\.\s/.test(block)) {
          const items = block.split(/\n/).filter((l) => /^\d+\.\s/.test(l));
          return (
            <ol key={i} className="ml-5 list-decimal space-y-1">
              {items.map((line, j) => (
                <li
                  key={j}
                  dangerouslySetInnerHTML={{
                    __html: renderInline(line.replace(/^\d+\.\s/, "")),
                  }}
                />
              ))}
            </ol>
          );
        }

        // Unordered list
        if (/^[-*]\s/.test(block)) {
          const items = block.split(/\n/).filter((l) => /^[-*]\s/.test(l));
          return (
            <ul key={i} className="ml-5 list-disc space-y-1">
              {items.map((line, j) => (
                <li
                  key={j}
                  dangerouslySetInnerHTML={{
                    __html: renderInline(line.replace(/^[-*]\s/, "")),
                  }}
                />
              ))}
            </ul>
          );
        }

        // Paragraph (join wrapped lines with spaces)
        const text = renderInline(block.replace(/\n/g, " "));
        return <p key={i} dangerouslySetInnerHTML={{ __html: text }} />;
      })}
    </div>
  );
}
