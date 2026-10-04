import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {render} from '../../tools/prebuild.mjs'
import {addDocumentShots} from '../prepare.mjs'

const pages=new URL('../../shared/pages/',import.meta.url)
const codex=fs.readFileSync(new URL('clients/codex.md',pages),'utf8').replace(/\r\n/g,'\n')

test('Codex setup renders the configured site endpoint and leaves model choice explicit',()=>{
  for(const id of ['newapi','sub2api']){
    const site=JSON.parse(fs.readFileSync(new URL('../../'+id+'/site.json',import.meta.url),'utf8'))
    const text=render(codex,{
      KEY_WORD:site.key_word,
      MODELS_URL:site.models_url,
      CODEX_BASE_URL:site.codex_base_url,
      CONSOLE_URL:site.console_url
    })
    const config=text.match(/```toml\n([\s\S]*?)\n```/)?.[1]
    assert.ok(config)
    assert.ok(config.includes('base_url = "'+site.codex_base_url+'"'))
    assert.ok(config.includes('wire_api = "responses"'))
    assert.ok(config.includes('model = "REPLACE_WITH_MODEL_ID"'))
    assert.equal(/sandbox_mode|network_access|\[features\]|review_model/.test(config),false)
  }
})

test('beginner install commands do not prescribe npm elevation or execution policy changes',()=>{
  for(const name of ['codex','claude-code','nodejs']){
    const text=fs.readFileSync(new URL('clients/'+name+'.md',pages),'utf8').replace(/\r\n/g,'\n')
    const commands=[...text.matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)].map(match=>match[1]).join('\n')
    assert.equal(/sudo\s+npm\s+install|Set-ExecutionPolicy|danger-full-access/i.test(commands),false,name)
  }
})

test('beginner course does not recommend full access or silently select official login',()=>{
  const chapters=[1,2].map(n=>JSON.parse(fs.readFileSync(new URL('../content/yichen/chapters/ch0'+n+'.json',import.meta.url),'utf8')))
  const prose=chapters.flatMap(ch=>ch.sections.map(section=>section.body)).join('\n')
  assert.equal(/特别建议打开“完全访问权限”|开启“超高”和“完全访问权限”|不会有太大的安全风险/.test(prose),false)
  const login=chapters[0].sections.find(section=>section.title==='下载和登录').body
  assert.ok(login.includes('/guide/account'))
  assert.ok(login.includes('/clients/codex'))
  assert.ok(login.includes('/guide/verify'))
})

test('shared preparation links use the account route',()=>{
  const choose=fs.readFileSync(new URL('guide/choose-tool.md',pages),'utf8')
  assert.ok(choose.includes('[注册与准备](/guide/account)'))
  assert.equal(choose.includes('[注册与准备](/guide/start)'),false)
})

test('new Claude desktop and practice steps expose site-specific screenshot upload slots',()=>{
  for(const rel of ['clients/claude-desktop.md','learn/claude/first-task.md']){
    const text=fs.readFileSync(new URL(rel,pages),'utf8')
    const route='/'+rel.replace(/\.md$/,'')
    const manifest=[]
    addDocumentShots(text,{rel,route,title:'Claude'},manifest)
    assert.ok(manifest.length>=4,rel)
    assert.equal(new Set(manifest.map(slot=>slot.id)).size,manifest.length,rel)
    assert.ok(manifest.every(slot=>slot.route===route&&slot.siteOnly&&slot.capturePolicy==='required'),rel)
  }
})
