<script setup>
import {ref,computed} from 'vue'
import {useShots} from './shot-store.js'
import {exportCourseHTML} from './offline-export.js'
const api=useShots(),input=ref(),shared=ref(false),shown=ref(false),filled=computed(()=>Object.values(api.state.records).filter(r=>r.images?.length).length)
async function load(e){try{await api.importJSON(e.target.files[0],shared.value)}catch(err){api.say(err.message)}e.target.value=''}
async function html(role){try{await exportCourseHTML(api,role);api.say('已导出11章课程与截图。编辑版可继续本地补图；不是服务器发布。')}catch(e){api.say(e.message)}}
</script>
<template><div v-if="api.state.editing||shown" class="editor-bar"><div><strong>{{api.state.editing?'截图编辑':'阅读预览'}} · 已补 {{filled}} / {{api.data.manifest.length}}</strong><small>仅在本机处理，不写入 GitHub。导出文件或 JSON 才能带到其他设备。</small></div><div class="actions"><button v-if="api.state.cache" @click="api.restore">恢复本机草稿</button><a class="soft-button" href="/screenshots">截图清单</a><button @click="api.state.editing=!api.state.editing;shown=true">{{api.state.editing?'阅读预览':'返回编辑'}}</button><button @click="api.exportJSON()">保存全部备份</button><button @click="input.value='';input.click()">导入备份</button><button @click="html('reader')">导出课程阅读版</button><button class="gold-button" @click="html('editor')">导出课程补图版</button></div><label class="shared-opt"><input type="checkbox" v-model="shared"> 导入另一站时，仅接受明确标为通用且允许共用的图片位</label><label class="shared-opt"><input type="checkbox" v-model="api.state.hideMissing"> 阅读时隐藏未补图的位置，不删除配置</label><input ref="input" type="file" accept=".json,application/json" hidden @change="load"></div><button v-else class="mobile-support-link" @click="shown=true;api.state.editing=true">进入本机截图编辑（不发布）</button></template>
