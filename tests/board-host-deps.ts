import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as documents from '../src/board-document';
import {isBoardPath} from '../src/board-path';
import {isWorkspaceFile} from '../src/workspace';

const parseYaml=(createRequire(import.meta.url)('js-yaml') as {load:documents.YamlParser}).load;
const source=readFileSync('src/main.ts','utf8'),begin=source.indexOf('function isBoardFile('),end=source.indexOf('\nconst report =',begin);
if(begin<0||end<=begin)throw Error('Actual production board-file classifier is missing');
const isBoardFile=new Function('isWorkspaceFile','EXT','isMarkdownBoardFrontmatter',transformSync(source.slice(begin,end)+'\nreturn isBoardFile;',{loader:'ts'}).code)(isWorkspaceFile,'thoughtspace',documents.isMarkdownBoardFrontmatter) as (app:unknown,file:unknown)=>boolean;

/** Dependencies for extracting actual main methods; no filename-only Markdown classifier. */
export const boardHostDeps={...documents,isBoardPath,isBoardFile,isWorkspaceFile,parseYaml};
