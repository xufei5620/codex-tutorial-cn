// v5.4 implementation of the approved learning preview. No publishing or network writes.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {build,ROOT,markGenerated} from '../tools/prebuild.mjs'
const HERE=path.dirname(fileURLToPath(import.meta.url))
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const plain=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim()
const CAPTURE_POLICY={
 ch01:['none','none','none','required','optional'],
 ch02:['none','required','none','none','optional','required','none','none','required','none'],
 ch03:['none','optional','optional','required'],
 ch04:['none','required','required','required','optional'],
 ch05:['required','optional','required','optional','optional','none'],
 ch06:['none','required','required','none'],
 ch07:['none','optional','required','none'],
 ch08:['optional','required','none','required'],
 ch09:['required','required','required','optional'],
 ch10:['optional','required','required','optional'],
 ch11:['none','required','none','optional']
}
export function capturePolicy(section,body,chapterId,index){
 if(['required','optional','none'].includes(section.capturePolicy))return section.capturePolicy
 return CAPTURE_POLICY[chapterId]?.[index] || (section.unitId||/<ol\b/i.test(body)?'optional':section.visual?'optional':'none')
}
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const readContent=file=>json(path.join(HERE,'content',file))
function safeProse(html){if(/<\s*(script|iframe|object|embed)\b|\son\w+\s*=|(?:href|src)\s*=\s*['"]\s*javascript:/i.test(html))throw Error('Unexpected executable markup in course source');return html}
export function integrate(unit){const p=s=>String(s).split(/\n\n+/).map(t=>'<p>'+esc(t)+'</p>').join('');const block=(title,text)=>'<h3>'+title+'</h3><pre>'+esc(text)+'</pre>';return '<aside class="edu-note">'+esc(unit.scope)+'</aside>'+p(unit.officialCore)+'<h3>跟着做</h3><ol>'+unit.steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol>'+block('练习材料 · 虚构示例',unit.material)+block('可以直接试的请求',unit.prompt)+'<details class="practice-reference"><summary>展开参考与检查标准</summary>'+p(unit.reference)+'<ul>'+unit.checks.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul></details>'}
export function addShots(html,prefix,context,manifest){let stack=[],offsets=[],item=null;const tags=/<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;let match;while((match=tags.exec(html))){const name=match[1].toLowerCase(),closing=match[0][1]==='/';if(!closing){if(name==='li'&&stack.includes('ol')&&!stack.includes('li'))item={start:tags.lastIndex,depth:stack.length};if(!/^(br|hr|img|input|meta|link|source|area|wbr|col)$/.test(name)&&!match[0].endsWith('/>'))stack.push(name)}else{const n=stack.lastIndexOf(name);if(name==='li'&&item&&n===item.depth){offsets.push({at:match.index,title:plain(html.slice(item.start,match.index)).slice(0,180)});item=null}if(n>=0)stack.length=n}}
 function slot(id,title,optional){const spec={id,route:context.route,group:context.group,section:context.section,title:title.slice(0,90),target:'请拍摄这一步的真实操作或结果：'+title.slice(0,180),highlight:'保留相关控件、文件名和结果；上传前遮盖账号、密钥、验证码与个人资料。',optional,capturePolicy:context.capturePolicy||'optional',siteOnly:!!context.siteOnly,label:context.section,product:'按实际产品填写'};manifest.push(spec);return '<div class="ss-shot-host" data-shot-id="'+id+'"><div class="shot-skeleton">▧ 此步骤待补充真实截图 · '+esc(spec.title)+'</div></div>'}
 if(!offsets.length)return html+slot(prefix+'-overview',context.section,true)
 let out=html;for(let i=offsets.length-1;i>=0;i--){const id=prefix+'-step'+String(i+1).padStart(2,'0');out=out.slice(0,offsets[i].at)+slot(id,offsets[i].title,false)+out.slice(offsets[i].at)}return out
}
function routeRewrites(html){return html.replace(/href="#\/skills"/g,'href="/skills"').replace(/href="#\/atlas\/[^"\s]+"/g,'href="/learn/codex/ch07#s2"').replace(/href="#\/chapter\/(ch\d+)\?s=(\d+)"/g,(_,c,s)=>'href="/learn/codex/'+c+'#s'+(Number(s)+1)+'"')}
export function addDocumentShots(text,{rel,route,title},manifest){
 let section=0,step=0,fence=null
 for(const line of text.split(/\r?\n/)){
  let codeLine=!!fence
  if(fence){
   const close=line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/)
   if(close&&close[1][0]===fence[0]&&close[1].length>=fence.length)fence=null
  }else{
   const open=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
   if(open&&(open[1][0]==='~'||!open[2].includes('`'))){fence=open[1];codeLine=true}
  }
  // Keep legacy counters, including code examples, so existing real-step backup IDs do not shift.
  if(/^##\s/.test(line)){section++;step=0}
  if(/^\d+[.)]\s+/.test(line)){
   step++
   if(codeLine)continue
   const label=plain(line.replace(/^\d+[.)]\s+/,''))
   manifest.push({id:'doc-'+rel.replace(/\.md$/,'').replaceAll('/','-')+'-s'+String(section||1).padStart(2,'0')+'-step'+String(step).padStart(2,'0'),route,group:title,section:label,title:label.slice(0,90),target:label,highlight:'本站操作截图不能带入另一站。',optional:false,capturePolicy:'required',siteOnly:true})
  }
 }
}
function applyStudioNav(dir,catalog){
 const navFile=path.join(dir,'nav.generated.json'),nav=json(navFile)
 for(const item of nav.nav||[]){
  if(item.link==='/learn/codex/')item.text='Codex 零基础'
 }
 const sidebar=nav.sidebar||[]
 const courseIdx=sidebar.findIndex(group=>['Codex 零基础','Codex 零基础课程','Codex 图文','Codex 图文教程'].includes(group.text))
 const oldItems=courseIdx>=0?sidebar[courseIdx].items||[]:[]
 const extras=oldItems.filter(item=>item.link&&!item.link.startsWith('/learn/codex/ch')&&item.link!=='/learn/codex/')
 const partGroups=[{
  text:'Codex 零基础',
  items:catalog.chapters.map(ch=>({
   text:String(ch.n).padStart(2,'0')+' · '+ch.shortTitle,
   link:'/learn/codex/'+ch.id
  }))
 }]
 const course=[
  {text:'课程目录',items:[{text:'从界面到交付',link:'/learn/codex/'}]},
  ...partGroups,
  ...(extras.length?[{text:'配套练习',items:extras}]:[])
 ]
 nav.sidebar=courseIdx>=0?[...sidebar.slice(0,courseIdx),...course,...sidebar.slice(courseIdx+1)]:[...course,...sidebar]
 fs.writeFileSync(navFile,JSON.stringify(nav,null,2)+'\n')
}
export function attachCourseFigures(chapter,manifest=[]){
 let total=0
 chapter.sections=(chapter.sections||[]).map((section,index)=>{
  let n=0
  const body=String(section.body||'').replace(/<figure class="yichen-figure">([\s\S]*?)<\/figure>/g,(full,inner)=>{
   const src=inner.match(/\bsrc="([^"]+)"/)?.[1]||''
   if(!src)return full
   n++
   total++
   const alt=inner.match(/\balt="([^"]*)"/)?.[1]||section.title||'配图'
   const id='fig-'+chapter.id+'-s'+String(index+1).padStart(2,'0')+'-'+String(n).padStart(2,'0')
   manifest.push({id,route:'/learn/codex/'+chapter.id,group:chapter.shortTitle||chapter.title,section:section.title||'正文',title:String(alt).slice(0,90),target:'可用本机截图替换这张课程配图',highlight:'替换后只保存在本机，不会发布到网站。',optional:true,capturePolicy:'published',siteOnly:false,fallback:src})
   return '<div class="course-shot" data-shot-id="'+esc(id)+'">'+full+'</div>'
  })
  return {...section,body}
 })
 if(!chapter.imageCount)chapter.imageCount=total
 return chapter
}
function loadYichenCourse(){
 const catalog=readContent('yichen/catalog.json')
 const chapters=catalog.chapters.map(meta=>{
  const ch=readContent('yichen/chapters/'+meta.id+'.json')
  return {
   ...meta,
   ...ch,
   sections:(ch.sections||[]).map((section,index)=>({
    ...section,
    title:section.title||'',
    body:routeRewrites(safeProse(section.body||'')),
    anchor:'s'+(index+1),
    capturePolicy:'none',
    kind:'read'
   }))
  }
 })
 return {catalog,chapters}
}
export function prepare(id){build(id);const dir=path.join(ROOT,id),site=json(path.join(dir,'site.json')),publicSite=json(path.join(dir,'site.generated.json'));const units=[...readContent('units-1.json'),...readContent('units-2.json'),...readContent('units-3.json')],sources=readContent('sources.json'),manifest=[];sources.yichen={title:'逸尘 Codex 图文教程（社区原文，已去引流内容）',url:'https://github.com/xianyu110/awesome-codex-tutorial/tree/master/tutorials/yichen-codex-articles',kind:'社区教程整理',checked:'2026-09-12'};const {catalog,chapters}=loadYichenCourse();
 for(const ch of chapters)attachCourseFigures(ch,manifest)
 const write=(name,content)=>{const f=path.join(dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,content)};
 const courseDir=path.join(dir,'learn/codex')
 for(const ch of chapters){write('learn/codex/'+ch.id+'.md',markGenerated('---\ntitle: '+JSON.stringify(ch.title)+'\noutline: false\n---\n\n<StudioChapter chapter-id="'+ch.id+'" />\n'))}
 if(fs.existsSync(courseDir)){
  const keep=new Set(chapters.map(ch=>ch.id+'.md'))
  for(const name of fs.readdirSync(courseDir)){
   if(/^ch\d+\.md$/.test(name)&&!keep.has(name))fs.unlinkSync(path.join(courseDir,name))
  }
 }
 write('learn/codex/index.md',markGenerated('---\ntitle: Codex 零基础\noutline: false\n---\n<StudioHub kind="course" />\n'));
 applyStudioNav(dir,catalog)
 // Preserve the existing site-specific account text separately from the new dashboard.
 write('guide/account.md',markGenerated(fs.readFileSync(path.join(dir,'guide/start.md'),'utf8')));
 write('skills.md',markGenerated('---\ntitle: Skill 动手工坊\noutline: false\n---\n<SkillWorkshop />\n'));
 write('tools.md',markGenerated('---\ntitle: 管理工具\noutline: false\nhead:\n  - - meta\n    - http-equiv: refresh\n      content: 0;url=/guide/manager\n---\n<script setup>\nimport { onMounted } from \'vue\'\nonMounted(()=>{location.replace(\'/guide/manager\')})\n</script>\n\n本页已并入 [管理工具](/guide/manager)。\n'));
 write('screenshots.md',markGenerated('---\ntitle: 截图管理\noutline: false\nsearch: false\n---\n<ScreenshotCatalog />\n'));
 const industryDir=path.join(dir,'industry')
 if(fs.existsSync(industryDir)){
  for(const name of fs.readdirSync(industryDir)){
   if(name.endsWith('.md'))fs.unlinkSync(path.join(industryDir,name))
  }
 }
 for(const [id,title]of [['skills-editor','保存 SKILL.md'],['skills-install','确认技能目录与发现'],['skills-test','按技能检查一次结果']])manifest.push({id,route:'/skills',group:'Skill 动手工坊',section:title,title,target:'按当前产品记录'+title+'的实际界面',optional:true,capturePolicy:'optional',siteOnly:false});
 // Supplement all legacy operation pages, without changing their Markdown or business answers.
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')||['public','overrides'].includes(e.name)?[]:e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 const docs=[];for(const f of walk(dir).filter(f=>f.endsWith('.md'))){const rel=path.relative(dir,f).replaceAll('\\','/'),route='/'+rel.replace(/index\.md$/,'').replace(/\.md$/,'');if(rel.startsWith('learn/codex/')||rel.startsWith('industry/')||['skills.md','screenshots.md','tools.md'].includes(rel))continue;const text=fs.readFileSync(f,'utf8'),title=text.match(/^#\s+(.+)$/m)?.[1]||rel;docs.push({route,title,text:plain(text).slice(0,22000)});if(['errors.md','faq.md','contact.md'].includes(rel))continue;addDocumentShots(text,{rel,route,title},manifest)}
 const images=path.join(HERE,'screenshots',id+'.json');const shots=fs.existsSync(images)?json(images):{schema:'xingmang-screenshots/1',version:'5.4',siteId:id,records:{}};if(shots.siteId!==id)throw Error('Screenshot site mismatch');
 const data={version:'5.4',site:{...publicSite,console_url:site.console_url,keys_url:site.keys_url,models_url:site.models_url},catalog,chapters,industries:[],sources,manifest,docs,shots,scope:{adaptedUnits:units.length,totalChapters:chapters.length,totalSections:chapters.reduce((n,c)=>n+c.sections.length,0),totalFigures:chapters.reduce((n,c)=>n+(c.imageCount||0),0),note:'课程目录与配图按逸尘图文教程组织；购买、套餐、中转和线下引流正文未收录。'}};
 if(new Set(manifest.map(s=>s.id)).size!==manifest.length)throw Error('Duplicate screenshot ID');
 write('studio.generated.json',JSON.stringify(data));write('public/studio/screenshot-map.json',JSON.stringify(manifest));console.log('STUDIO '+id+': '+chapters.length+' chapters / '+data.scope.totalSections+' sections / '+data.scope.totalFigures+' figures / '+manifest.length+' screenshot slots');return data
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))prepare(process.argv[2])
