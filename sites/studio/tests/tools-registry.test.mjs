import test from 'node:test'
import assert from 'node:assert/strict'
import {filterTutorialTools,tutorialToolBase,tutorialTools} from '../theme/tools-registry.mjs'

test('tool search supports aliases, case, full-width input and spaced queries',()=>{
  for(const query of ['ChatGPT','  ＣＯＤＥＸ  ','openai cli'])assert.ok(filterTutorialTools(query).some(tool=>tool.id==='codex'))
  assert.deepEqual(filterTutorialTools('Claude   Code').map(tool=>tool.id),['claude'])
  assert.deepEqual(filterTutorialTools('安装包').map(tool=>tool.id),['manager'])
  assert.equal(filterTutorialTools('nothing_matches').length,0)
  assert.equal(filterTutorialTools('   ').length,tutorialTools.length)
})

test('category and query combine without offering unrelated clients',()=>{
  assert.equal(filterTutorialTools('codex','claude').length,0)
  assert.deepEqual(filterTutorialTools('','manager').map(tool=>tool.id),['manager'])
  assert.deepEqual(tutorialTools.map(tool=>tool.id),['manager','codex','claude'])
  assert.equal(new Set(tutorialTools.map(tool=>tool.href)).size,tutorialTools.length)
})

test('tool addresses honor each site explicit configuration',()=>{
  const sub={base_url:'https://api.example.test',codex_base_url:'https://api.example.test',openclaw_base_url:'https://api.example.test/v1'}
  const main={base_url:'https://xm.example.test',codex_base_url:'https://xm.example.test/v1',openclaw_base_url:'https://xm.example.test/v1'}
  assert.equal(tutorialToolBase('codex',sub),sub.codex_base_url)
  assert.equal(tutorialToolBase('codex',main),main.codex_base_url)
  assert.equal(tutorialToolBase('openclaw',sub),sub.openclaw_base_url)
  assert.equal(tutorialToolBase('claude-code',main),main.base_url)
  assert.equal(tutorialToolBase('cursor',main),'')
  assert.equal(tutorialToolBase('openclaw',{}),'')
})
