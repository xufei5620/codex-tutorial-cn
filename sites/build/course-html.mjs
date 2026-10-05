// Keep the generated curriculum wrapper as ONE HTML block. CommonMark normally
// ends a div HTML block at a blank line, then parses the indented original HTML
// as code/Markdown and can create invalid closing tags. This rule preserves the
// trusted, validated local source verbatim; it does not rewrite any lesson text.
export const COURSE_END = '</div><!-- xm-course-end -->'
const COURSE_START = '<div class="xm-course-body" v-pre>'
export function courseHtmlPlugin(md) {
  md.block.ruler.before('html_block', 'xm_course_html', (state, startLine, endLine, silent) => {
    const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
    if (!state.md.options.html || first.trim() !== COURSE_START) return false
    let last = startLine + 1
    for (; last < endLine; last++) {
      const line = state.src.slice(state.bMarks[last], state.eMarks[last]).trim()
      if (line === COURSE_END) break
    }
    if (last === endLine) throw new Error('Generated course HTML block is missing its end marker')
    if (silent) return true
    const token = state.push('html_block', '', 0)
    token.block = true
    token.map = [startLine, last + 1]
    token.content = state.getLines(startLine, last + 1, 0, true)
    state.line = last + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote'] })
}
