import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import {
  DRAFT_KEY,
  MAX_SOURCE_LENGTH,
  skillTemplates,
  templateSource,
  validateSkillSource,
  skillInstallPath,
  skillPrompt,
  createWorkshopDrafts,
  restoreWorkshopDrafts,
  selectWorkshopTemplate,
  updateWorkshopSource,
  loadWorkshopDrafts,
  saveWorkshopDrafts
} from '../theme/skill-workshop.mjs'

function skill(frontmatter, body = '# Workflow\n\nRead the material, apply the steps, then check the result.') {
  return '---\n' + frontmatter + '\n---\n\n' + body
}

test('every shipped template has an installable file and three relevant test cases', () => {
  for (const template of skillTemplates) {
    const result = validateSkillSource(templateSource(template))
    assert.equal(result.valid, true, result.errors.join('\n'))
    assert.equal(result.name, template.name)
    assert.equal(template.cases.length, 3)
    assert.ok(template.cases.every((item) => item.prompt && item.expected))
  }
  assert.ok(skillTemplates.find((item) => item.id === 'interface').cases.some((item) => item.prompt.includes('截图')))
})

test('fields outside frontmatter cannot satisfy required fields', () => {
  const result = validateSkillSource(skill('other: value', 'name: fake\ndescription: fake\nDo the work.'))
  assert.equal(result.valid, false)
  assert.equal(result.name, '')
})

test('empty, malformed, repeated and non-string YAML values are rejected', () => {
  const invalid = [
    'name: ""\ndescription: ""',
    'name:\ndescription: text',
    'name: example\ndescription:',
    'name: [unclosed\ndescription: text',
    'name: example\ndescription: : :',
    'name: example\ndescription: first\ndescription: second',
    'name: example\nname: other\ndescription: text',
    'name: example\ndescription: true',
    'name: example\ndescription: null',
    'name: 123\ndescription: text',
    'name: example\ndescription: "unclosed',
    'name: example\ndescription: |\n  multiline',
    'name: example\ndescription: short\nextra: value',
    'name: example\ndescription: unquoted: mapping',
    'name: example\ndescription: text # ambiguous comment',
    'name: example\ndescription: "line\\nsecond"'
  ]
  for (const frontmatter of invalid) assert.equal(validateSkillSource(skill(frontmatter)).valid, false, frontmatter)
})

test('a YAML field requires separation after its colon and all scalar styles reject control characters', () => {
  for (const fields of [
    'name:good-skill\ndescription:Check things.',
    'name:good-skill\ndescription: Check things.',
    'name: good-skill\ndescription:Check things.'
  ]) {
    assert.equal(validateSkillSource(skill(fields)).valid, false, fields)
  }
  for (const value of ['bad\u0001text', "'bad\u0001text'", '"bad\\u0001text"', "'bad\u0085text'", 'text\u000b']) {
    assert.equal(validateSkillSource(skill('name: example\ndescription: ' + value)).valid, false)
  }
  assert.equal(validateSkillSource(skill('# invalid comment\u0001\nname: example\ndescription: Read material')).valid, false)
})

test('quoted text, comments, CRLF and BOM work within the documented subset', () => {
  const examples = [
    'name: example\ndescription: "Read: material and review it"',
    "name: example\ndescription: 'Read the user''s material'",
    '# A note\nname: example\n\ndescription: Read supplied material',
    'name: "123"\ndescription: "true"'
  ]
  for (const frontmatter of examples)
    assert.equal(validateSkillSource('\uFEFF' + skill(frontmatter).replaceAll('\n', '\r\n')).valid, true, frontmatter)
})

test('path traversal, reserved device names and unsafe skill names cannot generate paths or prompts', () => {
  for (const name of [
    '../example',
    'a/b',
    'a\\b',
    'Example',
    '-example',
    'example-',
    'two--words',
    'con',
    'com1',
    'lpt9',
    'a'.repeat(65)
  ]) {
    assert.equal(validateSkillSource(skill('name: ' + name + '\ndescription: Read material')).valid, false, name)
    assert.equal(skillInstallPath(name), '')
    assert.equal(skillPrompt(name, 'Run'), '')
  }
})

test('missing body, broken delimiters and oversized files are rejected', () => {
  assert.equal(validateSkillSource(skill('name: example\ndescription: Read material', '# Header only')).valid, false)
  assert.equal(validateSkillSource('name: example\ndescription: Read material').valid, false)
  assert.equal(validateSkillSource(skill('name: example\ndescription: Read material').replace('\n---\n', '\n--- extra\n')).valid, false)
  assert.equal(validateSkillSource('x'.repeat(MAX_SOURCE_LENGTH + 1)).valid, false)
  assert.equal(validateSkillSource(skill('name: example\ndescription: ' + 'x'.repeat(1025))).valid, false)
})

test('install paths and prompts follow the actual edited name', () => {
  const result = validateSkillSource(templateSource(skillTemplates[0]).replace('tutorial-writing', 'my-writing'))
  assert.equal(skillInstallPath(result.name, 'windows', 'project'), '你的项目目录\\.agents\\skills\\my-writing\\SKILL.md')
  assert.equal(skillInstallPath(result.name, 'windows', 'personal'), '%USERPROFILE%\\.agents\\skills\\my-writing\\SKILL.md')
  assert.equal(skillInstallPath(result.name, 'macos', 'project'), '你的项目目录/.agents/skills/my-writing/SKILL.md')
  assert.equal(skillInstallPath(result.name, 'macos', 'personal'), '~/.agents/skills/my-writing/SKILL.md')
  assert.equal(skillPrompt(result.name, 'Write a guide'), '$my-writing\nWrite a guide')
})

test('switching templates and restoring a saved session preserves independent drafts including invalid text', () => {
  let state = createWorkshopDrafts()
  state = updateWorkshopSource(state, 'unfinished writing draft')
  state = selectWorkshopTemplate(state, 'office')
  state = updateWorkshopSource(state, 'unfinished office draft')
  state = selectWorkshopTemplate(state, 'writing')
  assert.equal(state.drafts[state.chosen], 'unfinished writing draft')
  const restored = restoreWorkshopDrafts(JSON.stringify(state))
  assert.equal(restored.drafts.office, 'unfinished office draft')
  assert.equal(restored.drafts.writing, 'unfinished writing draft')
  assert.equal(restored.chosen, 'writing')
  assert.equal(selectWorkshopTemplate(state, '__proto__'), state)
})

test('stored data only restores known bounded drafts', () => {
  const result = restoreWorkshopDrafts(
    JSON.stringify({
      version: 1,
      chosen: 'unknown',
      drafts: { writing: 'x'.repeat(MAX_SOURCE_LENGTH + 1), office: '', unknown: 'unexpected' }
    })
  )
  assert.equal(result.chosen, 'writing')
  assert.equal(result.drafts.office, '')
  assert.equal(result.drafts.writing, templateSource(skillTemplates[0]))
  assert.equal(Object.hasOwn(result.drafts, 'unknown'), false)
})

test('disabled storage, corrupt data and quota errors never throw or mutate the active draft', () => {
  const blocked = () => {
    throw Error('SecurityError')
  }
  assert.equal(loadWorkshopDrafts(blocked).available, false)
  assert.equal(loadWorkshopDrafts(() => ({ getItem: () => '{broken' })).available, false)
  const state = updateWorkshopSource(createWorkshopDrafts(), 'my current draft')
  assert.equal(saveWorkshopDrafts(blocked, state), false)
  assert.equal(
    saveWorkshopDrafts(
      () => ({
        setItem() {
          throw Error('QuotaExceededError')
        }
      }),
      state
    ),
    false
  )
  assert.equal(state.drafts.writing, 'my current draft')
  let saved
  assert.equal(
    saveWorkshopDrafts(
      () => ({
        setItem(key, value) {
          assert.equal(key, DRAFT_KEY)
          saved = value
        }
      }),
      state
    ),
    true
  )
  assert.deepEqual(loadWorkshopDrafts(() => ({ getItem: () => saved })).state, state)
})

test('the workshop component compiles with its template bindings', () => {
  const filename = new URL('../theme/SkillWorkshop.vue', import.meta.url)
  const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename: filename.pathname })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'skill-workshop' })
  const template = compileTemplate({
    source: descriptor.template.content,
    filename: filename.pathname,
    id: 'skill-workshop',
    compilerOptions: { bindingMetadata: script.bindings }
  })
  assert.deepEqual(template.errors, [])
})
