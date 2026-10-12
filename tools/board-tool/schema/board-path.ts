/** Board path syntax only; this never identifies a Markdown file's contents.
 * Callers must verify its native frontmatter and complete board payload before
 * opening it. Existing caller-specific limits and path guards remain separate. */
export function isBoardPath(value:unknown):value is string {
 return typeof value==='string'&&(value.endsWith('.thoughtspace')||/\.md$/i.test(value))&&!/(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(value);
}
