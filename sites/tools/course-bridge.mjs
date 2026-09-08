// Import the original curriculum at build time. Never rewrite its source or review status.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function rewriteCourseLinks(html,ids) {
 const valid=new Set([...ids,'home','index'])
 return html.replace(/\{\{?link:([^}]+)\}\}?/g,(_,ref)=>{
  const [id,hash='']=ref.split('#');if(!valid.has(id))throw Error('课程跨页引用未知：'+ref)
  return '/learn/codex/'+(['index','home'].includes(id)?'':id)+(hash?'#'+hash:'')
 }).replace(/(href|src)=(['"])(?:\.\/)?(?:\.\.\/)?assets\/([^'"]+)\2/g,(_,attr,q,v)=>`${attr}=${q}/img/course/${v}${q}`)
 .replace(/href=(['"])(ch\d{2}|prompts|index)\.html(#[^'"]*)?\1/g,(_,q,id,hash='')=>`href=${q}/learn/codex/${id==='index'?'':id}${hash}${q}`)
}
export function stageCourse(repositoryRoot) {
 const manifest=path.join(repositoryRoot,'src','chapters.json')
 if(!fs.existsSync(manifest))throw Error('缺少原课程 src/chapters.json；必须在原仓库构建，不发布空课程。')
 const m=JSON.parse(fs.readFileSync(manifest,'utf8')),ids=m.parts?.flatMap(p=>p.chapters)||Object.keys(m.chapters||{})
 if(!ids.length||new Set(ids).size!==ids.length)throw Error('原课程章节清单为空或含重复 ID')
 const sourceList=[...ids,...(m.extras?.prompts?['prompts']:[])],pages=[],sources=[],sidebar=[]
 for(const id of sourceList){
  if(!/^(ch\d{2}|prompts)$/.test(id))throw Error('课程 ID 无效：'+id)
  const p=path.join(repositoryRoot,'src','content',id+'.html');if(!fs.existsSync(p))throw Error('缺少原课程正文：'+p)
  const raw=fs.readFileSync(p,'utf8'),meta=m.chapters[id]||m.extras[id]
  if(!meta?.title)throw Error('缺少课程标题：'+id)
  const body=rewriteCourseLinks(raw,sourceList)
  if(/<script\b|<iframe\b|\son\w+\s*=/i.test(body))throw Error(id+' 含执行脚本或嵌入内容，需人工审阅')
  pages.push(['learn/codex/'+id+'.md',`---\ntitle: ${JSON.stringify(meta.title)}\noutline: false\n---\n\n<div class="xm-course-body" v-pre>\n${body}\n</div>\n\n[课程目录](/learn/codex/) · [本站接入方法](/clients/codex) · [实践练习](/learn/first-task)\n`])
  sources.push({id,file:'src/content/'+id+'.html',sha256:crypto.createHash('sha256').update(raw).digest('hex'),status:meta.status||'unverified'})
  sidebar.push({text:(meta.num?String(meta.num).padStart(2,'0')+' · ':'')+meta.title,link:'/learn/codex/'+id})
 }
 const list=ids.map(id=>`| ${m.chapters[id].num} | [${m.chapters[id].title}](/learn/codex/${id}) | ${(m.chapters[id].desc||'').replace(/\|/g,'／')} |`).join('\n')
 pages.push(['learn/codex/index.md',`---\ntitle: Codex 零基础课程\ndescription: 从第一次对话到实际任务、插件、Skill 与结果检查。\n---\n# Codex 零基础课程\n\n这套课程讲“如何使用”，与 [安装接入教程](/clients/codex)互相衔接。第一次接触时从第 1 章开始；已经连接成功，可先做 [第一次任务练习](/learn/first-task)。\n\n::: info 阅读提示\n原课程正文和各章的审校状态保持不变。官方账号登录与本站 API 接入不是同一条认证路径；使用本站服务时先完成本站接入教程。界面与功能以实际安装版本为准，编辑审校不等于实机验证。\n:::\n\n| 章 | 内容 | 学习目标 |\n| --- | --- | --- |\n${list}\n\n${m.extras?.prompts?'[行业提示词库](/learn/codex/prompts)\n':''}\n## 配套实践\n\n[第一次任务](/learn/first-task) · [文件夹练习](/learn/working-with-files) · [结果检查与修改](/learn/review-and-revise) · [管理工具使用](/guide/manager)\n\n<details><summary>课程版本与维护来源</summary>\n\n内容源版本：${esc(m.site?.version||'未标注')}；源日期：${esc(m.site?.date||'未标注')}。读取本仓库 src/chapters.json 与 src/content，不替换原稿。\n\n</details>\n`])
 return {pages,sidebar,sources,version:m.site?.version||null}
}
