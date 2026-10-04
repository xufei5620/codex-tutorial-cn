import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc'
import * as Vue from 'vue'
import * as ServerRenderer from 'vue/server-renderer'

const componentUrl=new URL('../theme/BrandIcon.vue',import.meta.url)
const source=fs.readFileSync(componentUrl,'utf8')
const {descriptor}=parse(source)
const script=compileScript(descriptor,{id:'brand-icon-test'})
const imports=[...source.matchAll(/import (\w+) from '(\.\/assets\/brands\/[^']+)'/g)]
const assets=new Map(imports.map(([,name,file])=>[name,new URL(file,componentUrl)]))

function render(props){
  const context={computed:Vue.computed}
  for(const [name,file] of assets)context[name]='/assets/'+file.pathname.split('/').at(-1)
  const code=script.content.replace(/^import .*$/gm,'').replace('export default {','globalThis.component = {')
  vm.runInNewContext(code,context)
  const state=context.component.setup(props,{expose(){}})
  const compiled=compileTemplate({source:descriptor.template.content,id:'brand-icon-test',filename:'BrandIcon.vue',ssr:true,ssrCssVars:[],compilerOptions:{bindingMetadata:script.bindings}})
  assert.deepEqual(compiled.errors,[])
  const renderCode=compiled.code.replace(/^import \{ (.*?) \} from "(.*?)"$/gm,(_,bindings,module)=>{
    for(const binding of bindings.split(', ')){
      const [name,alias]=binding.split(' as ')
      context[alias||name]=(module==='vue'?Vue:ServerRenderer)[name]
    }
    return ''
  }).replace('export function ssrRender','globalThis.render = function ssrRender')
  vm.runInNewContext(renderCode,context)
  let html=''
  context.render({},value=>{html+=value},null,{},props,Vue.proxyRefs(state),null,null)
  return html
}

test('all tool icons render local assets with decorative accessible defaults',()=>{
  const ids=['codex','claude-code','gemini-cli','grok-build','hermes','openclaw','opencode','deepseek-harness','cursor','vscode','openai','claude','manager']
  for(const name of ids){
    const html=render({name,size:24,label:''})
    assert.match(html,/<img /,name)
    assert.match(html,/src="\/assets\/[^"/]+"/,name)
    assert.match(html,/\salt(?:="")?\s/,name)
    assert.match(html,/aria-hidden="true"/,name)
    assert.match(html,/width="24" height="24"/,name)
  }
  const labelled=render({name:'codex',size:32,label:'OpenAI'})
  assert.match(labelled,/alt="OpenAI"/)
  assert.doesNotMatch(labelled,/aria-hidden/)
  for(const name of ['unknown','__proto__','constructor'])assert.doesNotMatch(render({name,size:24,label:''}),/<img /)
})

test('vendored brand images stay passive and keep local-only SVG references',()=>{
  for(const file of assets.values()){
    assert.ok(fs.statSync(file).size>0,file.pathname)
    if(!file.pathname.endsWith('.svg')){
      assert.deepEqual([...fs.readFileSync(file).subarray(0,8)],[137,80,78,71,13,10,26,10])
      continue
    }
    const svg=fs.readFileSync(file,'utf8')
    assert.match(svg,/^(?:<\?xml[^?]*\?>\s*)?<svg\b/)
    assert.doesNotMatch(svg,/<(?:script|foreignObject|iframe|object|embed|image|use|style|a|animate\w*|set)\b|\bon\w+\s*=|<!DOCTYPE|<!ENTITY|javascript:|data:/i,file.pathname)
    assert.doesNotMatch(svg,/\b(?:href|src)\s*=|@import|url\(\s*['"]?(?!#)/i,file.pathname)
  }
  assert.doesNotMatch(source,/v-html|https?:\/\//)
  const hub=fs.readFileSync(new URL('../theme/StudioHub.vue',import.meta.url),'utf8')
  assert.match(hub,/<BrandIcon :name="t\[0\]"/)
  assert.doesNotMatch(hub,/t\[1\]\.slice\(0,2\)/)
})
