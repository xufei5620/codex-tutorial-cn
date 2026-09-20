<script setup>
import {computed,ref} from 'vue'
import {useData} from 'vitepress'
defineProps({kind:{type:String,default:'home'}})
const {theme}=useData()
const d=computed(()=>theme.value.studio)
const catalog=computed(()=>d.value?.catalog||{howTo:[],parts:[],chapters:[]})
const courseChapters=computed(()=>d.value?.chapters||[])
const site=computed(()=>d.value?.site||{})
const origin=computed(()=>site.value.base_url||site.value.site_url||'')
const query=ref('')
const filter=ref('all')
const tools=[['codex','OpenAI / Codex','从第一次对话，到项目与文件协作。','platform'],['claude-code','Claude Code','先完成连接，再学习受控的终端任务。','platform'],['gemini-cli','Gemini CLI','Google 终端工具的接入与使用。','platform'],['grok-build','Grok Build','先核对可用功能和接入条件。','platform'],['hermes','Hermes','Agent 工作方式与工具连接。','agent'],['openclaw','OpenClaw','模型、消息渠道与助手任务。','agent'],['opencode','OpenCode','按当前产品配置模型提供方。','agent'],['deepseek-harness','DeepSeek Harness','本地 Web 与 Agent 工作流。','agent'],['cursor','Cursor','在代码编辑器中协作。','editor'],['vscode','VS Code','分别理解终端、扩展和工作区。','editor']]
const shown=computed(()=>tools.filter(t=>(filter.value==='all'||filter.value===t[3])&&t.join(' ').toLowerCase().includes(query.value.toLowerCase())))
function toolBase(id){
  if(id==='codex')return site.value.codex_base_url||origin.value
  if(id==='openclaw')return site.value.openclaw_base_url||(origin.value?origin.value.replace(/\/$/,'')+'/v1':'')
  if(id==='claude-code'||id==='gemini-cli')return origin.value
  return ''
}
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
      <a href="/tools" class="path-card">
        <span class="number">02</span>
        <h3>把工具接起来</h3>
        <p>按产品找到连接方法，确认认证、模型与本站配置。</p>
        <strong>打开工具接入 →</strong>
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

<div v-else-if="kind==='tools'" class="tools-hub">
  <header class="page-hero">
    <p class="eyebrow">工具接入</p>
    <h1>找到你的工具，<br>只看对应的那一篇。</h1>
    <p class="lead">同一家产品不硬拆一排 IDE 名称。接入条件按当前产品、版本和本站配置确认。</p>
  </header>
  <a class="hub-callout" href="/guide/manager"><strong>不想逐项手动配置？</strong><span>了解星芒 AI 管理工具 →</span></a>
  <div class="filter-bar">
    <input v-model="query" placeholder="搜索工具名称" aria-label="搜索工具">
    <button v-for="[id,label] in [['all','全部'],['platform','主要平台'],['agent','Agent 工具'],['editor','编辑器']]" :key="id" :class="{active:filter===id}" @click="filter=id">{{label}}</button>
  </div>
  <div class="tool-grid">
    <a v-for="t in shown" :key="t[0]" :href="'/clients/'+t[0]" class="tool-card">
      <span class="tool-monogram" aria-hidden="true">{{t[1].slice(0,2)}}</span>
      <h2>{{t[1]}}</h2>
      <p>{{t[2]}}</p>
      <code v-if="toolBase(t[0])" class="tool-url">{{toolBase(t[0])}}</code>
      <strong>打开对应教程 →</strong>
    </a>
  </div>
  <p v-if="!shown.length" class="edu-note">没有匹配工具，请尝试其他关键词。</p>
</div>
</template>
