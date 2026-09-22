import { access, mkdir, cp, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) throw new Error('用法：node scripts/install.mjs "/Obsidian仓库绝对路径"');
const vault = path.resolve(input);
await access(path.join(vault, '.obsidian'));
const files = ['main.js','manifest.json','styles.css'];
const hashes = {};
for (const name of files) hashes[name] = createHash('sha256').update(await readFile(path.join(source,name))).digest('hex');
const target = path.join(vault, '.obsidian/plugins/thoughtspace');
let exists = false;
try { exists = (await stat(target)).isDirectory(); } catch(e) { if(e.code !== 'ENOENT') throw e; }
if (exists) {
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const backup = path.join(vault,'ThoughtSpace-plugin-backups',stamp);
  await mkdir(backup,{recursive:true}); await cp(target,path.join(backup,'thoughtspace'),{recursive:true});
  const previous={};for(const name of files){try{previous[name]=createHash('sha256').update(await readFile(path.join(target,name))).digest('hex')}catch{previous[name]='missing'}}
  await writeFile(path.join(backup,'SHA256.json'),JSON.stringify(previous,null,2));
  console.log('已备份旧版本：'+backup);
}
await mkdir(target,{recursive:true});
for (const name of files) await copyFile(path.join(source,name),path.join(target,name));
for (const name of files) { const actual=createHash('sha256').update(await readFile(path.join(target,name))).digest('hex'); if(actual!==hashes[name]) throw Error('安装校验失败：'+name); }
console.log('安装成功：'+target+'\n请在 Obsidian 第三方插件设置中启用 ThoughtSpace 思维白板。');
