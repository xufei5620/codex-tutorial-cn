// The "Codex 零基础" course: the yichen picture course in studio/content/yichen.
import path from 'node:path'
import { esc, readJson } from './util.mjs'

function safeProse(html) {
  if (/<\s*(script|iframe|object|embed)\b|\son\w+\s*=|(?:href|src)\s*=\s*['"]\s*javascript:/i.test(html))
    throw Error('Unexpected executable markup in course source')
  return html
}

function routeRewrites(html) {
  return html
    .replace(/href="#\/skills"/g, 'href="/skills"')
    .replace(/href="#\/atlas\/[^"\s]+"/g, 'href="/learn/codex/ch07#s2"')
    .replace(/href="#\/chapter\/(ch\d+)\?s=(\d+)"/g, (_, c, s) => 'href="/learn/codex/' + c + '#s' + (Number(s) + 1) + '"')
}

/** Wraps each course figure so a local screenshot can replace it, and lists it in the manifest. */
export function attachCourseFigures(chapter, manifest = []) {
  let total = 0
  chapter.sections = (chapter.sections || []).map((section, index) => {
    let n = 0
    const body = String(section.body || '').replace(/<figure class="yichen-figure">([\s\S]*?)<\/figure>/g, (full, inner) => {
      const src = inner.match(/\bsrc="([^"]+)"/)?.[1] || ''
      if (!src) return full
      n++
      total++
      const alt = inner.match(/\balt="([^"]*)"/)?.[1] || section.title || '配图'
      const id = 'fig-' + chapter.id + '-s' + String(index + 1).padStart(2, '0') + '-' + String(n).padStart(2, '0')
      manifest.push({
        id,
        route: '/learn/codex/' + chapter.id,
        group: chapter.shortTitle || chapter.title,
        section: section.title || '正文',
        title: String(alt).slice(0, 90),
        target: '可用本机截图替换这张课程配图',
        highlight: '替换后只保存在本机，不会发布到网站。',
        optional: true,
        capturePolicy: 'published',
        siteOnly: false,
        fallback: src
      })
      return '<div class="course-shot" data-shot-id="' + esc(id) + '">' + full + '</div>'
    })
    return { ...section, body }
  })
  if (!chapter.imageCount) chapter.imageCount = total
  return chapter
}

export function loadCourse(contentDirectory) {
  const read = (file) => readJson(path.join(contentDirectory, file))
  const catalog = read('yichen/catalog.json')
  const chapters = catalog.chapters.map((meta) => {
    const ch = read('yichen/chapters/' + meta.id + '.json')
    return {
      ...meta,
      ...ch,
      sections: (ch.sections || []).map((section, index) => ({
        ...section,
        title: section.title || '',
        body: routeRewrites(safeProse(section.body || '')),
        anchor: 's' + (index + 1),
        capturePolicy: 'none',
        kind: 'read'
      }))
    }
  })
  const sources = read('sources.json')
  sources.yichen = {
    title: '逸尘 Codex 图文教程（社区原文，已去引流内容）',
    url: 'https://github.com/xianyu110/awesome-codex-tutorial/tree/master/tutorials/yichen-codex-articles',
    kind: '社区教程整理',
    checked: '2026-09-12'
  }
  return { catalog, chapters, sources }
}
