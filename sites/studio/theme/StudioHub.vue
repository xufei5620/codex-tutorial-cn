<script setup>
import {computed} from 'vue'
import {useData} from 'vitepress'
defineProps({kind:{type:String,default:'home'}})
const {theme}=useData()
const d=computed(()=>theme.value.studio)
const catalog=computed(()=>d.value?.catalog||{howTo:[],parts:[],chapters:[]})
const courseChapters=computed(()=>d.value?.chapters||[])
</script>
<template>
<div v-if="kind==='home'" class="studio-home">
  <section class="studio-hero">
    <p class="eyebrow">从这里开始</p>
    <h1>从第一次连接，<br><em>到真正用起来。</em></h1>
    <p>先用管理工具接上，再跟着 Codex 零基础把界面看懂，做出一份能打开的文件。</p>
    <div class="actions">
      <a href="/learn/codex/" class="gold-button">打开 Codex 零基础 →</a>
      <a href="/guide/manager" class="outline-button">打开管理工具 ↗</a>
    </div>
    <div class="hero-orbit" aria-hidden="true"><i></i><i></i><b>✦</b></div>
  </section>
  <div class="hub-stat">
    <span><b>{{d.scope.totalChapters||2}}</b> 章课程</span>
    <span><b>{{d.scope.totalFigures||0}}</b> 张配图</span>
    <a href="/skills">Skill 工坊 →</a>
  </div>
  <section>
    <div class="section-heading">
      <div>
        <p class="eyebrow">选择学习路线</p>
        <h2>今天，想从哪里开始？</h2>
      </div>
      <a href="/learn/codex/">打开 Codex 零基础 →</a>
    </div>
    <div class="path-grid">
      <a href="/learn/codex/" class="path-card">
        <span class="number">01</span>
        <h3>先认界面，再交付</h3>
        <p>看懂左边、中间、右边和设置，再照着做出一份能打开的文件。</p>
        <strong>打开 Codex 零基础 →</strong>
      </a>
      <a href="/guide/manager" class="path-card">
        <span class="number">02</span>
        <h3>把工具接起来</h3>
        <p>用管理工具检测环境、写入本站配置；适配范围以当前版本为准。</p>
        <strong>管理工具使用 →</strong>
      </a>
      <a href="/errors" class="path-card">
        <span class="number">03</span>
        <h3>我遇到了问题</h3>
        <p>按报错文案找原因，先处理配置和额度，再决定是否重试。</p>
        <strong>错误码与排查 →</strong>
      </a>
    </div>
  </section>
  <section class="hub-callout">
    <div>
      <p class="eyebrow">边做边学</p>
      <h2>先做对一次，再把方法留下。</h2>
      <p>把做顺的步骤写成 Skill，下次直接调用，不必从头再讲一遍。</p>
    </div>
    <div class="actions">
      <a class="dark-button" href="/skills">进入 Skill 工坊</a>
      <a class="soft-button" href="/learn/codex/">Codex 零基础 →</a>
    </div>
  </section>
</div>

<div v-else-if="kind==='course'" class="course-index yichen-catalog">
  <header class="course-hero">
    <p class="eyebrow">Codex 零基础</p>
    <h1>先看懂界面，再做出一份文件</h1>
    <p class="lead">第一章认清左边、中间、右边和设置；第二章照着做出 Word、PPT 或网页。</p>
    <ol class="yichen-howto">
      <li v-for="(item,i) in catalog.howTo" :key="i">{{item}}</li>
    </ol>
  </header>
  <div class="course-pair">
    <a v-for="ch in courseChapters" :key="ch.id" :href="'/learn/codex/'+ch.id" class="course-card">
      <span class="course-card-media" aria-hidden="true">
        <img v-if="ch.cover" :src="ch.cover" alt="">
      </span>
      <span class="toc-num">第 {{ch.n}} 章 · {{ch.part}}</span>
      <strong>{{ch.shortTitle||ch.title}}</strong>
      <p>{{ch.blurb||ch.lead}}</p>
      <small>{{ch.imageCount||0}} 张配图</small>
      <em>开始阅读 →</em>
    </a>
  </div>
</div>
</template>
