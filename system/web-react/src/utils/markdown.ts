/**
 * Simple markdown-to-HTML renderer for AI response content.
 * Handles: **bold**, ## headers, ### subheaders, - lists, newlines.
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>');

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="md-hr">');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="md-li">$1</li>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-li-ol">$1</li>');

  // Wrap consecutive <li> in list containers
  html = html.replace(/((?:<li class="md-li">.+<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>');
  html = html.replace(/((?:<li class="md-li-ol">.+<\/li>\n?)+)/g, '<ol class="md-ol">$1</ol>');

  // Paragraphs: wrap non-tag lines
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      result.push('');
      continue;
    }
    if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol')
        || line.startsWith('</ul') || line.startsWith('</ol') || line.startsWith('<li')
        || line.startsWith('<hr') || line.startsWith('<blockquote')) {
      result.push(line);
    } else {
      result.push(`<p class="md-p">${line}</p>`);
    }
  }

  return result.join('\n');
}

/** Escape HTML to prevent XSS. */
export function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
