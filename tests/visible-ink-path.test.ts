import test from 'node:test';
import assert from 'node:assert/strict';
import {VisibleInkPath,visibleInkWorldRect,INK_VECTOR_FRAGMENT_POINTS} from '../src/visible-ink-path';
import {InkPathCache} from '../src/ink-path-cache';
import {strokePath,inkBounds,type InkStroke,type InkPoint} from '../src/ink-model';

const longStroke=(length=4097):InkStroke=>({id:'long',color:'#315e9b',width:8,points:Array.from({length},(_,i)=>[i,20+Math.sin(i/10),.05+(i%7)/7*.95])});
const paths=(value:string)=>value.match(/M[^M]+/g)||[];
const bounds=(stroke:InkStroke)=>inkBounds({version:1,strokes:[stroke]})!;

for(const width of [360,390,430,768,820,1024])for(const height of [300,380])for(const zoom of [.15,1,2.5])test(`world clip uses origin stage and visible keyboard ${width}x${height} @${zoom}`,()=>{
 const stage={left:40,top:80,width,height:800},camera={x:60,y:-20,zoom},visible={offsetLeft:20,offsetTop:100,width:width+30,height};
 const clip=visibleInkWorldRect(stage,camera,visible)!;
 assert.ok(clip.x< -60/zoom);assert.ok(clip.y<40/zoom);
 assert.ok(clip.x+clip.width>(Math.min(40+width,20+width+30)-40-60)/zoom);
 assert.ok(clip.y+clip.height>(100+height-80+20)/zoom);
 assert.ok(clip.width<width/zoom+20);assert.ok(clip.height<height/zoom+20);
});

test('invalid, collapsed and completely obscured stage clips are empty',()=>{
 for(const stage of [{left:0,top:0,width:0,height:100},{left:NaN,top:0,width:100,height:100},{left:0,top:600,width:100,height:100}])assert.equal(visibleInkWorldRect(stage,{x:0,y:0,zoom:1},{offsetLeft:0,offsetTop:0,width:100,height:300}),undefined);
 assert.equal(visibleInkWorldRect({left:0,top:0,width:100,height:100},{x:0,y:0,zoom:0}),undefined);
});

test('all-visible uses the exact original full path and hidden source has no encoding',()=>{
 const stroke=longStroke(),cache=new InkPathCache(),projection=new VisibleInkPath(cache),full=bounds(stroke),source=JSON.stringify(stroke);
 const hidden=projection.project(stroke,{x:-100,y:-100,width:20,height:20});assert.equal(hidden.path,'');assert.equal(hidden.projectedSamples,0);assert.equal(cache.encodings,0);
 const visible=projection.project(stroke,{x:full.x-1,y:full.y-1,width:full.width+2,height:full.height+2});assert.equal(visible.path,strokePath(stroke));assert.equal(visible.allVisible,true);assert.equal(cache.encodings,1);assert.equal(visible.projectedSamples,stroke.points.length);assert.equal(JSON.stringify(stroke),source);
});

test('visible fragments preserve every original disk and tangent at a pressure-varying boundary',()=>{
 const stroke=longStroke(),source=JSON.stringify(stroke),projection=new VisibleInkPath(new InkPathCache());
 const clip={x:INK_VECTOR_FRAGMENT_POINTS-1,y:15,width:2,height:10},result=projection.project(stroke,clip),paint=new Set(paths(result.path!));
 assert.equal(result.allVisible,false);assert.ok(result.projectedSamples<stroke.points.length);
 for(const subpath of paths(strokePath({...stroke,points:stroke.points.slice(510,515)})))assert.ok(paint.has(subpath),subpath);
 // A fragment boundary duplicates only same-winding disks. Every encoded
 // primitive remains exactly one of the original full-stroke primitives.
 const original=new Set(paths(strokePath(stroke)));for(const subpath of paint)assert.ok(original.has(subpath),subpath);
 assert.equal(JSON.stringify(stroke),source);
});

test('a tangent crossing the viewport with both endpoint disks outside is retained',()=>{
 const stroke=longStroke(2049);stroke.points[511]=[-1000,50,.05];stroke.points[512]=[1000,50,1];
 const result=new VisibleInkPath(new InkPathCache()).project(stroke,{x:-1,y:45,width:2,height:10}),paint=new Set(paths(result.path!));
 for(const subpath of paths(strokePath({...stroke,points:stroke.points.slice(511,513)})))assert.ok(paint.has(subpath));
});

test('unchanged fragment membership avoids re-encoding and does not retain joined strings',()=>{
 const stroke=longStroke(),cache=new InkPathCache(),projection=new VisibleInkPath(cache),clip={x:100,y:15,width:100,height:10};
 const first=projection.project(stroke,clip),encodings=cache.encodings,second=projection.project(stroke,{...clip,x:101},first.cursor);
 assert.equal(second.path,undefined);assert.equal(cache.encodings,encodings);assert.equal(second.cursor?.plan,first.cursor?.plan);
 const shifted=projection.project(stroke,{...clip,x:2000},second.cursor);assert.ok(shifted.path);assert.notEqual(shifted.cursor?.ranges,second.cursor?.ranges);assert.ok(cache.encodings>encodings);
});

test('same-ID replacement, mutable pressure/width/points and clear invalidate exact projection geometry',()=>{
 const stroke=longStroke(),projection=new VisibleInkPath(new InkPathCache()),clip={x:100,y:15,width:100,height:10};
 let previous=projection.project(stroke,clip);
 for(const mutate of [()=>{stroke.points[100][2]=1;},()=>{stroke.width=12;},()=>{stroke.points[100][0]+=1;},()=>{stroke.points=stroke.points.map(point=>[...point] as InkPoint);stroke.points[100][1]+=1;}]){
  mutate();const next=projection.project(stroke,clip,previous.cursor);assert.ok(next.path);assert.notEqual(next.cursor?.plan,previous.cursor?.plan);previous=next;
 }
 const replacement={...stroke,points:stroke.points.map(point=>[...point] as InkPoint)},next=projection.project(replacement,clip,previous.cursor);assert.notEqual(next.cursor?.plan,previous.cursor?.plan);
 projection.clear();assert.notEqual(projection.project(replacement,clip,next.cursor).cursor?.plan,next.cursor?.plan);
});

test('frozen geometry permits cursor reuse without freezing mutable source or changing precision',()=>{
 const mutable=longStroke(),source=JSON.stringify(mutable),projection=new VisibleInkPath(new InkPathCache());projection.project(mutable,{x:0,y:0,width:100,height:100});assert.equal(Object.isFrozen(mutable),false);assert.equal(Object.isFrozen(mutable.points),false);assert.equal(JSON.stringify(mutable),source);
 const frozen=longStroke();for(const point of frozen.points)Object.freeze(point);Object.freeze(frozen.points);Object.freeze(frozen);
 const first=projection.project(frozen,{x:0,y:0,width:100,height:100});assert.equal(projection.project(frozen,{x:0,y:0,width:100,height:100},first.cursor).path,undefined);
});

test('short strokes retain immediate legacy behavior unless the board needs mass culling',()=>{
 const stroke={...longStroke(32),id:'short'},cache=new InkPathCache(),projection=new VisibleInkPath(cache),hidden={x:-100,y:-100,width:2,height:2};
 assert.equal(projection.project(stroke,hidden).path,strokePath(stroke));const encodings=cache.encodings;
 assert.equal(projection.project(stroke,hidden,undefined,true).path,'');assert.equal(cache.encodings,encodings);
 assert.equal(projection.project(stroke,{x:-20,y:-20,width:100,height:100},undefined,true).path,strokePath(stroke));
});

test('partial and full projections share the unchanged bounded path cache',()=>{
 const stroke=longStroke(8192),cache=new InkPathCache(192*1024),projection=new VisibleInkPath(cache);
 for(let x=0;x<8192;x+=450){projection.project(stroke,{x,y:10,width:200,height:30});assert.ok(cache.bytes<=cache.maxBytes);}
 const full=bounds(stroke);assert.equal(projection.project(stroke,{x:full.x-1,y:full.y-1,width:full.width+2,height:full.height+2}).path,strokePath(stroke));assert.ok(cache.bytes<=cache.maxBytes);
});

for(const count of [8,2000])test(`legal 65520-point ${count}-stroke source plans fit together and remain stable across hot refresh`,()=>{
 const strokes=Array.from({length:count},(_,i)=>{const length=Math.floor(65520/count)+(i<65520%count?1:0);return{...longStroke(length),id:`s${i}`};}),projection=new VisibleInkPath(new InkPathCache()),tokens=strokes.map(stroke=>projection.sourceToken(stroke));
 assert.ok(projection.bytes<=projection.maxPlanBytes);assert.equal(strokes.reduce((sum,stroke)=>sum+stroke.points.length,0),65520);
 for(let refresh=0;refresh<4;refresh++)for(let i=0;i<strokes.length;i++)assert.equal(projection.sourceToken(strokes[i]),tokens[i]);
 // Old/history-owned strokes may outlive the view elsewhere. Planner retention
 // still remains bounded, and cursor tokens contain no fragment/sample arrays.
 for(let generation=0;generation<4;generation++)for(const stroke of strokes)projection.sourceToken({...stroke,id:`old${generation}-${stroke.id}`,points:stroke.points.map(point=>[...point] as InkPoint)});
 assert.ok(projection.bytes<=projection.maxPlanBytes);assert.equal(Object.keys(tokens[0]).length,0);
});
