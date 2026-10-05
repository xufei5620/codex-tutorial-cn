import test from 'node:test'
import assert from 'node:assert/strict'
import {searchableMarkdown} from '../../build/docs.mjs'

test('search metadata excludes executable SFC content and style blocks',()=>{
 const markdown=searchableMarkdown('# 下载\n<script setup>location.replace("/guide/manager")</script>\n## 安装\n步骤\n<style>.hidden{display:none}</style>')
 assert.match(markdown,/# 下载\n/)
 assert.match(markdown,/## 安装\n步骤/)
 assert.doesNotMatch(markdown,/location|display|<script|<style|<\/script/i)
})

test('a literal closing script tag cannot terminate inline site metadata',()=>{
 for(const source of ['正文 </script> 示例','正文 </ScRiPt > 示例','<script setup>unfinished']){
  assert.doesNotMatch(JSON.stringify({markdown:searchableMarkdown(source)}),/<\/script/i)
 }
})
