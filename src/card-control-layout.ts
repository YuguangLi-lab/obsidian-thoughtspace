export interface CardControlRect {x:number;y:number;width:number;height:number}
export interface CardControlViewport {x:number;y:number;zoom:number}
export interface CardControlPlacement {scale:number;top:number;right:number}

const finite=(value:number,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** Keep the whole control strip visible before preserving optional gutters. */
function available(extent:number,size:number,start:number,end:number):[number,number]{
  if(extent>=size+start+end)return [start,extent-size-end];
  if(start>12&&extent>=size+start)return [start,extent-size];
  if(extent>=size)return [0,extent-size];
  const centered=(extent-size)/2;return [centered,centered];
}

/** Pure placement for a top-right transform origin. The supplied rectangle is
 * already display-projected (including compact folding), never source geometry.
 * Buttons are 28 px, gaps 4 px and outer padding/border totals 8 px: five actions
 * occupy 164 x 36 before scaling. Viewport translation is measured in screen px.
 */
export function cardControlLayout(node:CardControlRect,viewport:CardControlViewport,stageWidth:number,stageHeight:number,actionCount:number,dimensions?:{width:number;height:number;topReserve?:number;screenGap?:number;avoid?:ReadonlyArray<CardControlRect>}):CardControlPlacement{
  const zoom=Number.isFinite(viewport.zoom)&&viewport.zoom>0?viewport.zoom:1;
  const scale=clamp(1/zoom,.4,2),requestedHeight=Math.max(1,finite(dimensions?.height??36,36));
  // The early offscreen/overflow fallback must itself remain valid CSS geometry.
  const dockHeight=Number.isFinite(requestedHeight*scale)?requestedHeight:36;
  const topReserve=Math.max(0,finite(dimensions?.topReserve??60,60)),fallback={scale,top:-dockHeight*scale-20,right:0};
  const count=Math.max(1,Math.floor(finite(actionCount,1)));
  const width=Math.max(1,finite(dimensions?.width??32*count+4,36))*scale*zoom,height=dockHeight*scale*zoom;
  const x=finite(node.x)*zoom+finite(viewport.x),y=finite(node.y)*zoom+finite(viewport.y);
  const nodeWidth=Math.max(0,finite(node.width))*zoom,nodeHeight=Math.max(0,finite(node.height))*zoom;
  const nodeRight=x+nodeWidth,nodeBottom=y+nodeHeight,gap=Math.max(20*zoom,finite(dimensions?.screenGap??0));
  if(![x,y,nodeRight,nodeBottom,width,height,gap].every(Number.isFinite))return fallback;
  const stageW=Math.max(0,finite(stageWidth)),stageH=Math.max(0,finite(stageHeight));
  // Overscan nodes still own DOM. Do not pull their always-visible compact dock
  // into the viewport while the corresponding object is completely offscreen.
  if(nodeRight<=0||x>=stageW||nodeBottom<=0||y>=stageH)return fallback;
  const [minX,maxX]=available(stageW,width,12,12);
  const [minY,maxY]=available(stageH,height,topReserve,12);
  let left=clamp(nodeRight-width,minX,maxX),top=clamp(y-gap-height,minY,maxY);
  const port=(cx:number,cy:number)=>[cx-gap,cy-gap,cx+gap,cy+gap];
  const centerX=x+nodeWidth/2,centerY=y+nodeHeight/2;
  // A taller format bar can push an otherwise valid dock past the top port and
  // into paragraphs. Preserve the entire projected body as a separate obstacle.
  const obstacles=[[x,y,nodeRight,nodeBottom],port(centerX,y),port(centerX,nodeBottom),port(x,centerY),port(nodeRight,centerY),
    // branch-controls.css: left=right+24, height=32; 112 px covers a five-digit
    // count and its menu. Reserve it without reading DOM, plus a 5 px margin.
    [nodeRight+19*zoom,centerY-21*zoom,nodeRight+141*zoom,centerY+21*zoom]];
  // Canvas chrome is already measured in stage screen pixels, including any
  // caller-supplied safety margin. Keep this calculation independent of DOM.
  for(const rect of dimensions?.avoid||[]){
    const right=rect.x+rect.width,bottom=rect.y+rect.height;
    if(rect.width>0&&rect.height>0&&[rect.x,rect.y,rect.width,rect.height,right,bottom].every(Number.isFinite))obstacles.push([rect.x,rect.y,right,bottom]);
  }
  const overlap=([a,b]:readonly number[],[l,t,r,d]:readonly number[])=>{
    const w=Math.min(a+width,r)-Math.max(a,l),h=Math.min(b+height,d)-Math.max(b,t);
    return w>1e-8&&h>1e-8?w*h:0;
  };
  const clears=(point:readonly number[])=>obstacles.every(rect=>!overlap(point,rect));
  if(!clears([left,top])){
    const travel=([a,b]:readonly number[])=>Math.hypot(a-left,b-top);
    const nearest=(points:number[][])=>points.filter(clears).sort((a,b)=>travel(a)-travel(b))[0];
    const xs=[left,minX,maxX],ys=[top,minY,maxY];
    for(const [l,t,r,d] of obstacles){xs.push(clamp(l-width,minX,maxX),clamp(r,minX,maxX));ys.push(clamp(t-height,minY,maxY),clamp(d,minY,maxY));}
    // Compare both axes so a nearby position below the card wins over a long
    // sideways detour past a neighbour. Combinations handle corner cases.
    let next=nearest([...xs.map(a=>[a,top]),...ys.map(b=>[left,b])]);
    if(!next){
      const uniqueY=[...new Set(ys)],points=[...new Set(xs)].flatMap(a=>uniqueY.map(b=>[a,b]));
      const covered=(point:readonly number[])=>obstacles.reduce((sum,rect)=>sum+overlap(point,rect),0);
      next=nearest(points)||points.sort((a,b)=>covered(a)-covered(b)||travel(a)-travel(b))[0];
    }
    [left,top]=next;
  }
  const result={scale,top:(top-y)/zoom,right:(nodeRight-left-width)/zoom};
  return Object.values(result).every(Number.isFinite)?result:fallback;
}
