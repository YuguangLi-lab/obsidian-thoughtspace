import type {Card} from './model';
import {mediaClock} from './media-source';
import {mediaPlayerUrl} from './media-notes';

/** Reference files are JSON, so exports open their existing player protocol instead. */
export function externalMediaMarkdown(node:Pick<Card,'kind'|'file'|'mediaStart'>,vaultName?:string):string|undefined {
 const file=node.file;
 if(vaultName===undefined||(node.kind!=='audio'&&node.kind!=='video')||!file||!/\.(tsvideo|tsaudio)$/i.test(file))return;
 const time=node.mediaStart??0,url=mediaPlayerUrl({vault:vaultName,file},time);
 const label=`${file.split('/').at(-1)} · ${mediaClock(time)}`.replace(/[\\[\]*_`<>]/g,'\\$&');
 return `[${label}](${url})`;
}
