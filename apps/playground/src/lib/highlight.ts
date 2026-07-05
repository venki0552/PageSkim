/** Tiny regex highlighter for the output panes (markdown + JSON). Returns
 * HTML with span classes; inputs are escaped first. No dependency needed for
 * two grammars. */

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function highlightMd(src: string): string {
  return escapeHtml(src)
    .split("\n")
    .map((line) => {
      if (/^&lt;!--.*--&gt;$/.test(line)) return `<span class="hl-comment">${line}</span>`;
      if (/^#{1,6} /.test(line)) return `<span class="hl-heading">${line}</span>`;
      if (/^&gt; /.test(line)) return `<span class="hl-quote">${line}</span>`;
      if (/^@(table|end)/.test(line)) return `<span class="hl-marker">${line}</span>`;
      if (/^```/.test(line)) return `<span class="hl-marker">${line}</span>`;
      const kv = /^([a-z-]+|summary|tags|anchor|cols): (.*)$/.exec(line);
      if (kv) return `<span class="hl-key">${kv[1]}:</span> ${kv[2]}`;
      const li = /^(- )([^:]+)(: )(.*)$/.exec(line);
      if (li) return `${li[1]}<span class="hl-key">${li[2]}</span>${li[3]}${li[4]}`;
      return line;
    })
    .join("\n");
}

export function highlightJson(src: string): string {
  return escapeHtml(src).replace(
    /(&quot;(?:[^&\\]|\\.|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?/g,
    (match, str, colon, kw) => {
      if (str) {
        return colon
          ? `<span class="hl-key">${str}</span>${colon}`
          : `<span class="hl-string">${str}</span>`;
      }
      if (kw) return `<span class="hl-marker">${match}</span>`;
      return `<span class="hl-number">${match}</span>`;
    },
  );
}
