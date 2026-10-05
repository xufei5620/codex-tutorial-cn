import test from 'node:test'
import assert from 'node:assert/strict'
import { courseHtmlPlugin, COURSE_END } from '../course-html.mjs'
function parserState(src, html = true) {
 const lines=src.split('\n'), bMarks=[], eMarks=[]; let offset=0
 for(const line of lines){bMarks.push(offset);eMarks.push(offset+line.length);offset+=line.length+1}
 const tokens=[]
 return {src,bMarks,eMarks,tShift:lines.map(s=>s.length-s.trimStart().length),line:0,
 md:{options:{html}},tokens,
 push(type,tag,nesting){const t={type,tag,nesting};tokens.push(t);return t},
 getLines(start,end){return src.slice(bMarks[start],end<lines.length?bMarks[end]:src.length)}}
}
function run(src, silent=false, html=true){
 let rule
 courseHtmlPlugin({block:{ruler:{before(name,id,fn){assert.equal(name,'html_block');rule=fn}}}})
 const state=parserState(src,html)
 const result=rule(state,0,state.bMarks.length,silent)
 return {result,state}
}
test('blank lines, nested tags and indented pre text remain one HTML token',()=>{
 const body='<div class="xm-course-body" v-pre>\n      <section><p>原稿</p>\n\n      <div><p>嵌套</p></div>\n      <pre>第一行\n\n    保留缩进与 {{示例}}\n</pre></section>\n'+COURSE_END+'\n'
 const {result,state}=run(body+'\n[下一章](/learn/codex/ch05)\n')
 assert.equal(result,true);assert.equal(state.tokens.length,1)
 assert.equal(state.tokens[0].type,'html_block');assert.equal(state.tokens[0].content,body)
 assert.ok(!state.tokens[0].content.includes('[下一章]'))
})
test('ordinary HTML blocks keep the standard Markdown behavior',()=>{
 assert.equal(run('<div>普通内容</div>\n').result,false)
})
test('unterminated generated course blocks fail instead of swallowing the page',()=>{
 assert.throws(()=>run('<div class="xm-course-body" v-pre>\n<p>x</p>\n'),/missing its end marker/)
})
test('silent validation creates no tokens and disabled HTML stays disabled',()=>{
 const text='<div class="xm-course-body" v-pre>\n<p>x</p>\n'+COURSE_END+'\n'
 assert.equal(run(text,true).state.tokens.length,0)
 assert.equal(run(text,false,false).result,false)
})
