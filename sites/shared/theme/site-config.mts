import { defineConfig } from 'vitepress'
import { readFileSync } from 'node:fs'
export function siteConfig(directory:URL) {
 // npm build/dev lifecycle always runs prebuild. Missing output is a build error, not a silent fallback.
 const site=JSON.parse(readFileSync(new URL('site.generated.json',directory),'utf8'))
 const nav=JSON.parse(readFileSync(new URL('nav.generated.json',directory),'utf8'))
 function cjkTokenize(text:string):string[]{const out:string[]=[];for(const m of text.matchAll(/[一-鿿㐀-䶿]+|[a-zA-Z0-9_./\-]+/g)){const s=m[0];if(/[一-鿿㐀-䶿]/.test(s)){for(let i=0;i<s.length;i++){out.push(s[i]);if(i+1<s.length)out.push(s.slice(i,i+2))}}else out.push(s.toLowerCase())}return out}
 return defineConfig({
  lang:'zh-CN',title:site.title,description:site.description,cleanUrls:true,lastUpdated:false,
  head:[['link',{rel:'icon',type:'image/png',href:'/logo.png'}],['meta',{name:'theme-color',content:'#0B1F3B'}],['meta',{name:'robots',content:'noindex'}],['meta',{name:'referrer',content:'no-referrer'}]],
  themeConfig:{logo:'/logo.png',siteTitle:site.name,site,contact:site.contact,nav:nav.nav,sidebar:nav.sidebar,
   outline:{label:'本页目录',level:[2,3]},docFooter:{prev:'上一篇',next:'下一篇'},sidebarMenuLabel:'目录',returnToTopLabel:'回到顶部',darkModeSwitchLabel:'外观',lightModeSwitchTitle:'切换到浅色',darkModeSwitchTitle:'切换到深色',
   search:{provider:'local',options:{miniSearch:{options:{tokenize:cjkTokenize},searchOptions:{tokenize:cjkTokenize,combineWith:'AND',prefix:false,fuzzy:0}},translations:{button:{buttonText:'搜索',buttonAriaLabel:'搜索'},modal:{noResultsText:'没有找到相关内容',resetButtonTitle:'清除',footer:{selectText:'打开',navigateText:'切换',closeText:'关闭'}}}}},
   footer:{message:'接入问题请先看排错指南，需要帮助时联系本站客服。',copyright:'© 2026 '+site.name}
  }
 })
}
