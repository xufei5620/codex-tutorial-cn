<script setup>
import { computed, ref } from 'vue';
import { useData } from 'vitepress';
import BrandIcon from './BrandIcon.vue';
import { filterTutorialTools, tutorialToolBase, tutorialTools } from './tools-registry.mjs';
import './learning-hub.css';

defineProps({ kind: { type: String, default: 'home' } });
const { theme } = useData();
const d = computed(() => theme.value.studio);
const catalog = computed(() => d.value?.catalog || { howTo: [], parts: [], chapters: [] });
const courseChapters = computed(() => d.value?.chapters || []);
const site = computed(() => d.value?.site || {});
const query = ref('');
const filter = ref('all');
const shown = computed(() => filterTutorialTools(query.value, filter.value));
function toolBase(id) {
  return tutorialToolBase(id, site.value);
}
function resetTools() {
  query.value = '';
  filter.value = 'all';
}
</script>

<template>
  <div v-if="kind === 'home'" class="studio-home learning-home overview-home">
    <header class="overview-heading"
      ><h1>教程总览</h1><p class="lead">选择你要使用的工具，从安装接入开始，或直接找到需要的教程。</p></header
    >
    <section class="tutorial-categories" aria-label="选择教程分类">
      <div class="learning-paths">
        <a v-for="tool in tutorialTools" :key="tool.id" :href="tool.href" :class="{ 'primary-tool': tool.id === 'manager' }"
          ><BrandIcon :name="tool.id" :size="36" /><h2>{{ tool.name }}</h2
          ><p>{{ tool.summary }}</p
          ><strong>查看学习路线 <span aria-hidden="true">↗</span></strong></a
        >
      </div>
    </section>
    <section class="overview-basics" aria-labelledby="overview-before"
      ><h2 id="overview-before">开始前，先准备好</h2><p>登录本站并核对可用额度，再按所选工具的教程配置服务地址、密钥和模型。</p
      ><nav aria-label="通用准备"
        ><a href="/guide/account">账号准备</a><a href="/guide/connection-basics">地址、密钥和模型</a
        ><a href="/guide/choose-tool">还不知道选哪个工具</a></nav
      ></section
    >
    <section class="overview-practice" aria-labelledby="overview-practice-title"
      ><h2 id="overview-practice-title">已经接好？直接开始练习</h2
      ><nav aria-label="选择练习"
        ><a href="/learn/first-task"><BrandIcon name="codex" :size="22" /><span>Codex 第一次任务</span></a
        ><a href="/learn/claude/first-task?track=claude-code"><BrandIcon name="claude" :size="22" /><span>Claude Code 第一次任务</span></a
        ><a href="/learn/claude/first-task?track=claude-desktop"
          ><BrandIcon name="claude" :size="22" /><span>Claude Desktop 第一次任务</span></a
        ></nav
      ></section
    >
    <section class="help-strip" aria-label="遇到问题时"
      ><div><h2>需要帮助</h2><p>按问题查找，或提供脱敏信息联系本站客服。</p></div
      ><div class="actions"
        ><a href="/guide/troubleshooting">排错指南</a><a href="/errors">错误码对照</a><a href="/contact">联系客服</a></div
      ></section
    >
    <a class="overview-index" href="/tools">查看教程索引</a>
  </div>

  <div v-else-if="kind === 'course'" class="course-index yichen-catalog">
    <header class="course-hero">
      <div class="tutorial-class-title"><BrandIcon name="codex" :size="40" /><h1>Codex 教程</h1></div>
      <p class="lead">先装好并连接 Codex，再看懂桌面界面，练习文件协作与技能。</p>
      <p class="course-prerequisite"
        >还没有连接成功？先完成 <a href="/guide/manager">安装配置</a> 和
        <a href="/guide/verify?track=codex">连接测试</a>。本文配图用于认路，入口与可用功能以当前版本和登录方式为准。</p
      >
      <ol class="yichen-howto"
        ><li v-for="(item, i) in catalog.howTo" :key="i">{{ item }}</li></ol
      >
    </header>
    <nav class="category-route-links" aria-label="Codex 学习路线"
      ><a href="/clients/codex"><strong>安装与接入</strong><span>桌面端、CLI、扩展分别说明</span></a
      ><a href="/guide/verify?track=codex"><strong>确认连接成功</strong><span>文本测试与本站调用记录</span></a
      ><a href="/learn/first-task"><strong>第一次任务</strong><span>从小材料做到可检查的结果</span></a
      ><a href="/skills"><strong>Codex Skill 工坊</strong><span>制作、安装和验证自己的技能</span></a></nav
    >
    <h2 class="category-section-title">图文教程</h2>
    <div class="course-pair">
      <a v-for="ch in courseChapters" :key="ch.id" :href="'/learn/codex/' + ch.id" class="course-card">
        <span class="course-card-media" aria-hidden="true"><img v-if="ch.cover" :src="ch.cover" alt="" loading="lazy" /></span>
        <span class="toc-num">第 {{ ch.n }} 章 · {{ ch.part }}</span>
        <strong>{{ ch.shortTitle || ch.title }}</strong
        ><p>{{ ch.blurb || ch.lead }}</p
        ><small>{{ ch.imageCount || 0 }} 张配图</small><em>开始阅读</em>
      </a>
    </div>
    <nav class="course-exercises" aria-label="配套练习"
      ><h2>想先做一个小任务？</h2><a href="/learn/first-task">第一次任务</a><a href="/learn/working-with-files">文件夹练习</a
      ><a href="/learn/review-and-revise">检查结果与修改</a></nav
    >
  </div>

  <div v-else-if="kind === 'claude'" class="claude-hub">
    <header class="course-hero"
      ><div class="tutorial-class-title"><BrandIcon name="claude" :size="40" /><h1>Claude 教程</h1></div
      ><p class="lead">先分清 Claude Code 和 Claude Desktop，再按实际使用的入口开始。</p></header
    >
    <div class="claude-entry-grid">
      <article
        ><h2>Claude Code</h2><p>在终端或支持的编辑器里处理项目和文件。使用星芒时，按教程配置服务地址与密钥。</p
        ><a href="/clients/claude-code" class="dark-button">安装并接入 Claude Code</a
        ><a href="/learn/claude/first-task" class="category-text-link">已经接好，开始第一次任务</a></article
      >
      <article
        ><h2>Claude Desktop</h2><p>安装 Windows 或 macOS 桌面应用，了解官方登录、桌面功能与备用安装包的使用范围。</p
        ><a href="/clients/claude-desktop" class="dark-button">查看桌面端安装教程</a
        ><a href="/guide/manager#download-installers" class="category-text-link">查找备用离线安装包</a></article
      >
    </div>
    <p class="course-prerequisite"
      >Claude Code 配好了中转，不表示 Claude Desktop 的聊天或云端功能自动获得相同接入。两个入口的认证、能力与使用条件请分别核对。</p
    >
    <nav class="category-route-links" aria-label="Claude 使用与排错"
      ><a href="/guide/account"><strong>准备本站账号</strong><span>密钥、额度与模型</span></a
      ><a href="/guide/verify?track=claude-code"><strong>检查调用结果</strong><span>核对当前请求的时间与模型</span></a
      ><a href="/learn/claude/first-task"><strong>完成一个小任务</strong><span>只读理解，再做有限修改</span></a
      ><a href="/guide/troubleshooting"><strong>遇到报错</strong><span>按安装、认证、模型逐步排查</span></a></nav
    >
  </div>

  <div v-else-if="kind === 'tools'" class="tools-hub learning-tools">
    <header class="page-hero"
      ><h1>按工具查找教程</h1
      ><p class="lead">当前重点完善 Codex、Claude 和星芒 AI 管理工具。进入对应分类，查看安装、接入、使用和排错。</p></header
    >
    <div class="tool-start-guide"
      ><BrandIcon name="manager" :size="36" /><div
        ><strong>第一次使用，先从管理工具开始</strong><p>安装支持的工具并填写配置；需要手动调整时，再看下面的单独教程。</p></div
      ><a href="/guide/manager" class="dark-button">打开管理工具教程</a></div
    >
    <div class="filter-bar tool-filters">
      <label for="tool-query"
        >搜索教程<input id="tool-query" v-model="query" placeholder="例如 Codex、Claude、管理工具" type="search"
      /></label>
      <div class="tool-categories" role="group" aria-label="教程分类"
        ><button
          v-for="[id, label] in [
            ['all', '全部'],
            ['manager', '星芒管理工具'],
            ['codex', 'Codex'],
            ['claude', 'Claude']
          ]"
          :key="id"
          :class="{ active: filter === id }"
          :aria-pressed="filter === id"
          @click="filter = id"
          >{{ label }}</button
        ></div
      >
    </div>
    <div class="tool-result-summary"
      ><p role="status"
        >找到 {{ shown.length }} 个工具<span v-if="query.trim()">，关键词「{{ query.trim() }}」</span></p
      ><button v-if="query || filter !== 'all'" @click="resetTools">清除筛选</button></div
    >
    <div class="tool-grid">
      <a v-for="t in shown" :key="t.id" :href="t.href" class="tool-card" :class="{ 'primary-tool': t.id === 'manager' }">
        <div class="tool-card-top"
          ><span class="tool-brand" aria-hidden="true"><BrandIcon :name="t.id" :size="32" /></span
          ><span class="tool-kind">{{ t.interface }}</span></div
        >
        <h2>{{ t.name }}</h2
        ><p>{{ t.summary }}</p
        ><strong>进入分类教程 <span aria-hidden="true">↗</span></strong>
      </a>
    </div>
    <div v-if="!shown.length" class="tools-empty"
      ><h2>没有找到匹配的工具</h2><p>试试产品名，或清除当前筛选。暂时不知道选哪个，可以先看工具选择指南。</p
      ><div class="actions"><button @click="resetTools">显示全部工具</button><a href="/guide/choose-tool">帮我选择工具</a></div></div
    >
    <p class="tool-compatibility"
      >填好地址和密钥后，请再做一次
      <a href="/guide/verify">连接验证</a>。客户端自带的会员权益、云端功能和工具能力，仍取决于它的版本、认证方式和本站实际支持情况。</p
    >
  </div>
</template>
