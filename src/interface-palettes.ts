/** Palette values adapted from the attributed projects in docs/INTERFACE-PALETTES.zh-CN.md.
 * ThoughtSpace's layout and semantic mapping are independent implementations. */
export const interfacePaletteIds=['paper','neutral','nord','catppuccin','tokyo','ayu'] as const;
export type InterfacePaletteId=typeof interfacePaletteIds[number];
export type InterfaceMode='auto'|'light'|'dark';
export interface InterfacePalette {sheet:string;paper:string;ink:string;muted:string;line:string;wash:string;editorial:string;edge:string;shadow:string;accent:string}
const make=(sheet:string,paper:string,ink:string,muted:string,line:string,wash:string,edge:string,accent:string):InterfacePalette=>({sheet,paper,ink,muted,line,wash,edge,accent,editorial:muted,shadow:'0 2px 8px #0000000a'});
export const interfacePalettes:Record<InterfacePaletteId,{name:readonly[string,string];description:readonly[string,string];light:InterfacePalette;dark:InterfacePalette}>={
 paper:{name:['暖白纸张','Warm paper'],description:['原来的纸张配色，温和留白','The original warm paper finish'],light:make('#fffdf8','#f6f4ee','#272a25','#67675f','#dedcd3','#eeece4','#868e8b','#356859'),dark:make('#20211e','#252620','#e9ebdf','#b9bcaf','#3c3e35','#2c2d27','#717d79','#94c8b6')},
 neutral:{name:['中性白灰','Neutral'],description:['参考 GitHub Primer，干净的中性色','Inspired by GitHub Primer neutrals'],light:make('#ffffff','#f6f8fa','#1f2328','#59636e','#d1d9e0','#eaeef2','#818b98','#0863cf'),dark:make('#0d1117','#161b22','#f0f6fc','#b1bac4','#3d444d','#212830','#818b98','#79c0ff')},
 nord:{name:['北境蓝灰','Nord'],description:['冰蓝与灰阶，清晰安静','Arctic blue and quiet gray'],light:make('#eceff4','#e5e9f0','#2e3440','#4c566a','#b9c3d0','#d8dee9','#687b94','#3b617d'),dark:make('#3b4252','#2e3440','#eceff4','#d8dee9','#5b667c','#434c5e','#88c0d0','#98c9d7')},
 catppuccin:{name:['柔雾紫灰','Catppuccin'],description:['Latte / Mocha 柔和底色','Soft Latte / Mocha surfaces'],light:make('#eff1f5','#e6e9ef','#4c4f69','#5c5f77','#acb0be','#dce0e8','#7c7f93','#7628d8'),dark:make('#1e1e2e','#181825','#cdd6f4','#bac2de','#585b70','#313244','#9399b2','#cba6f7')},
 tokyo:{name:['东京暮蓝','Tokyo Night'],description:['Day / Storm 蓝紫层次','Day / Storm blue-violet layers'],light:make('#f3f4f8','#e1e2e7','#343b58','#4c567b','#a8aecb','#d0d5e3','#6172b0','#34548a'),dark:make('#24283b','#1f2335','#c0caf5','#a9b1d6','#565f89','#292e42','#737aa2','#7aa2f7')},
 ayu:{name:['晴空雾蓝','Ayu blue'],description:['参考 Ayu，清亮底色与蓝色操作','Ayu surfaces with blue actions'],light:make('#fcfcfc','#f8f9fa','#343d47','#5c6166','#cad1d8','#ebeef0','#6b7d8f','#086b9e'),dark:make('#10141c','#0d1017','#bfbdb6','#a3afbf','#3c4757','#141821','#7e8fa2','#59c2ff')},
};
export const cleanInterfacePalette=(value:unknown):InterfacePaletteId=>interfacePaletteIds.includes(value as InterfacePaletteId)?value as InterfacePaletteId:'paper';
export const cleanInterfaceMode=(value:unknown):InterfaceMode=>value==='light'||value==='dark'?value:'auto';
