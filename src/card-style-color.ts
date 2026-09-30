import type {Card} from './model';

const headingTones:Record<Card['color'],string>={sand:'#8d762f',blue:'#537d99',green:'#4d7962',rose:'#a06372',purple:'#8470a5',orange:'#a05b23',red:'#aa4942',teal:'#317c6a',cyan:'#28758b',lime:'#667b28',slate:'#596a80',brown:'#865c3e'};

/** Choose readable title ink without querying layout or theme styles while panning. */
export function cardHeadingColors(node:Pick<Card,'color'|'fillColor'>):{color:string;ink:string}{
 const fill=node.fillColor&&node.fillColor!=='none'?node.fillColor:node.color;
 const color=/^#[0-9a-f]{6}$/i.test(fill)?fill:headingTones[fill as Card['color']]||headingTones.sand;
 const channels=[1,3,5].map(at=>parseInt(color.slice(at,at+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
 return {color,ink:(luminance+.05)/.05>=1.05/(luminance+.05)?'#000000':'#ffffff'};
}
