/** Plain text of an HTML document: scripts and styles dropped, tags removed, whitespace collapsed. */
export function visibleText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}
