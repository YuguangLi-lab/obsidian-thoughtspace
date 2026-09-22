/** Keep the chosen width; the node and its rendered media share one aspect ratio. */
export function mediaDimensions(width:number,naturalWidth:number,naturalHeight:number){
 if(![width,naturalWidth,naturalHeight].every(v=>Number.isFinite(v)&&v>0))return undefined;
 const ratio=naturalHeight/naturalWidth;if(!Number.isFinite(ratio)||ratio<=0)return undefined;
 const fittedWidth=Math.max(80,width,60/ratio),height=fittedWidth*ratio;
 if(!Number.isFinite(fittedWidth)||!Number.isFinite(height))return undefined;
 return {width:fittedWidth,height};
}
