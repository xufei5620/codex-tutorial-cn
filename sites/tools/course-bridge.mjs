// Import pages from the frozen offline course at build time. Never rewrite its source.
import fs from 'node:fs'
import path from 'node:path'
import { COURSE_END } from './course-html.mjs'
export function rewriteCourseLinks(html,ids) {
 const valid=new Set([...ids,'home','index'])
 return html.replace(/\{\{?link:([^}]+)\}\}?/g,(_,ref)=>{
  const [id,hash='']=ref.split('#');if(!valid.has(id))throw Error('课程跨页引用未知：'+ref)
  return '/learn/codex/'+(['index','home'].includes(id)?'':id)+(hash?'#'+hash:'')
 }).replace(/(href|src)=(['"])(?:\.\/)?(?:\.\.\/)?assets\/([^'"]+)\2/g,(_,attr,q,v)=>`${attr}=${q}/img/course/${v}${q}`)
 .replace(/href=(['"])(ch\d{2}|prompts|index)\.html(#[^'"]*)?\1/g,(_,q,id,hash='')=>`href=${q}/learn/codex/${id==='index'?'':id}${hash}${q}`)
}
// The offline course is frozen and its chapters are no longer published on the sites; only the
// prompt library page is still imported from it.
export function stagePrompts(repositoryRoot) {
 const manifest=path.join(repositoryRoot,'src','chapters.json')
 if(!fs.existsSync(manifest))throw Error('缺少原课程 src/chapters.json；必须在原仓库构建，不发布空页面。')
 const meta=JSON.parse(fs.readFileSync(manifest,'utf8')).extras?.prompts
 if(!meta?.title)throw Error('缺少提示词库标题：src/chapters.json extras.prompts')
 const p=path.join(repositoryRoot,'src','content','prompts.html');if(!fs.existsSync(p))throw Error('缺少提示词库正文：'+p)
 const body=rewriteCourseLinks(fs.readFileSync(p,'utf8'),['prompts'])
 if(/<script\b|<iframe\b|\son\w+\s*=/i.test(body))throw Error('prompts 含执行脚本或嵌入内容，需人工审阅')
 if(body.includes('<!-- xm-course-end -->'))throw Error('prompts 使用了保留的课程边界标记')
 if(body.includes('/img/course/'))throw Error('提示词库引用了 assets/ 图片，站点不再复制这些文件')
 return {
  pages:[['learn/codex/prompts.md',`---\ntitle: ${JSON.stringify(meta.title)}\noutline: false\n---\n\n<div class="xm-course-body" v-pre>\n${body}\n${COURSE_END}\n\n[课程目录](/learn/codex/) · [本站接入方法](/clients/codex) · [实践练习](/learn/first-task)\n`]],
  sidebar:[{text:meta.title,link:'/learn/codex/prompts'}]
 }
}
