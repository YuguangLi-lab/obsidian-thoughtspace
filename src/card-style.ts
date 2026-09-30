import type {Card} from './model';

export type CardStyleChoice='transparent'|'solid'|'band'|'paper';
export const cardStyleChoices:Record<CardStyleChoice,string>={transparent:'透明',solid:'实色',band:'彩色标题栏',paper:'双线纸笺'};

/** Decorative note surfaces never apply to media, tables or external web cards. */
export function supportsCardStyle(node:Card):boolean{return node.kind==='card'&&typeof node.file==='string'&&/\.md$/i.test(node.file)&&!node.webUrl;}
export function effectiveCardStyle(node:Card):Card['cardStyle']{return supportsCardStyle(node)&&(node.cardStyle==='band'||node.cardStyle==='paper')?node.cardStyle:undefined;}
export function cardStyleChoice(node:Card):CardStyleChoice{return effectiveCardStyle(node)||(node.transparent?'transparent':'solid');}

/** Switching note surfaces changes only board appearance, not the referenced note. */
export function applyCardStyle(node:Card,value:CardStyleChoice):void{
 if(!supportsCardStyle(node)||node.locked)return;
 if(value==='band'||value==='paper'){node.cardStyle=value;return;}
 if(value==='transparent'||value==='solid'){delete node.cardStyle;node.transparent=value==='transparent';}
}
export function applyDefaultCardStyle(node:Card,choice:CardStyleChoice='transparent'):Card{applyCardStyle(node,choice);return node;}
