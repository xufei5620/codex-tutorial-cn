import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {addDocumentShots} from '../prepare.mjs'

function documentShots(text,rel){
 const manifest=[]
 addDocumentShots(text,{rel,route:'/'+rel.replace(/\.md$/,''),title:'操作教程'},manifest)
 return manifest
}

test('the actual handoff code sample does not create unreachable screenshot slots',()=>{
 const text=fs.readFileSync(new URL('../../shared/pages/learn/review-and-revise.md',import.meta.url),'utf8')
 assert.deepEqual(documentShots(text,'learn/review-and-revise.md'),[])
})

test('the actual recovery steps keep their existing screenshot IDs',()=>{
 const text=fs.readFileSync(new URL('../../shared/pages/guide/recovery.md',import.meta.url),'utf8')
 const shots=documentShots(text,'guide/recovery.md')
 assert.deepEqual(shots.map(s=>s.id),[1,2,3,4].map(n=>'doc-guide-recovery-s03-step0'+n))
 assert.equal(shots[0].title,'停止正在执行的任务并退出对应工具。')
 assert.ok(shots.every(s=>s.route==='/guide/recovery'&&s.siteOnly))
})

test('backtick and tilde examples are excluded without renumbering later real steps',()=>{
 const text=[
  '## 操作','1. 围栏前的真实步骤','````text','1. 示例请求',
  '```','2. 较短围栏不能提前结束示例','````','2. 围栏后的真实步骤',
  '## 下一节','   ~~~text','1. 波浪线示例','   ~~~~','1) 下一节真实步骤'
 ].join('\r\n')
 const shots=documentShots(text,'guide/fixture.md')
 assert.deepEqual(shots.map(s=>[s.id,s.title]),[
  ['doc-guide-fixture-s01-step01','围栏前的真实步骤'],
  ['doc-guide-fixture-s01-step04','围栏后的真实步骤'],
  ['doc-guide-fixture-s02-step02','下一节真实步骤']
 ])
})

test('an unclosed code fence cannot register the remaining example lines as steps',()=>{
 const shots=documentShots('## 操作\n1. 真实步骤\n```text\n1. 未结束的示例\n2. 仍是代码','guide/fixture.md')
 assert.deepEqual(shots.map(s=>s.id),['doc-guide-fixture-s01-step01'])
})

test('exported course chapter and section links resolve inside the downloaded HTML',async()=>{
 // Run the actual exporter; Node only needs substitutes for Vite raw CSS and browser download.
 const source=fs.readFileSync(new URL('../theme/offline-export.js',import.meta.url),'utf8')
  .replace(/^import .*$/gm,'').replace('export async function exportCourseHTML','async function exportCourseHTML')
 let output
 const context=vm.createContext({css:'',download:(name,html)=>{output={name,html}}})
 vm.runInContext(source,context)
 const chapter=(id,n,sections)=>({id,n,title:id,lead:'章节简介',goal:'完成练习',exercise:'练习',checks:[],sections})
 const body='<a href="/learn/codex/ch07#s2">跨章小节</a><a href="/learn/codex/ch07">章节</a><a href="#s1">当前小节</a><a href="/skills">在线工坊</a><a href="https://example.org/source">资料来源</a>'
 for(const site of [{id:'sub2api',domain:'docs-sub.solov.cc'},{id:'newapi',domain:'docs-new.solov.cc'}]){
  await context.exportCourseHTML({
   snapshot:()=>({siteId:site.id,records:{}}),
   data:{site,manifest:[],chapters:[chapter('ch03',3,[{anchor:'s1',title:'导航',body}]),chapter('ch07',7,[{anchor:'s2',title:'安装',body:'<p>目标小节</p>'}])]}
  },'reader')
  assert.equal(output.name,'course-'+site.id+'-v5.4-reader.html')
  const article=output.html.match(/<main id="studio-main">([\s\S]*?)<\/main>/)[1]
  const ids=new Set([...article.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]))
  const localLinks=[...article.matchAll(/href="#([^"]+)"/g)].map(m=>m[1])
  assert.deepEqual(localLinks,['ch07-s2','ch07','ch03-s1'])
  assert.ok(localLinks.every(id=>ids.has(id)),'Every offline chapter link must have an exported target')
  assert.ok(article.includes('href="https://'+site.domain+'/skills"'))
  assert.ok(article.includes('href="https://example.org/source"'))
  assert.ok(!article.includes('href="https://'+site.domain+'/learn/codex/'))
 }
})
