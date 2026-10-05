import test from 'node:test'
import assert from 'node:assert/strict'
import { courseSearchSections } from '../course-search.mjs'
test('original headings and paragraph text are included in course search',()=>{
 const s=courseSearchSections('/sites/sub2api/learn/codex/ch04.md','<h1>第一次对话</h1>\n<section id="s2"><h2>四要素</h2><p>任务・范围・材料・期望</p></section>')
 assert.equal(s.length,1);assert.equal(s[0].anchor,'');assert.deepEqual(s[0].titles,['第一次对话'])
 assert.match(s[0].text,/任务・范围・材料・期望/)
})
test('Windows source paths and prompts are recognized',()=>{
 assert.equal(courseSearchSections('C:\\sites\\newapi\\learn\\codex\\prompts.md','<h1>提示词库</h1><p>示例</p>').length,1)
})
test('normal Markdown keeps the native section splitter',()=>{
 assert.equal(courseSearchSections('/sites/sub2api/guide/start.md','<h1>开始</h1>'),undefined)
 assert.equal(courseSearchSections('/sites/sub2api/learn/codex/index.md','<h1>课程</h1>'),undefined)
})
test('empty or unheaded documents do not create phantom search entries',()=>{
 assert.deepEqual(courseSearchSections('/sites/sub2api/learn/codex/ch01.md',''),[])
 assert.deepEqual(courseSearchSections('/sites/sub2api/learn/codex/ch01.md','<p>x</p>'),[])
})
