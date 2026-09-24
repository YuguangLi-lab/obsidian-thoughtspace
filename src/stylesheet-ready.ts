/** Obsidian loads plugin CSS after onload; early previews must wait for the actual cascade. */
export function whenBoardStylesReady(root:HTMLElement,ready:()=>void):()=>void {
 let stopped=false;
 const observer=new MutationObserver(check);
 function check(){
  if(stopped||!root.isConnected||getComputedStyle(root).getPropertyValue('--ts-board-layout-ready').trim()!=='1')return;
  stopped=true;observer.disconnect();ready();
 }
 observer.observe(root.ownerDocument.documentElement,{childList:true,subtree:true,characterData:true});
 check();
 return()=>{stopped=true;observer.disconnect();};
}
