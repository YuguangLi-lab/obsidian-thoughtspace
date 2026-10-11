export type BoardTouchTarget='input'|'reading'|'canvas';

/** Use the touched surface, not the card kind: rendered Markdown can contain
 * native links, editors and media controls. Those retain their own gestures.
 * A card's title/chrome and resize handles remain the canvas drag affordance. */
export function boardTouchTarget(target:Pick<Element,'closest'>):BoardTouchTarget {
 if(target.closest('a,input,textarea,select,button,video,audio,iframe,.ts-av-player,[contenteditable]:not([contenteditable=false]),.ts-inline-editor,.cm-editor,[data-mindmap-interactive]'))return 'input';
 if(target.closest('.ts-resize,.ts-node-header,.ts-compact-fold-row'))return 'canvas';
 if(target.closest('.ts-card-preview,.ts-text-body,.ts-portal-preview,.ts-pdf-preview'))return 'reading';
 return 'canvas';
}
