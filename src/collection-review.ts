import {collectionLocalDay,parseCollectionDay} from './collection-calendar';
export const REVIEW_VERSION='thoughtspace_review_version';
export const REVIEW_ON='thoughtspace_review_on';
export interface CollectionReview {on?:string;issue?:string}
/** Both namespaced fields form an opt-in record. Missing/foreign values are never adopted. */
export function readCollectionReview(value:unknown):CollectionReview {
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 const fm=value as Record<string,unknown>,version=Object.hasOwn(fm,REVIEW_VERSION),date=Object.hasOwn(fm,REVIEW_ON);
 if(!version&&!date)return {};
 const raw=fm[REVIEW_ON],on=raw instanceof Date&&Number.isFinite(raw.getTime())&&raw.toISOString().endsWith('T00:00:00.000Z')?raw.toISOString().slice(0,10):raw;
 if(fm[REVIEW_VERSION]!==1||typeof on!=='string'||!parseCollectionDay(on))return {issue:'回顾属性格式或版本无法确认，请在原生 Properties 中核对；未自动改写。'};
 return {on};
}
export function reviewDayAfter(now:Date,days:number):string {
 if(!Number.isFinite(now.getTime())||!Number.isInteger(days)||days<0||days>3650)throw Error('回顾日期无效');
 return collectionLocalDay(new Date(now.getFullYear(),now.getMonth(),now.getDate()+days,12));
}
export function isReviewDue(record:{reviewOn?:string;reviewIssue?:string},today=collectionLocalDay(new Date())):boolean {
 return !record.reviewIssue&&!!record.reviewOn&&!!parseCollectionDay(record.reviewOn)&&record.reviewOn<=today;
}
