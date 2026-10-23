import {cleanBoardBackground,type BoardBackground} from './board-background';
import {paperBaseColor,paperPresets} from './paper-appearance';
import {isRecord,isFiniteNumber,isOneOf} from './value-guards';

/** Collection never inherits a board's pigment, texture or saved image. */
export const defaultCollectionBackground:Readonly<BoardBackground>={canvasBackground:'paper',paperPreset:'custom',paperColor:'#fffdf8',paperTexture:35,backgroundImagePath:'',backgroundImageFit:'cover',backgroundImageOpacity:70};
export function cleanCollectionBackground(raw:unknown):BoardBackground{
 const value=isRecord(raw)?raw:{},fallback=defaultCollectionBackground;
 return cleanBoardBackground({...fallback,...value,
  canvasBackground:isOneOf(value.canvasBackground,['dots','grid','plain','paper','image'])?value.canvasBackground:fallback.canvasBackground,
  paperPreset:typeof value.paperPreset==='string'&&Object.hasOwn(paperPresets,value.paperPreset)?value.paperPreset:fallback.paperPreset,
  paperColor:typeof value.paperColor==='string'&&/^#[\da-f]{6}$/i.test(value.paperColor)?value.paperColor:fallback.paperColor,
  paperTexture:isFiniteNumber(value.paperTexture)?value.paperTexture:fallback.paperTexture,
  backgroundImageOpacity:isFiniteNumber(value.backgroundImageOpacity)?value.backgroundImageOpacity:fallback.backgroundImageOpacity,
 });
}
export const collectionBackgroundStamp=(value:unknown)=>JSON.stringify(cleanCollectionBackground(value));
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const blend=(a:string,b:string,weight:number)=>'#'+rgb(a).map((v,i)=>Math.round(v*(1-weight)+rgb(b)[i]*weight).toString(16).padStart(2,'0')).join('');
const luminance=(color:string)=>rgb(color).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
export function collectionColorContrast(a:string,b:string){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const strongInk=(paper:string)=>collectionColorContrast('#000000',paper)>collectionColorContrast('#ffffff',paper)?'#000000':'#ffffff';
export function collectionBackgroundPalette(raw:unknown,accent='forest',dark=false){
 const value=cleanCollectionBackground(raw),base=value.canvasBackground==='image'?'#fffdf8':paperBaseColor(value);
 const paper=dark?blend('#171918',base,.16):base,strong=strongInk(paper);
 const preferred=dark?'#e9ebdf':'#302d27',ink=collectionColorContrast(preferred,paper)>=7?preferred:strong;
 const mutedCandidate=dark?'#b9bcaf':'#6d685f',muted=collectionColorContrast(mutedCandidate,paper)>=(value.canvasBackground==='image'?7:4.8)?mutedCandidate:ink;
 let sheet=blend(paper,'#ffffff',strong==='#000000'?.3:.035);
 if(collectionColorContrast(ink,sheet)<4.5)sheet=paper;
 const accents:Record<string,string>=dark?{forest:'#8abbab',blue:'#92bfd8',amber:'#d7b67d',rose:'#d8a6b8'}:{forest:'#326756',blue:'#326a8b',amber:'#805c24',rose:'#8f5367'};
 const seed=accents[accent]||accents.forest;let readableAccent=seed;
 for(let i=1;i<=20&&collectionColorContrast(readableAccent,paper)<4.5;i++)readableAccent=blend(seed,strong,i/20);
 return{paper,sheet,ink,muted,line:blend(paper,ink,.14),wash:blend(paper,ink,.035),nav:blend(paper,sheet,.3),accent:readableAccent,onAccent:strongInk(readableAccent),patternInk:blend(paper,ink,.12)};
}
export function collectionBackgroundStyles(raw:unknown,accent='forest',resource=''):Record<string,string>{
 const value=cleanCollectionBackground(raw),styles:Record<string,string>={};
 for(const dark of [false,true])for(const [name,color]of Object.entries(collectionBackgroundPalette(value,accent,dark)))styles[`--ts-c-${dark?'dark':'light'}-${name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}`]=color;
 styles['--ts-c-texture-strength']=String(value.paperTexture/100);
 styles['--ts-c-background-image']=value.backgroundImagePath&&resource?`url(${JSON.stringify(resource)})`:'none';
 styles['--ts-c-image-fit']=value.backgroundImageFit==='tile'?'auto':value.backgroundImageFit;
 styles['--ts-c-image-repeat']=value.backgroundImageFit==='tile'?'repeat':'no-repeat';
 styles['--ts-c-image-opacity']=String(value.backgroundImageOpacity/100);
 return styles;
}
