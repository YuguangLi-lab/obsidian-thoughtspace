import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanCollectionBackground,collectionBackgroundPalette,collectionBackgroundStamp,collectionBackgroundStyles,collectionColorContrast,defaultCollectionBackground} from '../src/collection-background';
import {cleanPluginSettings} from '../src/plugin-settings';
import {backgroundOptions} from '../src/board-background';
import {paperPresets} from '../src/paper-appearance';

test('old or missing collection settings default to independent warm-white paper',()=>{
 const old={canvasBackground:'grid',paperPreset:'custom',paperColor:'#123456',paperTexture:83,backgroundImagePath:'assets/board.png'};
 const before=JSON.stringify(old),loaded=cleanPluginSettings(old);
 assert.deepEqual(loaded.collectionBackground,defaultCollectionBackground);assert.equal(loaded.canvasBackground,'grid');assert.equal(loaded.paperColor,'#123456');assert.equal(JSON.stringify(old),before);
 assert.equal(collectionBackgroundPalette(undefined).paper,'#fffdf8');
});
test('collection background survives serialization without altering board preferences',()=>{
 const input={canvasBackground:'dots',paperColor:'#abcdef',collectionBackground:{canvasBackground:'paper',paperPreset:'custom',paperColor:'#e3f0f4',paperTexture:64}};
 const first=cleanPluginSettings(input),loaded=cleanPluginSettings(JSON.parse(JSON.stringify(first)));
 assert.deepEqual(loaded.collectionBackground,first.collectionBackground);assert.equal(loaded.collectionBackground.paperColor,'#e3f0f4');assert.equal(loaded.paperColor,'#abcdef');assert.equal(loaded.canvasBackground,'dots');
});
test('invalid colors, texture, modes and external image paths cannot enter CSS',()=>{
 const value=cleanCollectionBackground({canvasBackground:'url(x)',paperColor:'red;display:none',paperPreset:'unknown',paperTexture:Infinity,backgroundImagePath:'https://example.com/private.png'});
 assert.equal(value.paperColor,'#fffdf8');assert.equal(value.paperPreset,'custom');assert.equal(value.canvasBackground,'paper');assert.equal(value.backgroundImagePath,'');assert.equal(value.paperTexture,35);
 assert.equal(collectionBackgroundStyles(value,'forest','https://example.com/ignored.png')['--ts-c-background-image'],'none');
 for(const path of ['../secret.png','/tmp/private.png','file:///tmp/a.png'])assert.equal(cleanCollectionBackground({backgroundImagePath:path}).backgroundImagePath,'');
});
test('all shared board modes, local image fits and texture limits are supported',()=>{
 assert.deepEqual(backgroundOptions.map(x=>x[0]),['dots','grid','plain','paper','image']);
 for(const [mode]of backgroundOptions){const p=cleanCollectionBackground({canvasBackground:mode,backgroundImagePath:'assets/local.png',backgroundImageFit:'tile',paperTexture:200,backgroundImageOpacity:-5}),s=collectionBackgroundStyles(p,'forest','app://local/local.png');assert.equal(p.canvasBackground,mode);assert.equal(p.paperTexture,100);assert.equal(s['--ts-c-image-fit'],'auto');assert.equal(s['--ts-c-image-repeat'],'repeat');assert.equal(s['--ts-c-image-opacity'],'0');assert.equal(s['--ts-c-background-image'],'url("app://local/local.png")');}
});
test('arbitrary paper colors and named presets keep readable text and controls in both themes',()=>{
 const colors=[...Object.values(paperPresets).map(p=>p.color),'#000000','#ffffff','#777777','#888888','#0055ff','#ee0000','#00bb00'];
 for(let i=0;i<128;i++)colors.push('#'+((i*1240937)%0xffffff).toString(16).padStart(6,'0'));
 for(const color of colors)for(const dark of [false,true])for(const accent of ['forest','blue','amber','rose']){
  const p=collectionBackgroundPalette({paperPreset:'custom',paperColor:color},accent,dark);
  for(const key of ['ink','muted','accent'] as const)assert(collectionColorContrast(p[key],p.paper)>=4.5,`${color}/${dark}/${accent}/${key}`);
  assert(collectionColorContrast(p.ink,p.sheet)>=4.5);assert(collectionColorContrast(p.onAccent,p.accent)>=4.5);
 }
});
test('image reading scrim remains readable over both black and white images',()=>{
 const blend=(a:string,b:string)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*.92+parseInt(b.slice(i,i+2),16)*.08).toString(16).padStart(2,'0')).join('');
 for(const dark of [false,true]){const p=collectionBackgroundPalette({canvasBackground:'image'},'forest',dark);for(const image of ['#000000','#ffffff'])for(const key of ['ink','muted'] as const)assert(collectionColorContrast(p[key],blend(p.paper,image))>=4.5);}
});
test('stamps include remembered pigment and image options so concurrent saves can detect changes',()=>{
 const p=cleanCollectionBackground({paperPreset:'white'}),stamp=collectionBackgroundStamp(p);
 for(const change of [{paperColor:'#000000'},{paperTexture:90},{backgroundImageOpacity:2},{backgroundImagePath:'assets/new.png'},{backgroundImageFit:'tile'},{canvasBackground:'grid'}])assert.notEqual(collectionBackgroundStamp({...p,...change}),stamp);
});
