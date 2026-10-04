<script setup>
import {computed,ref,onMounted,onBeforeUnmount,watch,nextTick} from 'vue'
import {useData} from 'vitepress'
import ScreenshotSlot from './ScreenshotSlot.vue'
const props=defineProps({chapterId:String})
const {theme}=useData()
const data=computed(()=>theme.value.studio)
const chapters=computed(()=>data.value.chapters||[])
const chapter=computed(()=>chapters.value.find(c=>c.id===props.chapterId))
const index=computed(()=>chapters.value.findIndex(c=>c.id===props.chapterId))
const prev=computed(()=>index.value>0?chapters.value[index.value-1]:null)
const next=computed(()=>index.value>=0&&index.value<chapters.value.length-1?chapters.value[index.value+1]:null)
const titled=computed(()=>(chapter.value?.sections||[]).filter(s=>s.title&&s.title!=='正文'))
const preview=ref(null)
const root=ref()
const targets=ref([])
function sectionNo(i){return String(i+1).padStart(2,'0')}
async function bindShots(){
  targets.value=[]
  await nextTick()
  const hosts=[...(root.value?.querySelectorAll('.course-shot[data-shot-id]')||[])]
  targets.value=hosts.map(host=>({id:host.dataset.shotId,host}))
}
function openPreview(e){
  const img=e.target.closest('.yichen-figure img')
  if(!img)return
  preview.value={src:img.currentSrc||img.src,alt:img.alt||'配图预览'}
}
function closePreview(){preview.value=null}
function onKey(e){if(e.key==='Escape'&&preview.value)closePreview()}
watch(()=>chapter.value?.id,bindShots,{immediate:true})
onMounted(()=>window.addEventListener('keydown',onKey))
onBeforeUnmount(()=>window.removeEventListener('keydown',onKey))
</script>
<template>
<article v-if="chapter" ref="root" class="studio-lesson yichen-lesson" @click="openPreview">
  <a class="crumb" href="/learn/codex/">← Codex 零基础</a>
  <header class="lesson-hero">
    <p class="eyebrow">第 {{chapter.n}} 章 · {{chapter.part}}</p>
    <h1>{{chapter.shortTitle||chapter.title}}</h1>
    <p class="lead">{{chapter.blurb||chapter.lead}}</p>
    <p class="lesson-meta">
      <span>{{chapter.imageCount||0}} 张配图</span>
      <span>{{titled.length}} 个小节</span>
    </p>
  </header>
  <nav v-if="titled.length>1" class="section-index" aria-label="本章目录">
    <a v-for="(s,i) in titled" :key="s.anchor" :href="'#'+s.anchor">
      <em>{{sectionNo(i)}}</em>
      <span>{{s.title}}</span>
    </a>
  </nav>
  <section v-for="s in chapter.sections" :id="s.anchor" :key="s.anchor" class="course-section">
    <h2 v-if="s.title && s.title!=='正文'">{{s.title}}</h2>
    <div class="yichen-article" v-html="s.body"></div>
  </section>
  <nav class="chapter-pager">
    <a v-if="prev" :href="'/learn/codex/'+prev.id">← {{prev.shortTitle||prev.title}}</a>
    <a href="/learn/codex/">课程目录</a>
    <a v-if="next" :href="'/learn/codex/'+next.id">{{next.shortTitle||next.title}} →</a>
  </nav>
  <Teleport v-for="target in targets" :key="target.id" :to="target.host">
    <ScreenshotSlot :slot-id="target.id"/>
  </Teleport>
  <Teleport to="body">
    <div v-if="preview" class="yichen-lightbox" role="dialog" aria-modal="true" aria-label="配图预览" @click.self="closePreview">
      <button class="yichen-lightbox-close" type="button" @click="closePreview">关闭</button>
      <img :src="preview.src" :alt="preview.alt">
    </div>
  </Teleport>
</article>
</template>
