export function remoteImageUrl(value:unknown):string|undefined{
 if(typeof value!=='string'||value.length>8192||/[\s\\<>]/.test(value))return;
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&url.hostname)return url.href;}catch{}
}
export function imageMarkdown(url:string){const valid=remoteImageUrl(url);if(!valid)throw Error('图床地址必须是有效的 HTTPS 图片链接');return `![](${valid.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;}

export interface ImageHostApi {
 version: 1;
 status(): {ready:boolean};
 upload(request:{consumer:'thoughtspace';sourcePath:string;name:string;mimeType:string;bytes:ArrayBuffer}):Promise<{url:string}>;
}
export function imageHostApi(app:unknown):ImageHostApi|undefined{
 const api=(app as {plugins?:{plugins?:Record<string,{imageHostApi?:ImageHostApi}>}})?.plugins?.plugins?.['fast-image-bed']?.imageHostApi;
 return api?.version===1&&typeof api.upload==='function'&&typeof api.status==='function'?api:undefined;
}
export async function uploadHostedImage(app:unknown,bytes:ArrayBuffer,name:string,sourcePath:string,mimeType=''){
 const api=imageHostApi(app);
 if(!api)throw Error('请在当前笔记库启用极速图床 0.9.0 或更新版本');
 if(!api.status().ready)throw Error('请先在极速图床设置中选择并配置 COS');
 let result:{url:string};
 try{result=await api.upload({consumer:'thoughtspace',sourcePath,name,mimeType,bytes});}
 catch{throw Error('极速图床上传失败，请检查图床配置和网络');}
 const url=remoteImageUrl(result?.url);if(!url)throw Error('极速图床未返回有效的 HTTPS 图片地址');return url;
}
