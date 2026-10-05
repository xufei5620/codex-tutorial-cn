const paths = [
  {
    id: 'codex',
    title: 'Codex 学习路线',
    categoryHref: '/learn/codex/',
    categoryLabel: 'Codex 教程',
    steps: [
      { id: 'install', title: '安装与接入', href: '/clients/codex', goal: '选好使用入口，完成安装、登录或本站配置。' },
      { id: 'verify', title: '验证第一次调用', href: '/guide/verify?track=codex', goal: '获得测试回复，并核对本次调用使用的服务。' },
      { id: 'first-task', title: '完成第一次任务', href: '/learn/first-task', goal: '用练习材料做出一份能够打开、核对的结果。' },
      { id: 'ch01', title: '认识 Codex 界面', href: '/learn/codex/ch01', goal: '找到输入、任务和权限入口，完成一个小练习。' },
      { id: 'ch02', title: '办公四件套与本地交付', href: '/learn/codex/ch02', goal: '完成一份办公交付，打开文件核对内容和保存位置。' },
      { id: 'files', title: '练习处理文件', href: '/learn/working-with-files', goal: '只使用练习文件夹，完成有限的文件读写。' },
      { id: 'review', title: '检查结果与修改', href: '/learn/review-and-revise', goal: '逐项核对结果，给出具体修改要求并复查。' },
      { id: 'skills', title: '制作与验证 Skill', href: '/skills', goal: '把可复用的方法做成技能，安装后实际测试。' }
    ]
  },
  {
    id: 'claude-code',
    title: 'Claude Code 学习路线',
    categoryHref: '/learn/claude/',
    categoryLabel: 'Claude 教程',
    steps: [
      {
        id: 'install',
        title: '安装与接入 Claude Code',
        href: '/clients/claude-code',
        goal: '安装 Claude Code，核对本站服务地址和认证方式。'
      },
      { id: 'verify', title: '验证第一次调用', href: '/guide/verify?track=claude-code', goal: '完成 CLI 文本测试，并核对本站调用记录。' },
      {
        id: 'first-task',
        title: '完成第一次任务',
        href: '/learn/claude/first-task?track=claude-code',
        goal: '用练习文件完成只读核对、有限修改和验收。'
      },
      {
        id: 'review',
        title: '检查结果与修改',
        href: '/learn/review-and-revise?track=claude-code',
        goal: '核对事实与文件改动，提出修改要求并复查。'
      }
    ]
  },
  {
    id: 'claude-desktop',
    title: 'Claude Desktop 学习路线',
    categoryHref: '/learn/claude/',
    categoryLabel: 'Claude 教程',
    steps: [
      { id: 'install', title: '安装并登录桌面端', href: '/clients/claude-desktop', goal: '安装桌面应用，完成官方登录并确认可用功能。' },
      {
        id: 'first-task',
        title: '完成第一次桌面任务',
        href: '/learn/claude/first-task?track=claude-desktop',
        goal: '在普通聊天中粘贴练习材料，核对回复并自行保存结果。'
      }
    ]
  },
  {
    id: 'manager',
    title: '星芒管理工具使用路线',
    categoryHref: '/guide/start',
    categoryLabel: '教程总览',
    steps: [
      { id: 'install', title: '下载并安装', href: '/guide/manager#manager-install', goal: '选择系统和芯片，下载并安装管理工具。' },
      {
        id: 'account',
        title: '登录并核对账号来源',
        href: '/guide/manager#manager-account',
        goal: '确认本站账号与所选接入方式，核对登录状态。'
      },
      {
        id: 'environment',
        title: '检查运行环境',
        href: '/guide/manager#manager-environment',
        goal: '按检测结果补齐目标工具需要的运行环境。'
      },
      { id: 'tool', title: '安装目标工具', href: '/guide/manager#manager-tool', goal: '选择目标工具安装，并确认工具已经可用。' },
      { id: 'config', title: '保存连接配置', href: '/guide/manager#manager-config', goal: '备份已有配置，核对连接方式并保存配置。' },
      {
        id: 'verify',
        title: '验证首次调用',
        href: '/guide/manager#manager-verify',
        goal: '重新打开目标工具，验证回复并核对实际使用的服务。'
      },
      { id: 'next', title: '选择对应教程', href: '/guide/manager#manager-next', goal: '按实际使用的工具选择教程，开始第一次任务。' }
    ]
  }
]

const pathIds = new Set(paths.map((path) => path.id))
const completedKeys = new Set(paths.flatMap((path) => path.steps.map((step) => path.id + ':' + step.id)))
const categories = new Map(paths.map((path) => [path.categoryHref.replace(/\/$/, ''), path.categoryHref]))
const managerLocations = new Map([
  ...paths.find((path) => path.id === 'manager').steps.map((step, index) => [step.href.split('#')[1], { index, href: step.href }]),
  ['download-installers', { index: 0, href: '/guide/manager#download-installers' }],
  ['安装后-按这四步开始', { index: 0, href: '/guide/manager#安装后-按这四步开始' }],
  ['offline-packages', { index: 6, href: '/guide/manager#offline-packages' }],
  ['manager-help', { index: 6, href: '/guide/manager#manager-help' }],
  ['离线包怎么选', { index: 6, href: '/guide/manager#离线包怎么选' }]
])

function parseLocation(value, query = '', hash = '') {
  if (typeof value !== 'string' || typeof query !== 'string' || typeof hash !== 'string') return null
  // Only root-relative paths can reach the fixed destination table. Do not let URL
  // parsing repair backslashes, control characters or protocol-relative addresses.
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return null
  const hashIndex = value.indexOf('#')
  const beforeHash = hashIndex < 0 ? value : value.slice(0, hashIndex)
  const queryIndex = beforeHash.indexOf('?')
  const pathname = (queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex)).replace(/\.html$/, '').replace(/\/$/, '')
  const search = query || (queryIndex < 0 ? '' : beforeHash.slice(queryIndex + 1))
  const tracks = new URLSearchParams(search.replace(/^\?/, '')).getAll('track')
  const track = tracks.length === 1 && pathIds.has(tracks[0]) ? tracks[0] : null
  let anchor = (hash || (hashIndex < 0 ? '' : value.slice(hashIndex + 1))).replace(/^#/, '')
  try {
    anchor = decodeURIComponent(anchor)
  } catch {
    anchor = ''
  }
  return { pathname, track, anchor }
}

function selectPath(location) {
  const { pathname, track } = location
  if (pathname === '/guide/verify') return track === 'codex' || track === 'claude-code' ? track : null
  if (pathname === '/learn/claude/first-task')
    return !track || track === 'claude-code' ? 'claude-code' : track === 'claude-desktop' ? track : null
  if (pathname === '/learn/review-and-revise') return !track || track === 'codex' ? 'codex' : track === 'claude-code' ? track : null
  return paths.find((path) => path.steps.some((step) => step.href.split(/[?#]/)[0] === pathname))?.id || null
}

export function resolveLearningPath(path, query = '', hash = '') {
  const location = parseLocation(path, query, hash)
  if (!location) return null
  const definition = paths.find((item) => item.id === selectPath(location))
  if (!definition) return null
  const steps = definition.steps.map((step) => ({ ...step }))
  const index =
    definition.id === 'manager'
      ? (managerLocations.get(location.anchor)?.index ?? 0)
      : steps.findIndex((step) => step.href.split(/[?#]/)[0] === location.pathname)
  if (index < 0) return null
  return {
    ...definition,
    steps,
    index,
    currentStep: steps[index],
    previous: steps[index - 1] || null,
    next: steps[index + 1] || null
  }
}

export function safeLearningHref(value) {
  const location = parseLocation(value)
  if (!location) return null
  if (categories.has(location.pathname)) return categories.get(location.pathname)
  const path = resolveLearningPath(value)
  if (!path) return null
  // Keep only manager's fixed step, reference and legacy anchors. A reference
  // can select a position in the route without adding any completion state.
  if (path.id === 'manager') return managerLocations.get(location.anchor)?.href || '/guide/manager'
  return path.currentStep.href
}

export function completionKey(pathId, stepId) {
  if (typeof pathId !== 'string' || typeof stepId !== 'string') return null
  const key = pathId + ':' + stepId
  return completedKeys.has(key) ? key : null
}

export function normalizeCompleted(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((key) => typeof key === 'string' && completedKeys.has(key)))]
}
