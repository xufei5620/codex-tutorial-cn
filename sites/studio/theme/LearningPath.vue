<script setup>
import {computed} from 'vue'
import {completionKey} from './learning-paths.mjs'
import './learning-path.css'

const props=defineProps({path:Object,position:{type:String,default:'top'},sections:{type:Array,default:()=>[]},activeSection:String,completed:{type:Array,default:()=>[]},backHref:String,storageMessage:String})
const emit=defineEmits(['complete'])
const isComplete=computed(()=>props.path&&props.completed.includes(completionKey(props.path.id,props.path.currentStep.id)))
function marked(step){return props.completed.includes(completionKey(props.path.id,step.id))}
</script>

<template>
<section v-if="path&&position==='top'" :key="path.id+path.currentStep.id" class="learning-path learning-compact" aria-label="当前教程路线">
 <div class="learning-toolbar">
 <div class="learning-return">
  <a :href="backHref||path.categoryHref">{{backHref?'← 返回上一页':'← 返回教程分类'}}</a>
  <a v-if="backHref" :href="path.categoryHref">{{path.categoryLabel}}目录</a>
 </div>
 <div class="learning-progress"><span>第 {{path.index+1}} / {{path.steps.length}} 步</span><span v-if="isComplete" class="learning-done">✓ 已确认</span></div>
 </div>
 <div class="learning-pickers">
 <details class="learning-route-picker">
  <summary>学习路线 <span>{{path.steps.length}} 步</span></summary>
  <ol class="learning-route-steps">
   <li v-for="(step,index) in path.steps" :key="step.id">
    <a :href="step.href" :aria-current="index===path.index?'step':undefined"><span class="learning-step-number">{{index+1}}</span><span>{{step.title}}<small v-if="marked(step)">✓ 已自行确认完成</small></span><span v-if="index===path.index" class="learning-here">当前</span></a>
   </li>
  </ol>
 </details>
 <details v-if="sections.length>1" class="article-outline">
  <summary>本篇目录 <span>{{sections.length}} 节</span></summary>
  <nav aria-label="本篇步骤"><ol><li v-for="section in sections" :key="section.id"><a :href="'#'+encodeURIComponent(section.id)" :aria-current="activeSection===section.id?'location':undefined">{{section.title}}</a></li></ol></nav>
 </details>
 </div>
</section>

<section v-else-if="path" class="learning-next" aria-label="教程前后步骤">
 <label class="learning-completion"><input type="checkbox" :checked="isComplete" @change="emit('complete',$event.target.checked)"><span>我已完成“{{path.currentStep.title}}”，并核对本页结果。<small>完成后自行勾选，可随时取消；不影响继续阅读。</small></span></label>
 <p class="learning-storage" role="status">{{storageMessage||'完成记录仅保存在当前浏览器。'}}</p>
 <nav class="learning-pager" aria-label="上一步与下一步">
  <a v-if="path.previous" class="learning-previous" :href="path.previous.href"><small>← 上一步</small><strong>{{path.previous.title}}</strong></a>
  <a v-else class="learning-previous" :href="path.categoryHref"><small>← 返回分类</small><strong>{{path.categoryLabel}}</strong></a>
  <a v-if="path.next" class="learning-forward" :href="path.next.href"><small>下一步 →</small><strong>{{path.next.title}}</strong></a>
  <a v-else class="learning-forward" :href="path.categoryHref"><small>本路线已到最后一步</small><strong>返回{{path.categoryLabel}}，选择其他内容 →</strong></a>
 </nav>
</section>
</template>
