export interface CardControlRect {x:number;y:number;width:number;height:number}
export interface CardControlViewport {x:number;y:number;zoom:number}
export interface CardControlPlacement {scale:number;top:number;right:number;suppressed?:boolean}
export interface CardControlDimensions {width:number;height:number;topReserve?:number;screenGap?:number;avoid?:ReadonlyArray<CardControlRect>;touchTargets?:boolean}
export interface CardControlDockRequest {id:string;node:CardControlRect;count:number;dimensions:CardControlDimensions;priority:number;entry?:boolean}

// The 44 px entry is inset from a 52 px slot in the node's padding box.
// At large zoom its supported 0–4 px border moves the real button left/down.
// Reserve the union of those projections, without changing the button or DOM.
function entryControlOverflow(zoom:number):number{return Math.max(0,4*zoom-4);}

function localEntryPlacement(request:CardControlDockRequest,viewport:CardControlViewport,width:number,height:number,avoid:CardControlRect[]):CardControlPlacement{
  const {node,dimensions}=request,z=viewport.zoom,scale=1/z,metrics=cardControlMetrics(1,36,36,true),w=metrics.width,h=metrics.height,overflow=entryControlOverflow(z);
  const x=node.x*z+viewport.x,y=node.y*z+viewport.y,right=x+node.width*z,bottom=y+node.height*z,portGap=Math.max(24,20*z),cx=(x+right)/2,cy=(y+bottom)/2;
  // Passive entries belong near the edge, but their visual gutter must not
  // shrink the independent pointer targets at ports or the resize corner.
  // The resize handle is 24 screen px, centred at the inner corner. The model
  // caps borders at 4 world px; retain that maximum plus 2 screen px of slack.
  // Reserving it even on locked/folded objects is deliberately conservative.
  const resizeRadius=14+4*z,resize={x:right-resizeRadius,y:bottom-resizeRadius,width:resizeRadius*2,height:resizeRadius*2};
  const obstacles=[...avoid,{x,y,width:right-x,height:bottom-y},...[{x:cx,y},{x:cx,y:bottom},{x,y:cy},{x:right,y:cy}].map(p=>({x:p.x-portGap,y:p.y-portGap,width:2*portGap,height:2*portGap})),{x:right+19*z,y:cy-21*z,width:122*z,height:42*z},resize];
  const corners=(gap:number)=>[[right-w,y-gap-h],[x,y-gap-h],[right+gap,y],[right-w,bottom+gap],[x,bottom+gap],[x-w-gap,y],[right+gap,bottom-h],[x-w-gap,bottom-h]];
  const near=corners(4);
  // Two bounded along-edge alternatives clear the corner handle without
  // pushing an otherwise close entry into the document or the centre port.
  near.splice(4,0,[right-resizeRadius-w,bottom+4]);
  near.splice(8,0,[right+4,bottom-resizeRadius-h]);
  const points=[...near,...corners(portGap)];
  const clear=([l,t]:number[])=>l-overflow>=12&&l+w<=width-12&&t>=(dimensions.topReserve||60)&&t+h+overflow<=height-12&&!obstacles.some(r=>Math.min(l+w,r.x+r.width)>Math.max(l-overflow,r.x)+1e-7&&Math.min(t+h+overflow,r.y+r.height)>Math.max(t,r.y)+1e-7);
  const point=points.find(clear);
  if(point)return{scale,top:(point[1]-y)/z,right:(right-point[0]-w)/z};
  // A keyboard-focused entry retains a reachable target during resize. Other
  // entries yield to card selection instead of migrating across the canvas.
  return request.priority<2?cardControlLayout(node,viewport,width,height,1,{...dimensions,width:36+overflow,height:36+overflow,avoid:[...avoid,resize]}):{scale,top:0,right:0,suppressed:true};
}

/** Choose a vertical slot for floating formatting without moving its subject. */
export function formatToolbarTop(stageHeight:number,toolbarHeight:number,footerReserve:number,protectedRect?:CardControlRect,start=8):number{
  const max=Math.max(start,stageHeight-footerReserve-toolbarHeight-8),bounded=(n:number)=>Math.max(start,Math.min(max,n));
  if(!protectedRect)return start;
  const overlap=(top:number)=>Math.max(0,Math.min(top+toolbarHeight,protectedRect.y+protectedRect.height)-Math.max(top,protectedRect.y));
  const options=[start,bounded(protectedRect.y-toolbarHeight-12),bounded(protectedRect.y+protectedRect.height+12)];
  return options.sort((a,b)=>overlap(a)-overlap(b)||Math.abs(a-start)-Math.abs(b-start))[0];
}

/** Allocate visible docks once in a stable order. Focus precedes selection;
 * remaining requests retain board order. Later docks reserve the earlier box,
 * so two independent avoidance passes cannot choose the same empty space. */
export function reserveCardControlDocks(requests:readonly CardControlDockRequest[],viewport:CardControlViewport,width:number,height:number):Map<string,CardControlPlacement>{
  const placements=new Map<string,CardControlPlacement>(),reserved:CardControlRect[]=[];
  for(const request of requests.map((request,index)=>({request,index})).sort((a,b)=>a.request.priority-b.request.priority||a.index-b.index).map(item=>item.request)){
    const {node,count,dimensions}=request,avoid=[...(dimensions.avoid||[]),...reserved],control=request.entry?localEntryPlacement(request,viewport,width,height,avoid):cardControlLayout(node,viewport,width,height,count,{...dimensions,avoid});
    const zoom=viewport.zoom,metrics=cardControlMetrics(count,dimensions.width,dimensions.height,dimensions.touchTargets);
    const overflow=request.entry?entryControlOverflow(zoom):0,w=metrics.width*control.scale*zoom+overflow,h=metrics.height*control.scale*zoom+overflow;
    const x=(node.x+node.width-control.right)*zoom+viewport.x-w,y=(node.y+control.top)*zoom+viewport.y;
    const intersects=(rect:CardControlRect)=>Math.min(x+w,rect.x+rect.width)>Math.max(x,rect.x)+1e-7&&Math.min(y+h,rect.y+rect.height)>Math.max(y,rect.y)+1e-7;
    const body={x:node.x*zoom+viewport.x,y:node.y*zoom+viewport.y,width:node.width*zoom,height:node.height*zoom};
    // An entry that cannot fit yields to the actual card's existing selection
    // path. It must never obscure an active action or reading body.
    const suppressed=!!control.suppressed||request.priority>=2&&[body,...(dimensions.avoid||[]),...reserved].some(intersects);
    placements.set(request.id,suppressed?{...control,suppressed:true}:control);
    // Overscan controls belong to offscreen objects and consume no visible slot.
    if(!suppressed&&node.x*zoom+viewport.x<width&&(node.x+node.width)*zoom+viewport.x>0&&node.y*zoom+viewport.y<height&&(node.y+node.height)*zoom+viewport.y>0)
      reserved.push({x:x-4,y:y-4,width:w+8,height:h+8});
  }
  return placements;
}

const finite=(value:number,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** The desktop dock has 28 px icons and optional 64 px labelled actions. On a
 * compact/coarse canvas only icons grow to 44 px; labels already meet the width
 * target. Keep this exact box shared by avoidance and the CSS touch attribute. */
export function cardControlMetrics(actionCount:number,width?:number,height=36,touchTargets=false):{width:number;height:number}{
  const count=Math.max(1,Math.floor(finite(actionCount,1))),baseWidth=Math.max(1,finite(width??32*count+4,36)),baseHeight=Math.max(1,finite(height,36));
  if(!touchTargets)return {width:baseWidth,height:baseHeight};
  const labels=Math.round(clamp((baseWidth-(32*count+4))/36,0,count));
  return {width:baseWidth+16*(count-labels),height:baseHeight+16};
}

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
export function cardControlLayout(node:CardControlRect,viewport:CardControlViewport,stageWidth:number,stageHeight:number,actionCount:number,dimensions?:CardControlDimensions):CardControlPlacement{
  const zoom=Number.isFinite(viewport.zoom)&&viewport.zoom>0?viewport.zoom:1;
  const metrics=cardControlMetrics(actionCount,dimensions?.width,dimensions?.height,dimensions?.touchTargets),scale=dimensions?.touchTargets?1/zoom:clamp(1/zoom,.4,2),requestedHeight=metrics.height;
  // The early offscreen/overflow fallback must itself remain valid CSS geometry.
  const dockHeight=Number.isFinite(requestedHeight*scale)?requestedHeight:36;
  const topReserve=Math.max(0,finite(dimensions?.topReserve??60,60)),fallback={scale,top:-dockHeight*scale-20,right:0};
  const width=metrics.width*scale*zoom,height=dockHeight*scale*zoom;
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
    // Dense touch boards may reserve dozens of docks. Bound the candidate
    // search rather than multiplying every obstacle edge by every other edge.
    // Keep viewport boundaries and the nearest edges, then at most 64 corners.
    const axis=(values:number[],origin:number,min:number,max:number)=>[...new Set([origin,min,max,...[...new Set(values)].sort((a,b)=>Math.abs(a-origin)-Math.abs(b-origin))])].slice(0,8);
    // Grid neighbours share many projected edges. Evaluate each coordinate
    // once before testing it against every visible body/port obstacle.
    const uniqueX=[...new Set(xs)],uniqueY=[...new Set(ys)];
    const nearbyX=axis(uniqueX,left,minX,maxX),nearbyY=axis(uniqueY,top,minY,maxY);
    let next=nearest([...uniqueX.map(a=>[a,top]),...uniqueY.map(b=>[left,b])]);
    if(!next){
      const points=obstacles.length<=24?uniqueX.flatMap(a=>uniqueY.map(b=>[a,b])):nearbyX.flatMap(a=>nearbyY.map(b=>[a,b]));
      const covered=(point:readonly number[])=>obstacles.reduce((sum,rect)=>sum+overlap(point,rect),0);
      next=nearest(points)||points.sort((a,b)=>covered(a)-covered(b)||travel(a)-travel(b))[0];
    }
    [left,top]=next;
  }
  const result={scale,top:(top-y)/zoom,right:(nodeRight-left-width)/zoom};
  return Object.values(result).every(Number.isFinite)?result:fallback;
}
