import {Board,Card,clone,parseBoard} from './model';
import {mindmapRoot,layoutMindmap} from './mindmap';
import {topicRows,TopicResult} from './mindmap-editor';
import {sizeTemplateTopic} from './mindmap-sizing';
export function configureAutomaticTree(source:Board,id:string,enabled:boolean,fit?:(n:Card)=>void):TopicResult{
 const b=clone(source),rootId=mindmapRoot(b,id),rows=topicRows(b,rootId),root=rows[0].node;
 if(rows.some(r=>r.node.locked))throw Error('主题树中有锁定对象，请先解锁再适配');
 root.mindmapRules={layout:root.mindmapRules?.layout||b.mindmapLayout||b.mindmapDirection||'right',density:root.mindmapRules?.density||b.mindmapDensity||'standard',automatic:enabled};
 if(enabled){for(const {node}of rows){if(node.kind==='text'){sizeTemplateTopic(node);if(!node.collapsed)fit?.(node);}}layoutMindmap(b,rootId);}
 parseBoard(JSON.stringify(b));return{board:b,root:rootId,selected:id};
}
