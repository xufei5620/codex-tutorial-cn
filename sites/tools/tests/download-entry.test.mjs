// Exercise the real Vue setup with mocked network; no account or model requests.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import * as ServerRenderer from 'vue/server-renderer'
import { COS_ROOT, INDEX_ROUTES, downloadPlatformGroups } from '../../downloads/catalog.mjs'
import { validateDownloadConfiguration } from '../../build/site.mjs'
const source = fs.readFileSync(new URL('../../theme/DownloadLink.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'download-unit' })
function setup(fetchCatalog) {
  let destroy, mount
  const code = script.content.replace(/^import .*$/gm, '').replace('export default {', 'globalThis.component = {')
  const BrandIcon = Vue.defineComponent({ props: ['name'], setup: (props) => () => Vue.h('span', { 'data-brand-icon': props.name }) })
  const context = {
    ref: Vue.ref,
    AbortController,
    INDEX_ROUTES,
    downloadPlatformGroups,
    fetchCatalog,
    BrandIcon,
    windowsIcon: '/mock/windows.svg',
    appleIcon: '/mock/apple.svg',
    fetch: () => {
      throw Error('Unmocked network is forbidden')
    },
    onMounted: (callback) => {
      mount = callback
    },
    onBeforeUnmount: (callback) => {
      destroy = callback
    }
  }
  vm.runInNewContext(code, context)
  return { state: context.component.setup({}, { expose() {} }), destroy: () => destroy(), mount: () => mount() }
}
function render(state) {
  const compiled = compileTemplate({
    source: descriptor.template.content,
    id: 'download-unit',
    filename: 'DownloadLink.vue',
    ssr: true,
    ssrCssVars: [],
    compilerOptions: { bindingMetadata: script.bindings }
  })
  const context = {}
  const code = compiled.code
    .replace(/^import \{ (.*?) \} from "(.*?)"$/gm, (_, bindings, module) => {
      for (const binding of bindings.split(', ')) {
        const [name, alias] = binding.split(' as ')
        context[alias || name] = (module === 'vue' ? Vue : ServerRenderer)[name]
      }
      return ''
    })
    .replace('export function ssrRender', 'globalThis.render = function ssrRender')
  vm.runInNewContext(code, context)
  return ServerRenderer.renderToString(
    Vue.createSSRApp({
      ssrRender(contextState, push, parent, attrs) {
        context.render(contextState, push, parent, attrs, null, Vue.proxyRefs(state), null, null)
      }
    })
  )
}
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))
function panel(html, product, system) {
  const match = html.match(
    new RegExp('<section\\b([^>]*\\bid="download-options-' + product + '-' + system + '"[^>]*)>([\\s\\S]*?)</section>')
  )
  assert.ok(match, 'Missing ' + product + ' ' + system + ' download panel')
  return { attributes: match[1], content: match[2], hidden: /display:\s*none/.test(match[1]) }
}
function option(html, id) {
  const match = html.match(new RegExp('<li\\b[^>]*\\bdata-package="' + id + '"[^>]*>([\\s\\S]*?)</li>'))
  assert.ok(match, 'Missing ' + id + ' package option')
  return match[1]
}
function systemButton(html, product, system) {
  const match = html.match(new RegExp('<button\\b[^>]*\\baria-controls="download-options-' + product + '-' + system + '"[^>]*>'))
  assert.ok(match, 'Missing ' + product + ' ' + system + ' system button')
  return match[0]
}
test('download groups compile with accessible system buttons and product headings', async () => {
  const compiled = compileTemplate({
    source: descriptor.template.content,
    id: 'download-unit',
    filename: 'DownloadLink.vue',
    ssr: true,
    ssrCssVars: [],
    compilerOptions: { bindingMetadata: script.bindings }
  })
  assert.deepEqual(compiled.errors, [])
  const fixture = setup(async () => []),
    html = await render(fixture.state)
  assert.match(html, /id="download-installers"[^>]*aria-label="安装包下载"/)
  for (const product of ['manager', 'chatgpt', 'claude']) {
    assert.ok(html.includes('id="download-title-' + product + '"'))
    for (const system of ['windows', 'macos']) {
      assert.match(systemButton(html, product, system), /aria-expanded="false"/)
      assert.equal(panel(html, product, system).hidden, true)
    }
  }
  assert.ok(html.includes('桌面端离线安装包'))
  assert.ok(html.includes('正常安装遇到网络问题'))
  assert.match(html, /role="status"/)
  assert.equal(source.includes('v-html'), false)
  assert.equal(source.includes('feishu.cn'), false)
  assert.ok(source.includes('aria-hidden="true" class="installer-os-icon" width="18" height="18"'))
  assert.ok(source.includes('alt=""'))
  fixture.destroy()
})
test('mount loads all three catalogs once and installation details do not trigger extra requests', async () => {
  const calls = [],
    fixture = setup(async (product, options) => {
      calls.push({ product, options })
      return []
    })
  assert.equal(calls.length, 0)
  fixture.mount()
  await flush()
  assert.deepEqual(
    calls.map((call) => call.product),
    ['manager', 'chatgpt', 'claude']
  )
  fixture.mount()
  fixture.state.selectSystem('manager', 'macos')
  fixture.state.selectSystem('claude', 'windows')
  await render(fixture.state)
  assert.deepEqual(
    calls.map((call) => call.product),
    ['manager', 'chatgpt', 'claude']
  )
  for (const call of calls) assert.equal(call.options.signal.aborted, false)
  assert.equal(fixture.state.catalogs.value.manager.status, 'ready')
  assert.equal(fixture.state.catalogs.value.manager.items.length, 0)
  assert.equal(calls.length, 3)
  fixture.destroy()
})
test('the selected Mac option links straight to its published COS file without guessing missing files', async () => {
  const url = COS_ROOT + '/xingmang/releases/0.2.13/XingMang-AI-Manager-0.2.13-Apple-Silicon-arm64.dmg'
  const item = {
    id: 'macos-arm64',
    label: 'macOS Apple Silicon',
    architecture: 'arm64',
    version: '0.2.13',
    url,
    bytes: 143258716,
    format: 'dmg',
    sha256: 'a'.repeat(64)
  }
  const fixture = setup(async (product) => (product === 'manager' ? [item] : []))
  fixture.mount()
  await flush()
  assert.equal(panel(await render(fixture.state), 'manager', 'macos').hidden, true)
  fixture.state.selectSystem('manager', 'macos')
  const html = await render(fixture.state),
    mac = panel(html, 'manager', 'macos'),
    available = option(mac.content, 'macos-arm64'),
    missing = option(mac.content, 'macos-x64')
  assert.equal(mac.hidden, false)
  assert.ok(available.includes('href="' + url + '"'))
  assert.ok(available.includes('Apple 芯片'))
  assert.ok(available.includes('下载 DMG'))
  assert.ok(available.includes('0.2.13'))
  assert.ok(available.includes(item.sha256))
  assert.ok(available.includes('打开 DMG'))
  assert.equal(missing.includes('href='), false)
  assert.ok(missing.includes(' disabled'))
  assert.equal(panel(html, 'manager', 'windows').hidden, true)
  assert.equal(html.includes('/guide/manager'), false)
  fixture.destroy()
})
test('Codex display name keeps the original package and matching license links beside their system label', async () => {
  const directory = COS_ROOT + '/chatgpt/windows-arm64/26.930.2377.0/'
  const item = {
    id: 'windows-arm64',
    label: 'Windows ARM64',
    architecture: 'arm64',
    version: '26.930.2377.0',
    fileName: 'ChatGPT-arm64.msix',
    licenseFileName: 'ChatGPT-License.xml',
    url: directory + 'ChatGPT-arm64.msix',
    licenseUrl: directory + 'ChatGPT-License.xml',
    bytes: 900000000,
    format: 'msix',
    sha256: 'a'.repeat(64),
    licenseSha256: 'b'.repeat(64)
  }
  const fixture = setup(async (product) => (product === 'chatgpt' ? [item] : []))
  fixture.mount()
  await flush()
  fixture.state.selectSystem('chatgpt', 'windows')
  const html = await render(fixture.state),
    windows = panel(html, 'chatgpt', 'windows'),
    arm = option(windows.content, 'windows-arm64'),
    x64 = option(windows.content, 'windows-x64')
  assert.equal(windows.hidden, false)
  assert.ok(html.includes('Codex 桌面端离线包（备用）'))
  assert.equal(html.includes('ChatGPT 桌面端'), false)
  assert.ok(arm.includes('href="' + item.url + '"'))
  assert.ok(arm.includes('href="' + item.licenseUrl + '"'))
  assert.ok(arm.includes('ARM 处理器'))
  assert.ok(arm.includes('Windows ARM64 许可文件'))
  assert.equal(html.split('href="' + item.licenseUrl + '"').length - 1, 1)
  assert.ok(arm.includes('MSIX 与许可文件都要下载，并放在同一文件夹'))
  assert.ok(arm.includes('相同版本和架构'))
  assert.ok(arm.includes('管理员 PowerShell'))
  assert.ok(arm.includes('Add-AppxProvisionedPackage'))
  assert.ok(arm.includes('ChatGPT-arm64.msix'))
  assert.ok(arm.includes('-LicensePath'))
  assert.ok(arm.includes(item.sha256))
  assert.ok(arm.includes(item.licenseSha256))
  assert.equal(x64.includes('href='), false)
  assert.equal(x64.includes(item.sha256), false)
  fixture.destroy()
})
test('Claude is a separate fallback group with complete MSIX and SkipLicense instructions', async () => {
  const item = {
    id: 'windows-arm64',
    label: 'Windows ARM64',
    architecture: 'arm64',
    version: '1.0.0.0',
    fileName: 'Claude-arm64.msix',
    url: COS_ROOT + '/xingmang/offline/claude/windows-arm64/sha256-' + 'a'.repeat(64) + '/Claude-arm64.msix',
    bytes: 500000000,
    format: 'msix',
    sha256: 'a'.repeat(64)
  }
  const fixture = setup(async (product) => (product === 'claude' ? [item] : []))
  fixture.mount()
  await flush()
  fixture.state.selectSystem('claude', 'windows')
  const html = await render(fixture.state),
    arm = option(panel(html, 'claude', 'windows').content, 'windows-arm64')
  assert.ok(html.includes('Claude Desktop 离线包（备用）'))
  assert.ok(arm.includes('href="' + item.url + '"'))
  assert.ok(arm.includes('下载 MSIX'))
  assert.ok(arm.includes('-SkipLicense -Regions all'))
  assert.ok(arm.includes('无需单独许可文件'))
  assert.ok(arm.includes('Claude-arm64.msix'))
  assert.equal(arm.includes('-LicensePath'), false)
  assert.equal(arm.includes('href="' + COS_ROOT + '/chatgpt/'), false)
  fixture.destroy()
})
test('an empty index renders preparation and retry without a guessed download URL', async () => {
  const fixture = setup(async () => [])
  fixture.mount()
  await flush()
  const html = await render(fixture.state)
  assert.ok(html.includes('安装包正在准备'))
  assert.ok(html.includes('重新读取'))
  assert.equal(html.includes('<a'), false)
  fixture.destroy()
})
test('system and architecture choices stay visible when loading, empty or failed', async () => {
  const fixture = setup(async () => [])
  for (const status of ['loading', 'ready', 'error']) {
    for (const product of ['manager', 'chatgpt', 'claude']) fixture.state.catalogs.value[product] = { status, items: [] }
    fixture.state.selectSystem('claude', 'macos')
    const html = await render(fixture.state)
    assert.equal((html.match(/data-system="windows"/g) || []).length, 3)
    assert.equal((html.match(/data-system="macos"/g) || []).length, 3)
    assert.equal((html.match(/data-system="linux"/g) || []).length, 0)
    assert.ok(html.includes('ARM64'))
    assert.ok(html.includes('Apple 芯片'))
    assert.equal(html.includes('Fedora'), false)
    assert.ok(html.includes('DMG'))
    assert.ok(html.includes('PKG'))
    assert.ok(html.includes('ZIP'))
    assert.equal(html.includes('DEB'), false)
    assert.equal(html.includes('RPM'), false)
    assert.equal(html.includes('Linux'), false)
    assert.ok(html.includes(' disabled'))
    assert.equal(html.includes('href="' + COS_ROOT), false)
    const claude = panel(html, 'claude', 'macos').content
    assert.equal((claude.match(/data-package="macos-dmg-universal"/g) || []).length, 1)
    assert.equal((claude.match(/data-package="macos-pkg-universal"/g) || []).length, 1)
    if (status === 'loading') assert.ok(html.includes('正在读取下载地址'))
    if (status === 'error') assert.ok(html.includes('下载地址暂时无法读取'))
    if (status !== 'loading') assert.ok(html.includes('重新读取'))
    fixture.state.selectSystem('claude', 'macos')
  }
  fixture.destroy()
})
test('system buttons toggle one panel across products and expose matching expanded states', async () => {
  const fixture = setup(async () => [])
  fixture.state.selectSystem('manager', 'macos')
  assert.equal(fixture.state.isActive('manager', 'macos'), true)
  assert.match(systemButton(await render(fixture.state), 'manager', 'macos'), /aria-expanded="true"/)
  fixture.state.selectSystem('manager', 'windows')
  assert.equal(fixture.state.isActive('manager', 'macos'), false)
  assert.equal(fixture.state.isActive('manager', 'windows'), true)
  fixture.state.selectSystem('claude', 'macos')
  assert.equal(fixture.state.isActive('manager', 'windows'), false)
  const html = await render(fixture.state)
  for (const product of ['manager', 'chatgpt', 'claude'])
    for (const system of ['windows', 'macos']) {
      const active = product === 'claude' && system === 'macos'
      assert.equal(panel(html, product, system).hidden, !active)
      assert.ok(systemButton(html, product, system).includes('aria-expanded="' + active + '"'))
    }
  fixture.state.selectSystem('unknown', 'windows')
  fixture.state.selectSystem('claude', 'linux')
  assert.equal(fixture.state.isActive('claude', 'macos'), true)
  fixture.state.selectSystem('claude', 'macos')
  assert.equal(fixture.state.activeSelection.value, null)
  fixture.destroy()
})
test('Escape closes the selected panel and returns focus to its current system button', async () => {
  const fixture = setup(async () => [])
  let focused = 0,
    oldFocused = 0,
    prevented = 0,
    stopped = 0
  fixture.state.selectSystem('manager', 'windows', {
    currentTarget: {
      focus() {
        oldFocused++
      }
    }
  })
  fixture.state.selectSystem('claude', 'macos', {
    currentTarget: {
      focus() {
        focused++
      }
    }
  })
  const event = {
    key: 'Escape',
    preventDefault() {
      prevented++
    },
    stopPropagation() {
      stopped++
    }
  }
  fixture.state.closeOnEscape({ ...event, key: 'Enter' })
  assert.equal(fixture.state.isActive('claude', 'macos'), true)
  assert.equal(focused, 0)
  fixture.state.closeOnEscape(event)
  assert.equal(fixture.state.activeSelection.value, null)
  assert.equal(focused, 1)
  assert.equal(oldFocused, 0)
  assert.equal(prevented, 1)
  assert.equal(stopped, 1)
  assert.match(systemButton(await render(fixture.state), 'claude', 'macos'), /aria-expanded="false"/)
  fixture.state.closeOnEscape(event)
  assert.equal(focused, 1)
  assert.equal(prevented, 1)
  fixture.destroy()
})
test('Claude Mac presents DMG and PKG as installation formats that both support Apple and Intel chips', async () => {
  const items = ['dmg', 'pkg'].map((format, index) => ({
    id: 'macos-' + format + '-universal',
    label: 'macOS 通用',
    architecture: 'universal',
    platform: 'macos',
    format,
    version: '2.19675.0',
    url:
      COS_ROOT +
      '/xingmang/offline/claude/macos-' +
      format +
      '-universal/sha256-' +
      String(index).repeat(64) +
      '/Claude-universal.' +
      format,
    bytes: 377037896,
    sha256: String(index).repeat(64)
  }))
  const fixture = setup(async (product) => (product === 'claude' ? items : []))
  fixture.mount()
  await flush()
  fixture.state.selectSystem('claude', 'macos')
  const mac = panel(await render(fixture.state), 'claude', 'macos')
  assert.equal(mac.hidden, false)
  assert.ok(mac.content.includes('选择安装方式'))
  assert.ok(mac.content.includes('两种格式均为通用版，支持 Apple 芯片与 Intel'))
  assert.ok(mac.content.includes('日常安装选择 DMG'))
  assert.equal(mac.content.includes('选择电脑的芯片类型'), false)
  assert.ok(option(mac.content, items[0].id).includes('DMG · 拖拽安装'))
  assert.ok(option(mac.content, items[1].id).includes('PKG · 安装向导'))
  for (const item of items) {
    const choice = option(mac.content, item.id)
    assert.ok(choice.includes('href="' + item.url + '"'))
    assert.ok(choice.includes('2.19675.0'))
    assert.ok(choice.includes(item.sha256))
  }
  fixture.destroy()
})
test('an unavailable product keeps a retryable state without hiding the other product', async () => {
  let failed = true
  const fixture = setup(async (product) => {
    if (product === 'manager' && failed) throw Error('Mock index unavailable')
    return product === 'manager' ? [{ id: 'macos-arm64' }] : []
  })
  fixture.mount()
  await flush()
  assert.equal(fixture.state.catalogs.value.manager.status, 'error')
  assert.equal(fixture.state.catalogs.value.chatgpt.status, 'ready')
  assert.equal(fixture.state.catalogs.value.claude.status, 'ready')
  failed = false
  await fixture.state.load('manager')
  assert.equal(fixture.state.catalogs.value.manager.status, 'ready')
  assert.equal(fixture.state.catalogs.value.manager.items[0].id, 'macos-arm64')
  fixture.destroy()
})
test('a newer request and unmount prevent slow responses from restoring stale download links', async () => {
  const requests = []
  const fixture = setup((product, options) => {
    const pending = deferred()
    requests.push({ ...pending, product, signal: options.signal })
    return pending.promise
  })
  const first = fixture.state.load('manager'),
    second = fixture.state.load('manager')
  assert.equal(requests[0].signal.aborted, true)
  requests[1].resolve([{ id: 'new' }])
  await second
  requests[0].resolve([{ id: 'old' }])
  await first
  assert.equal(fixture.state.catalogs.value.manager.items[0].id, 'new')
  const late = fixture.state.load('chatgpt')
  fixture.destroy()
  assert.equal(requests[2].signal.aborted, true)
  requests[2].resolve([{ id: 'after-unmount' }])
  await late
  assert.equal(fixture.state.catalogs.value.chatgpt.status, 'loading')
})
test('Windows offline instructions use the selected architecture and matching license filenames', () => {
  const fixture = setup(async () => [])
  assert.equal(
    fixture.state.windowsCommand({ fileName: 'ChatGPT-arm64.msix', licenseFileName: 'ChatGPT-License.xml' }),
    "Add-AppxProvisionedPackage -Online -PackagePath '.\\ChatGPT-arm64.msix' -LicensePath '.\\ChatGPT-License.xml' -Regions all"
  )
  fixture.destroy()
})
test('site configuration restricts download routing to the manager anchor and exactly three indexes', () => {
  const site = { download_page_url: '/guide/manager#download-installers', download_indexes: { ...INDEX_ROUTES } }
  validateDownloadConfiguration(site)
  for (const download_page_url of ['/guide/download', 'https://example.invalid/file', '//example.invalid/file'])
    assert.throws(() => validateDownloadConfiguration({ ...site, download_page_url }))
  for (const download_indexes of [
    undefined,
    [],
    { ...INDEX_ROUTES, extra: '/x' },
    { ...INDEX_ROUTES, manager: 'https://example.invalid/x' },
    { ...INDEX_ROUTES, chatgpt: '/cos-download-index/other.json' }
  ])
    assert.throws(() => validateDownloadConfiguration({ ...site, download_indexes }))
})
test('both current sites use the same selector without old Feishu downloads or platform defaults', () => {
  for (const id of ['newapi', 'sub2api']) {
    const site = JSON.parse(fs.readFileSync(new URL('../../' + id + '/site.json', import.meta.url), 'utf8'))
    validateDownloadConfiguration(site)
    assert.deepEqual(site.download_indexes, INDEX_ROUTES)
    assert.equal(JSON.stringify(site).includes('feishu.cn'), false)
  }
  const layout = fs.readFileSync(new URL('../../theme/StudioLayout.vue', import.meta.url), 'utf8')
  const manager = fs.readFileSync(new URL('../../shared/pages/guide/manager.md', import.meta.url), 'utf8')
  assert.equal(layout.includes('packageHref'), false)
  assert.ok(layout.includes('data.value.site.download_page_url'))
  assert.equal(manager.includes('飞书'), false)
  assert.equal(manager.includes('<p class="manager-download"><DownloadLink'), false)
})
