import type {Card} from './model';

/** Ordinary text defaults to a fixed frame; height fitting is explicit opt-in.
 * Mind-map topics preserve their existing automatic sizing unless opted out. */
export function textFitsContent(node:Pick<Card,'kind'|'topic'|'textAutoHeight'|'autoSize'>|undefined):boolean {
 return node?.kind==='text'&&(node.textAutoHeight===true||(node.topic===true&&node.textAutoHeight!==false&&node.autoSize!==false));
}

/** Keep one body-text line visible in a manually shortened frame without changing
 * its font. Larger frames retain their normal spacing; long content still scrolls. */
export function textBlockPadding(node:Pick<Card,'fontSize'|'borderWidth'>,height:number):number {
 return Math.max(0,Math.min(14,(height-(node.fontSize||16)*1.7-(node.borderWidth??1)*2)/2));
}
