import {bindMobileViewport} from './mobile-viewport';

/** Bound the centering container, not the centered dialog: shrinking the dialog
 * first would move its top and repeatedly reduce the remaining keyboard space. */
export function bindBoardModalViewport(container:HTMLElement):()=>void {
 const win=container.ownerDocument.defaultView;
 if(!win||typeof win.requestAnimationFrame!=='function')return()=>{};
 const property='--ts-modal-visible-top',previous=container.style.getPropertyValue(property);
 const hadClass=container.classList.contains('ts-board-modal-viewport');container.classList.add('ts-board-modal-viewport');
 let frame=0,stopped=false;
 const refresh=()=>{frame=0;if(stopped)return;const top=win.visualViewport?.offsetTop??0;container.style.setProperty(property,(Number.isFinite(top)?Math.max(0,top):0)+'px');};
 const queue=()=>{if(!stopped&&!frame)frame=win.requestAnimationFrame(refresh);};
 refresh();
 win.visualViewport?.addEventListener('resize',queue);win.visualViewport?.addEventListener('scroll',queue);win.addEventListener('resize',queue);const unbind=bindMobileViewport(container);
 return()=>{if(stopped)return;stopped=true;win.cancelAnimationFrame(frame);unbind();win.visualViewport?.removeEventListener('resize',queue);win.visualViewport?.removeEventListener('scroll',queue);win.removeEventListener('resize',queue);if(previous)container.style.setProperty(property,previous);else container.style.removeProperty(property);if(!hadClass)container.classList.remove('ts-board-modal-viewport');};
}
