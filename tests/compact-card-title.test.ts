import test from 'node:test';
import assert from 'node:assert/strict';
import {compactCardTitleMatches,syncCardTitlePresentation} from '../src/compact-card-title';
import {cleanPluginSettings} from '../src/plugin-settings';
import {exportSettingsProfile,parseSettingsProfile,resetSettingsCategory} from '../src/settings-preferences';

class Element {
 classes=new Set<string>();attrs:Record<string,string>={};headings:Element[]=[];parent?:Element;
 constructor(public textContent:string|null='',public excluded=false){}
 classList={contains:(value:string)=>this.classes.has(value),toggle:(value:string,force:boolean)=>{if(force)this.classes.add(value);else this.classes.delete(value);return force;}};
 querySelectorAll(){return this.headings;}
 closest(){return this.excluded?this:undefined;}
 setAttribute(name:string,value:string){this.attrs[name]=value;}
 asElement(){return this as unknown as HTMLElement;}
}
const fixture=()=>{const card=new Element(),title=new Element('研究材料'),preview=new Element(),heading=new Element('研究材料');preview.headings=[heading];return{card,title,preview,heading};};

test('compact card titles are opt-in, persisted, portable and restored by card preference reset',()=>{
 assert.equal(cleanPluginSettings({}).compactDuplicateCardTitles,false);
 assert.equal(cleanPluginSettings({compactDuplicateCardTitles:true}).compactDuplicateCardTitles,true);
 for(const invalid of [null,'true',1,[],{}])assert.equal(cleanPluginSettings({compactDuplicateCardTitles:invalid}).compactDuplicateCardTitles,false);
 const settings=cleanPluginSettings({compactDuplicateCardTitles:true});
 assert.equal(parseSettingsProfile(exportSettingsProfile(settings)).compactDuplicateCardTitles,true);
 resetSettingsCategory(settings,'cards');assert.equal(settings.compactDuplicateCardTitles,false);
});
test('only the exact displayed first H1 text matches; distinct aliases and case keep the full title',()=>{
 assert.equal(compactCardTitleMatches('研究材料','研究材料',true),true);
 for(const heading of ['研究材料 2','研究 材料','研究材料。','',null,undefined])assert.equal(compactCardTitleMatches('研究材料',heading,true),false);
 assert.equal(compactCardTitleMatches('Research','research',true),false);
 assert.equal(compactCardTitleMatches('研究材料','研究材料',false),false);
 assert.equal(compactCardTitleMatches('研究材料',' 研究材料\n',true),true);
});
test('compaction changes only shell presentation and accessible label, preserving native H1 and anchor objects',()=>{
 const {card,title,preview,heading}=fixture();heading.attrs.id='研究材料';const original=preview.headings;
 assert.equal(syncCardTitlePresentation(card.asElement(),title.asElement(),preview.asElement(),true),true);
 assert.ok(card.classes.has('is-title-source-line'));assert.equal(title.attrs['aria-label'],'来源：研究材料；修改卡片标题');
 assert.equal(preview.headings,original);assert.equal(preview.headings[0],heading);assert.equal(heading.textContent,'研究材料');assert.equal(heading.attrs.id,'研究材料');assert.equal(title.textContent,'研究材料');
 assert.equal(syncCardTitlePresentation(card.asElement(),title.asElement(),preview.asElement(),false),false);
 assert.equal(card.classes.has('is-title-source-line'),false);assert.equal(title.attrs['aria-label'],'修改卡片标题');
});
test('embedded and quoted headings cannot suppress the source title; the first native H1 is authoritative',()=>{
 const {card,title,preview}=fixture();preview.headings=[new Element('研究材料',true),new Element('正文不同'),new Element('研究材料')];
 assert.equal(syncCardTitlePresentation(card.asElement(),title.asElement(),preview.asElement(),true),false);
 preview.headings=[new Element('嵌入标题',true),new Element('研究材料')];
 assert.equal(syncCardTitlePresentation(card.asElement(),title.asElement(),preview.asElement(),true),true);
 title.textContent='自定义标题';assert.equal(syncCardTitlePresentation(card.asElement(),title.asElement(),preview.asElement(),true),false);
 preview.headings=[];assert.equal(syncCardTitlePresentation(card.asElement(),title.asElement(),preview.asElement(),true),false);
});
test('folded and low-detail cards retain their complete title even if an old preview remains available',()=>{
 for(const state of ['is-compact-fold','is-folded','ts-node-summary']){
  const {card,title,preview}=fixture();card.classes.add(state);
  assert.equal(syncCardTitlePresentation(card.asElement(),title.asElement(),preview.asElement(),true),false,state);
 }
});
