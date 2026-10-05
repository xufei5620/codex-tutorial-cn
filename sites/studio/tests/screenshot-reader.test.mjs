import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp, h, provide } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { safeRecord } from '../../theme/shot-schema.mjs'

let server, ScreenshotSlot, SHOTS
before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('../../', import.meta.url)),
    plugins: [vue()],
    server: { middlewareMode: true },
    logLevel: 'error'
  })
  ScreenshotSlot = (await server.ssrLoadModule('/theme/ScreenshotSlot.vue')).default
  SHOTS = (await server.ssrLoadModule('/theme/shot-store.js')).SHOTS
})
after(async () => {
  await server?.close()
})

async function renderSlot({ record = {}, spec = {}, editing = false, localAvailable = false, fallbackFigure = null } = {}) {
  const api = {
    specs: new Map([['fixture', { id: 'fixture', title: '步骤截图', capturePolicy: 'published', ...spec }]]),
    state: { records: { fixture: safeRecord(record) }, editing, localAvailable, hideMissing: false, showOptional: false, active: '' }
  }
  return renderToString(
    createSSRApp({
      setup() {
        provide(SHOTS, api)
        return () => h(ScreenshotSlot, { slotId: 'fixture', fallbackFigure })
      }
    })
  )
}
function screenshot(n) {
  return { data: `/screenshots/${String(n).repeat(64)}.png`, name: `截图 ${n}`, width: 800, height: 600 }
}

test('reader server-rendering preserves all six screenshots, dimensions, alt text and captions', async () => {
  assert.equal(typeof window, 'undefined')
  const images = Array.from({ length: 6 }, (_, i) => screenshot(i + 1))
  const html = await renderSlot({ record: { images, alt: '验证结果', caption: '保留这段图注' } })
  assert.equal((html.match(/<img /g) || []).length, 6)
  assert.equal((html.match(/id="shot-fixture"/g) || []).length, 1)
  assert.equal((html.match(/width="800" height="600"/g) || []).length, 6)
  assert.equal((html.match(/alt="验证结果"/g) || []).length, 6)
  assert.equal((html.match(/<figcaption[^>]*>保留这段图注<\/figcaption>/g) || []).length, 6)
  assert.equal((html.match(/aria-haspopup="dialog"/g) || []).length, 6)
  for (const image of images) assert.ok(html.includes(image.data))
  assert.ok(html.includes('第 6 张，共 6 张'))
  assert.equal((html.match(/<dialog /g) || []).length, 1)
  assert.equal(html.includes('src=""'), false)
})

test('hidden reading slots render neither uploaded images nor course fallback', async () => {
  const html = await renderSlot({ record: { hidden: true, images: [screenshot(1)] }, spec: { fallback: '/img/shared/course.png' } })
  assert.equal(html.includes('<img'), false)
  assert.equal(html.includes('<dialog'), false)
  assert.equal(html.includes('course.png'), false)
})

test('empty image records retain the course fallback and its original accessible description', async () => {
  const html = await renderSlot({
    spec: { fallback: '/img/shared/course.png' },
    fallbackFigure: { alt: '完整的课程原图说明', caption: '原始配图图注', width: 1280, height: 720 }
  })
  assert.equal((html.match(/<img /g) || []).length, 1)
  assert.ok(html.includes('src="/img/shared/course.png"'))
  assert.ok(html.includes('alt="完整的课程原图说明"'))
  assert.ok(html.includes('width="1280" height="720"'))
  assert.ok(html.includes('原始配图图注'))
})

test('uploaded images replace the fallback and use locally edited text', async () => {
  const html = await renderSlot({
    record: { images: [screenshot(1), screenshot(2)], alt: '我的替代说明', caption: '我的图注' },
    spec: { fallback: '/img/shared/course.png' },
    fallbackFigure: { alt: '课程说明', caption: '课程图注' }
  })
  assert.equal(html.includes('course.png'), false)
  assert.equal(html.includes('课程图注'), false)
  assert.equal((html.match(/alt="我的替代说明"/g) || []).length, 2)
  assert.equal((html.match(/<figcaption[^>]*>我的图注<\/figcaption>/g) || []).length, 2)
})

test('ordinary tutorial screenshots expose preview buttons without a chapter click handler', async () => {
  const html = await renderSlot({ record: { images: [screenshot(1), screenshot(2)] }, spec: { capturePolicy: 'required' } })
  assert.equal((html.match(/aria-haspopup="dialog"/g) || []).length, 2)
  assert.ok(html.includes('aria-label="截图预览"'))
  assert.ok(html.includes('aria-label="关闭截图预览"'))
})

test('editing preserves hidden screenshots, metadata controls and upload input', async () => {
  const html = await renderSlot({ record: { hidden: true, images: [screenshot(1), screenshot(2)] }, editing: true, localAvailable: true })
  assert.equal((html.match(/<img /g) || []).length, 2)
  assert.ok(html.includes('编辑说明 / 隐藏'))
  assert.ok(html.includes('type="file"'))
  assert.ok(html.includes('此位置已隐藏'))
  assert.ok(html.includes('替换'))
  assert.ok(html.includes('移除'))
})

test('server rendering preserves unverified image sources until the browser checks loading', async () => {
  const image = screenshot(9)
  const html = await renderSlot({ record: { images: [image], alt: '原图替代说明', caption: '保留原图注' } })
  assert.ok(html.includes(`src="${image.data}"`))
  assert.ok(html.includes('alt="原图替代说明"'))
  assert.ok(html.includes('保留原图注'))
  assert.equal(html.includes('这张截图暂时无法加载'), false)
  assert.equal(html.includes('重试加载'), false)
})
