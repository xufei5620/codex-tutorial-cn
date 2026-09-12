<script setup>
import {ref,computed} from 'vue'
import {useShots} from './shot-store.js'
import {catalogHref} from './shot-presentation.mjs'
const api=useShots(),q=ref(''),filter=ref('published')
const rows=computed(()=>api.data.manifest.filter(s=>{
  const r=api.state.records[s.id]||{}
  const state=r.hidden?'hidden':r.images?.length?'filled':'empty'
  const kind=filter.value==='recommended'&&s.capturePolicy==='required'||filter.value==='optional'&&s.capturePolicy==='optional'||filter.value==='published'&&s.capturePolicy==='published'
  return (filter.value==='all'||filter.value===state||kind)&&(s.id+' '+s.group+' '+s.title).toLowerCase().includes(q.value.toLowerCase())
}))
function href(s){return catalogHref(s,api.state.records[s.id]||{})}
function policyText(s){
  const r=api.state.records[s.id]
  if(r?.hidden)return '已隐藏'
  if(r?.images?.length)return '已替换'
  if(s.capturePolicy==='published')return '课程原图'
  if(s.capturePolicy==='required')return '建议截图'
  if(s.capturePolicy==='optional')return '可选截图'
  return '无需截图'
}
</script>
<template>
<article class="studio-lesson">
  <p class="eyebrow">你的截图 / 本机版本</p>
  <h1>只补真正有用的截图。</h1>
  <p v-if="!api.state.localAvailable" class="edu-note">截图编辑只在本机预览里开放，正式站点不会出现这个入口。课程页仍显示原图。</p>
  <template v-else>
    <p class="lead">Codex 零基础里的配图可以换成你自己的截图，只保存在本机。先补课程配图，再补建议截图。</p>
    <button class="gold-button" @click="api.state.editing=true">开始本机截图编辑</button>
    <p class="capture-guide"><strong>顺序：</strong>打开对应章节 → 替换原图 → 等顶部显示“已自动保存到本机”。替换不会发布到网站。</p>
  </template>
  <p v-if="api.state.unknown.length" class="edu-note">{{api.state.unknown.length}} 个旧图片位暂未找到当前位置，已保留在备份中。请核对位置后手动迁移，不会静默删除。</p>
  <div class="filter-bar">
    <input v-model="q" placeholder="搜索章节、步骤或图片位ID" aria-label="搜索截图位">
    <button v-for="[id,label] in [['all','全部'],['published','课程配图'],['recommended','建议截图'],['optional','可选截图'],['filled','已替换']]" :key="id" @click="filter=id" :class="{active:filter===id}">{{label}}</button>
  </div>
  <p>{{rows.length}} 个匹配位置</p>
  <div class="catalog">
    <a v-for="s in rows" :key="s.id" :href="href(s)" @click="api.state.localAvailable&&(api.state.editing=true)">
      <div>
        <small>{{s.group}} · {{s.section}}</small>
        <h3>{{s.title}}</h3>
        <p>{{s.target}}</p>
        <code>{{s.id}}</code>
      </div>
      <span>{{policyText(s)}} →</span>
    </a>
  </div>
</article>
</template>
