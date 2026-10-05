<script setup>
import { computed, ref, shallowRef, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useData } from 'vitepress';
import ScreenshotSlot from './ScreenshotSlot.vue';
const props = defineProps({ chapterId: String });
const { theme } = useData();
const data = computed(() => theme.value.studio);
const chapters = computed(() => data.value.chapters || []);
const chapter = computed(() => chapters.value.find((c) => c.id === props.chapterId));
const index = computed(() => chapters.value.findIndex((c) => c.id === props.chapterId));
const prev = computed(() => (index.value > 0 ? chapters.value[index.value - 1] : null));
const next = computed(() => (index.value >= 0 && index.value < chapters.value.length - 1 ? chapters.value[index.value + 1] : null));
const titled = computed(() => (chapter.value?.sections || []).filter((s) => s.title && s.title !== '正文'));
const root = ref();
const targets = shallowRef([]);
let bindVersion = 0;
function sectionNo(i) {
  return String(i + 1).padStart(2, '0');
}
async function bindShots() {
  const version = ++bindVersion;
  targets.value = [];
  await nextTick();
  if (version !== bindVersion || !root.value) return;
  const hosts = [...(root.value?.querySelectorAll('.course-shot[data-shot-id]') || [])];
  targets.value = hosts.map((host) => {
    const figure = host.querySelector(':scope > .yichen-figure'),
      img = figure?.querySelector('img');
    const fallbackFigure = {
      alt: img?.alt,
      caption: figure?.querySelector('figcaption')?.textContent,
      width: Number(img?.getAttribute('width')) || undefined,
      height: Number(img?.getAttribute('height')) || undefined
    };
    // Keep the server-rendered image until hydration, then let the slot own visibility,
    // including hidden records that intentionally render no replacement image.
    if (figure) figure.hidden = true;
    return { id: host.dataset.shotId, host, fallbackFigure };
  });
}
watch(() => chapter.value?.id, bindShots, { flush: 'post' });
onMounted(bindShots);
onBeforeUnmount(() => {
  bindVersion++;
});
</script>
<template>
  <article v-if="chapter" ref="root" class="studio-lesson yichen-lesson">
    <a class="crumb" href="/learn/codex/">← Codex 零基础</a>
    <header class="lesson-hero">
      <p class="eyebrow">第 {{ chapter.n }} 章 · {{ chapter.part }}</p>
      <h1>{{ chapter.shortTitle || chapter.title }}</h1>
      <p class="lead">{{ chapter.blurb || chapter.lead }}</p>
      <p class="lesson-meta">
        <span>{{ chapter.imageCount || 0 }} 张配图</span>
        <span>{{ titled.length }} 个小节</span>
      </p>
    </header>
    <nav v-if="titled.length > 1" class="section-index" aria-label="本章目录">
      <a v-for="(s, i) in titled" :key="s.anchor" :href="'#' + s.anchor">
        <em>{{ sectionNo(i) }}</em>
        <span>{{ s.title }}</span>
      </a>
    </nav>
    <section v-for="s in chapter.sections" :id="s.anchor" :key="s.anchor" class="course-section">
      <h2 v-if="s.title && s.title !== '正文'">{{ s.title }}</h2>
      <div class="yichen-article" v-html="s.body"></div>
    </section>
    <nav class="chapter-pager">
      <a v-if="prev" :href="'/learn/codex/' + prev.id">← {{ prev.shortTitle || prev.title }}</a>
      <a href="/learn/codex/">课程目录</a>
      <a v-if="next" :href="'/learn/codex/' + next.id">{{ next.shortTitle || next.title }} →</a>
    </nav>
    <Teleport v-for="target in targets" :key="target.id" :to="target.host">
      <ScreenshotSlot :slot-id="target.id" :fallback-figure="target.fallbackFigure" />
    </Teleport>
  </article>
</template>
