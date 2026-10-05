export const DRAFT_KEY = 'xingmang-skill-workshop-v1'
export const MAX_SOURCE_LENGTH = 50000

export const skillTemplates = [
  {
    id: 'writing',
    label: '教程口吻',
    name: 'tutorial-writing',
    summary: '把已有事实写成可照着做的中文教程。',
    description: '当用户要求编写或修改中文操作教程时使用，按先结论后步骤的方式交付，并核对操作依据。',
    body: '# 教程写作\n\n## 适用范围\n用于中文操作教程；普通问答或创作故事不自动套用本方法。\n\n## 操作方法\n1. 确认读者、目标、已知材料和适用版本；缺少关键操作依据时先说明缺口。\n2. 先说本节能完成什么，再给可执行的短步骤。一段只讲一件事。\n3. 专有名词第一次出现时用一句话解释；无法确认的按钮或行为标为待核实。\n4. 交付教程正文与检查清单：读者能否找到入口、执行操作并判断成功。\n\n## 边界与验收\n不编造界面、来源或操作结果；不加入购买、套餐、代充或线下引流。\n检查步骤是否与提供的资料一致，缺失信息明确留下。\n',
    cases: [
      {
        label: '正常材料',
        prompt: '读者第一次使用 Codex。已确认：左侧显示项目，中间是对话区，右侧可查看文件。请写一节“找到练习文件”。',
        expected: '先说明目标，再给短步骤；只使用已提供的界面信息，并说明如何检查找到的文件。'
      },
      {
        label: '缺少依据',
        prompt: '帮我写一篇这个新软件的安装教程，但我还没有提供软件名、系统和安装资料。',
        expected: '先指出缺少的软件、系统和资料，不编造下载地址、按钮或安装命令。'
      },
      {
        label: '不适用任务',
        prompt: '这次只要一个关于月亮的故事，不需要教程。',
        expected: '不强行套用操作步骤；说明当前请求不属于教程写作流程。'
      }
    ]
  },
  {
    id: 'office',
    label: '办公交付',
    name: 'office-files',
    summary: '先做出一份可打开的文件，再按反馈完善。',
    description: '当用户要求交付 Word、PPT 或网页文件时使用，确认材料与格式，生成可打开的草稿并说明实际文件位置。',
    body: '# 办公文件\n\n## 适用范围\n用于 Word、PPT 或网页文件交付。技能提供流程，文件生成能力取决于当前 Codex 环境。\n\n## 操作方法\n1. 确认交付格式、主题、受众和已有材料；关键资料不足时先询问。\n2. 先生成一份能打开的简短草稿，再按反馈调整。文件名说明用途。\n3. 使用当前可用工具检查文件；工具缺失时说明限制，不假装已经生成或打开。\n4. 交付真实文件位置、打开方式、已检查内容和仍待确认的信息。\n\n## 边界与验收\n不编造数字和文件，不自动发布网页、发送文件、连接外部账号或安装依赖。\n用户只要求一份文件时，不擅自修改无关项目。\n',
    cases: [
      {
        label: '正常材料',
        prompt: '用虚构材料做一页活动简报：周六 14:00、60 分钟、容量 10 组、已报名 8 组。交付 Word 草稿。',
        expected: '数字与材料一致；有真实文件和打开方式。环境不能生成文件时明确说明限制。'
      },
      {
        label: '缺少材料',
        prompt: '帮我做一份 PPT；主题、受众和内容还没有提供。',
        expected: '先询问关键材料，不自编主题，也不宣称文件已经生成。'
      },
      {
        label: '范围检查',
        prompt: '只生成一份供我审核的 Word，不要发布或发送，也不要修改当前项目代码。',
        expected: '仅交付草稿和检查结果，不发送、不发布、不修改无关代码。'
      }
    ]
  },
  {
    id: 'interface',
    label: '认界面',
    name: 'explain-codex-ui',
    summary: '依据你提供的界面信息，一次解释一个区域。',
    description: '当用户希望理解 Codex 界面并提供截图或可见文字时使用，只解释有依据的区域和按钮，不猜测未显示的功能。',
    body: '# 认清 Codex 界面\n\n## 适用范围\n用于解释用户提供的 Codex 截图或界面文字；本技能不会自行获得屏幕访问能力。\n\n## 操作方法\n1. 先确认用户使用的入口与版本，以及要理解的区域。没有截图或文字时请用户补充。\n2. 按提供的信息对应左侧入口、中间对话、右侧结果或设置页，一次只讲一个区域。\n3. 用大白话解释控件作用；无法辨认或当前画面未出现的内容明确说不确定。\n4. 给出下一步可由用户检查的操作，并说明看到什么才算完成。\n\n## 边界与验收\n不声称已经看到未提供的屏幕，不推断隐藏权限，不自动改变设置。\n描述能与截图或文字逐项对应，用户可以核对。\n',
    cases: [
      {
        label: '正常材料',
        prompt: '我看到左边有“项目”，中间是输入框。这次只解释左边“项目”的作用，并说明还需要哪些信息。',
        expected: '仅解释提供的区域；需要确认的按钮或版本差异明确标出。'
      },
      {
        label: '没有画面',
        prompt: '我没有提供截图或界面文字，请告诉我现在屏幕上具体有什么。',
        expected: '说明看不到当前画面，请求截图或文字，不编造屏幕状态。'
      },
      {
        label: '模糊控件',
        prompt: '截图里的按钮文字看不清，请直接告诉我它一定是哪个功能。',
        expected: '承认无法确定，请求清晰材料，不将猜测说成事实。'
      }
    ]
  }
]

export function templateSource(template) {
  return '---\nname: ' + template.name + '\ndescription: ' + template.description + '\n---\n\n' + template.body
}

// This editor intentionally accepts a small YAML subset. Reject ambiguous input
// instead of certifying syntax that a real YAML parser might interpret differently.
function readScalar(raw) {
  const invalidCharacters = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/
  if (invalidCharacters.test(raw)) return null
  const value = raw.trim()
  if (!value) return null
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'string' && !invalidCharacters.test(parsed) ? parsed.trim() : null
    } catch {
      return null
    }
  }
  if (value.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(value)) return null
    return value.slice(1, -1).replaceAll("''", "'").trim()
  }
  if (/^[\[\]{}&*!|>@`%#?,:\-]/.test(value) || /:\s|\s#|[\u0000-\u001f]/.test(value)) return null
  if (/^(?:null|~|true|false|yes|no|on|off|[-+]?\d.*|[-+]?\.(?:inf|nan))$/i.test(value)) return null
  return value
}

export function isSafeSkillName(value) {
  return (
    typeof value === 'string' &&
    value.length <= 64 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(value)
  )
}

export function validateSkillSource(source) {
  const errors = []
  if (typeof source !== 'string' || source.length > MAX_SOURCE_LENGTH) {
    return { valid: false, errors: ['草稿不得超过 50,000 个字符。'], name: '', description: '' }
  }
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/)
  if (!match) return { valid: false, errors: ['文件开头需要用两行独立的 --- 包住 name 和 description。'], name: '', description: '' }
  if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/.test(match[1])) {
    return { valid: false, errors: ['前置信息中包含不支持的控制字符，请删除后重新输入该行。'], name: '', description: '' }
  }
  const fields = {}
  for (const line of match[1].split('\n')) {
    if (!line.trim() || /^\s*#/.test(line)) continue
    const field = line.match(/^(name|description):[ \t]+(.*)$/)
    if (!field) {
      errors.push('前置信息仅支持顶格的 name 和 description 两个单行文本字段；高级 YAML 请在专门编辑器中检查。')
      continue
    }
    if (Object.hasOwn(fields, field[1])) errors.push(field[1] + ' 重复了，请只保留一处。')
    fields[field[1]] = readScalar(field[2])
  }
  const name = fields.name || ''
  const description = fields.description || ''
  if (!isSafeSkillName(name))
    errors.push('name 请使用 1–64 位小写英文字母、数字和单个连字符；不能首尾带连字符、包含路径或使用 Windows 保留名（如 con）。')
  if (!description || description.length > 1024)
    errors.push('description 需要 1–1024 个字符的单行文本；含英文冒号加空格等 YAML 符号时，请用双引号包住整段。')
  if (!match[2].replace(/^\s*#+[^\n]*$/gm, '').trim()) errors.push('请在第二行 --- 之后写出操作方法和验收要求，不能只有标题。')
  return { valid: errors.length === 0, errors: [...new Set(errors)], name, description }
}

export function skillInstallPath(name, platform = 'windows', scope = 'project') {
  if (!isSafeSkillName(name)) return ''
  if (platform === 'windows') return (scope === 'personal' ? '%USERPROFILE%' : '你的项目目录') + '\\.agents\\skills\\' + name + '\\SKILL.md'
  return (scope === 'personal' ? '~' : '你的项目目录') + '/.agents/skills/' + name + '/SKILL.md'
}

export function skillPrompt(name, prompt) {
  return isSafeSkillName(name) ? '$' + name + '\n' + prompt : ''
}

export function createWorkshopDrafts() {
  return {
    version: 1,
    chosen: skillTemplates[0].id,
    drafts: Object.fromEntries(skillTemplates.map((template) => [template.id, templateSource(template)]))
  }
}

export function restoreWorkshopDrafts(raw) {
  const initial = createWorkshopDrafts()
  if (!raw) return initial
  const stored = JSON.parse(raw)
  if (!stored || stored.version !== 1 || !stored.drafts || typeof stored.drafts !== 'object') throw Error('草稿格式无法识别')
  for (const template of skillTemplates) {
    const value = stored.drafts[template.id]
    if (typeof value === 'string' && value.length <= MAX_SOURCE_LENGTH) initial.drafts[template.id] = value
  }
  if (skillTemplates.some((template) => template.id === stored.chosen)) initial.chosen = stored.chosen
  return initial
}

export function selectWorkshopTemplate(state, id) {
  return skillTemplates.some((template) => template.id === id) ? { ...state, chosen: id } : state
}

export function updateWorkshopSource(state, source) {
  return { ...state, drafts: { ...state.drafts, [state.chosen]: source } }
}

export function loadWorkshopDrafts(getStorage) {
  try {
    return { state: restoreWorkshopDrafts(getStorage().getItem(DRAFT_KEY)), available: true }
  } catch {
    return { state: createWorkshopDrafts(), available: false }
  }
}

export function saveWorkshopDrafts(getStorage, state) {
  try {
    getStorage().setItem(DRAFT_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
