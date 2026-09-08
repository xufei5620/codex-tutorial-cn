<script setup>
import {computed} from 'vue'
import {useData} from 'vitepress'
import ScreenshotSlot from './ScreenshotSlot.vue'
const props=defineProps({caseId:String}),{theme}=useData(),item=computed(()=>theme.value.studio.industries.find(x=>x.id===props.caseId))
</script>
<template><article v-if="item" class="studio-lesson"><a href="/industry/" class="crumb">← 行业实战</a><p class="eyebrow">{{item.name}} / ORIGINAL PRACTICE</p><h1>{{item.title}}</h1><p class="lead">使用虚构材料完成一份可检查的草稿。先核对事实，再决定是否用于真实业务。</p><section v-for="[id,title,key] in [['input','01 · 准备材料','input'],['prompt','02 · 试一个清楚的请求','prompt'],['output','03 · 作者参考，不是模型实测','output']]" :key="id" :id="id" class="course-section"><h2>{{title}}</h2><pre>{{item[key]}}</pre><button class="soft-button" :data-copy="item[key]">复制{{id==='output'?'参考':'内容'}}</button><ScreenshotSlot :slot-id="'industry-'+item.id+'-'+id" /></section><section id="check" class="practice-panel"><h2>04 · 核对这几件事</h2><ul><li v-for="c in item.check" :key="c">{{c}}</li></ul><p class="edu-note">{{item.pitfall}}</p><ScreenshotSlot :slot-id="'industry-'+item.id+'-check'" /></section><section id="repeat" class="course-section"><h2>05 · 换一份材料再试</h2><p>{{item.variation}}</p><ScreenshotSlot :slot-id="'industry-'+item.id+'-repeat'" /><h3>怎样沉淀成 Skill</h3><p>{{item.skill}}</p><a href="/skills" class="dark-button">进入 Skill 工坊 →</a></section></article></template>
