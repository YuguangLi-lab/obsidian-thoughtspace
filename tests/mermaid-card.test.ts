import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MERMAID_SOURCE,mermaidMarkdown,mermaidSource} from '../src/mermaid-card';

test('standalone Mermaid detection preserves the source and accepts Markdown fence variants',()=>{
 assert.equal(mermaidSource('```mermaid\nflowchart TD\n A-->B\n```'),'flowchart TD\n A-->B');
 assert.equal(mermaidSource('\n  ~~~~ mermaid\r\nflowchart TD\r\n A-->B\r\n~~~~~ \t\r\n\n'),'flowchart TD\r\n A-->B');
 assert.equal(mermaidSource('```mermaid\n```'),'');
 assert.equal(mermaidSource('```mermaid\n\n```'),'');
});

test('ordinary Markdown, multiple blocks and malformed wrappers never enter the diagram editor',()=>{
 for(const text of ['text','```js\nA-->B\n```','```mermaid\nA-->B','```mermaid\nA-->B\n~~~','    ```mermaid\nA-->B\n```','# title\n```mermaid\nA-->B\n```','```mermaid\nA-->B\n```\ntext','```mermaid\nA-->B\n```\n```mermaid\nB-->C\n```','```mermaid extra\nA-->B\n```','````mermaid\nA-->B\n```'])assert.equal(mermaidSource(text),undefined,text);
});

test('safe wrapping round trips blank lines, Unicode and embedded fence-looking source',()=>{
 for(const source of [DEFAULT_MERMAID_SOURCE,'','\n','  flowchart TD\n\n','flowchart TD\r\n A-->B\r\n','flowchart TD\n%% ```\n A["``````"]-->B','sequenceDiagram\n甲->>乙: hello'])assert.equal(mermaidSource(mermaidMarkdown(source)),source);
 const source='flowchart TD\n```\n# stays inside source';assert.ok(mermaidMarkdown(source).startsWith('````mermaid\n'));assert.equal(mermaidSource(mermaidMarkdown(source)),source);
});
