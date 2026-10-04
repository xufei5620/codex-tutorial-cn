<script setup>
import {ref,computed} from 'vue'
import {useRoute} from 'vitepress'
import {useShots} from './shot-store.js'
import {exportCourseHTML} from './offline-export.js'
import {chapterRecommendation} from './shot-presentation.mjs'
const api=useShots(),route=useRoute(),input=ref(),shared=ref(false),shown=ref(false),canEdit=computed(()=>api.state.localAvailable),filled=computed(()=>Object.values(api.state.records).filter(r=>r.images?.length).length),recommended=computed(()=>api.data.manifest.filter(s=>s.capturePolicy==='required')),currentPath=computed(()=>route.path.replace(/\/$/,'')),isCatalog=computed(()=>currentPath.value==='/screenshots'),chapterRecommended=computed(()=>recommended.value.filter(s=>s.route===currentPath.value)),recommendation=computed(()=>chapterRecommendation(api.data.manifest,api.state.records,currentPath.value,isCatalog.value)),scopedRecommended=computed(()=>recommendation.value.list),recommendedFilled=computed(()=>scopedRecommended.value.filter(s=>api.state.records[s.id]?.images?.length).length),recommendedLabel=computed(()=>recommendation.value.label)
const loading=computed(()=>api.state.saveStatus==='loading')
const statusText=computed(()=>({
 loading:'正在读取本机截图…',
 saving:'正在自动保存…',
 saved:'已自动保存到本机',
 error:'自动保存失败',
 conflict:'其他窗口已修改，自动保存已暂停',
 browser:'自动保存在浏览器草稿中',
 idle:'自动保存已开启'
}[api.state.saveStatus]||'正在准备自动保存…'))
const savedTime=computed(()=>api.state.savedAt?new Date(api.state.savedAt).toLocaleTimeString('zh-CN',{hour12:false}):'')
async function run(action){try{await action()}catch(err){api.say(err.message)}}
async function load(e){try{await api.importJSON(e.target.files[0],shared.value)}catch(err){api.say(err.message)}e.target.value=''}
async function html(role){try{await exportCourseHTML(api,role);api.say('已导出11章课程与截图。编辑版可继续本地补图；不是服务器发布。')}catch(e){api.say(e.message)}}
</script>
<template>
 <div v-if="canEdit&&(api.state.editing||shown)" class="editor-bar">
  <div>
   <strong>{{api.state.editing?'截图编辑':'阅读预览'}} · {{recommendedLabel}}已补 {{recommendedFilled}} / {{scopedRecommended.length}}（全部已补 {{filled}}）</strong>
   <small>先补“建议截图”；可选项默认隐藏。截图与说明自动保存。</small>
  </div>
  <div class="actions">
   <button v-if="api.state.cache&&api.state.saveStatus!=='conflict'" :disabled="loading||api.state.busy" @click="run(api.restore)">恢复本机草稿</button>
   <a class="soft-button" href="/screenshots">截图清单</a>
   <button @click="api.state.editing=!api.state.editing;shown=true">{{api.state.editing?'阅读预览':'返回编辑'}}</button>
   <button :disabled="loading||api.state.busy" @click="run(api.exportJSON)">导出全部备份</button>
   <button :disabled="loading||api.state.busy||api.state.saveStatus==='conflict'" @click="input.value='';input.click()">导入备份</button>
   <button :disabled="loading||api.state.busy" @click="html('reader')">导出课程阅读版</button>
   <button class="gold-button" :disabled="loading||api.state.busy" @click="html('editor')">导出课程补图版</button>
  </div>
  <div class="save-row" :data-save-status="api.state.saveStatus">
   <div class="save-message" role="status" aria-live="polite" aria-atomic="true">
    <span>{{statusText}}</span>
    <time v-if="api.state.saveStatus==='saved'&&savedTime" :datetime="new Date(api.state.savedAt).toISOString()" :title="new Date(api.state.savedAt).toLocaleString('zh-CN')">{{savedTime}}</time>
    <span v-if="api.state.saveStatus==='error'&&api.state.saveError">：{{api.state.saveError}}</span>
    <span v-if="api.state.saveStatus==='conflict'">。请先导出当前备份，再重新加载磁盘内容。</span>
    <span v-if="api.state.saveStatus==='browser'">；导出备份可另存为文件。</span>
   </div>
   <button v-if="api.state.saveStatus==='error'" :disabled="api.state.busy" @click="run(api.retrySave)">重试保存</button>
   <button v-if="api.state.saveStatus==='conflict'" :disabled="api.state.busy" @click="run(api.reloadSaved)">重新加载磁盘内容</button>
   <details v-if="api.state.localAvailable&&api.state.saveDirectory" class="save-directory">
    <summary>保存位置</summary>
    <div>{{api.state.saveDirectory}}</div>
   </details>
  </div>
  <label class="shared-opt"><input type="checkbox" v-model="api.state.showOptional"> 显示可选截图位（不显示也不影响学习）</label>
  <label class="shared-opt"><input type="checkbox" v-model="shared"> 导入另一站时，仅接受明确标为通用且允许共用的图片位</label>
  <label class="shared-opt"><input type="checkbox" v-model="api.state.hideMissing" :disabled="loading||api.state.saveStatus==='conflict'"> 阅读时隐藏未补图的位置，不删除配置</label>
  <input ref="input" type="file" accept=".json,application/json" hidden @change="load">
 </div>
 <button v-else-if="canEdit" class="mobile-support-link" @click="shown=true;api.state.editing=true">进入本机截图编辑（不发布）</button>
</template>

<style scoped>
.save-row{display:flex;flex-basis:100%;align-items:center;flex-wrap:wrap;gap:6px 12px;min-width:0;color:#405c48;font-size:12px;line-height:1.6}
.save-message{overflow-wrap:anywhere}
.save-message time{margin-left:7px;color:#677386;font-variant-numeric:tabular-nums}
.save-row[data-save-status="loading"],.save-row[data-save-status="saving"],.save-row[data-save-status="idle"],.save-row[data-save-status="browser"]{color:#52667e}
.save-row[data-save-status="error"],.save-row[data-save-status="conflict"]{color:#934529}
.save-directory{margin:0;padding:0;border:0;background:transparent;min-width:0;max-width:100%;color:#52667e}
.save-directory summary{font-size:11px;font-weight:500;text-decoration:underline;text-underline-offset:3px}
.save-directory summary:focus-visible{outline:3px solid #93bceb;outline-offset:4px}
.save-directory div{margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:white;overflow-wrap:anywhere;user-select:text}
.save-directory[open]{flex-basis:100%}
@media(max-width:760px){.save-row{font-size:11px;gap:6px 9px}.save-row button{min-height:32px}}
</style>
