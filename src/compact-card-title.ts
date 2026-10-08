/** Compare the displayed native heading, never rewrite Markdown or its anchors.
 * Only outer whitespace is ignored; aliases, punctuation and case stay exact. */
export function compactCardTitleMatches(title:string,heading:string|null|undefined,enabled:boolean){
 return enabled&&!!title.trim()&&title.trim()===heading?.trim();
}
/** The shell becomes a quiet source line only while its full native preview is
 * present. Nested embeds/quotes belong to their own documents, not this card. */
export function syncCardTitlePresentation(card:HTMLElement,title:HTMLElement,preview:HTMLElement,enabled:boolean){
 const full=!['is-compact-fold','is-folded','ts-node-summary'].some(state=>card.classList.contains(state));
 const first=enabled&&full?Array.from(preview.querySelectorAll('h1')).find(heading=>!heading.closest('.internal-embed,.markdown-embed,.file-embed,.callout,blockquote,[hidden],[aria-hidden="true"]')):undefined;
 const compact=full&&compactCardTitleMatches(title.textContent||'',first?.textContent,enabled);
 card.classList.toggle('is-title-source-line',compact);
 title.setAttribute('aria-label',compact?`来源：${title.textContent?.trim()||''}；修改卡片标题`:'修改卡片标题');
 return compact;
}
