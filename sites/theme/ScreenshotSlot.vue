<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useShots } from './shot-store.js';
import { slotVisibility } from './shot-presentation.mjs';
import ImagePreview from './ImagePreview.vue';
const props = defineProps({ slotId: { type: String, required: true }, fallbackFigure: { type: Object, default: null } });
const api = useShots(),
  input = ref(),
  preview = ref(),
  metadata = ref(false),
  draft = ref({}),
  replacement = ref(-1);
const imageElements = ref([]),
  failedSources = ref(new Set());
const spec = computed(
  () =>
    api.specs.get(props.slotId) || {
      id: props.slotId,
      title: '本步骤截图',
      target: '请拍摄实际操作或结果。',
      capturePolicy: 'optional',
      siteOnly: true
    }
);
const record = computed(() => api.state.records[props.slotId] || { images: [] });
const images = computed(() => record.value.images || []);
const fallback = computed(() => spec.value.fallback || '');
const displayImages = computed(() =>
  images.value.length
    ? images.value
    : fallback.value
      ? [{ data: fallback.value, name: '课程配图', width: props.fallbackFigure?.width, height: props.fallbackFigure?.height }]
      : []
);
const usingFallback = computed(() => !images.value.length && !!fallback.value);
const imageAlt = computed(() => record.value.alt || props.fallbackFigure?.alt || spec.value.title);
const caption = computed(() => record.value.caption || props.fallbackFigure?.caption || '');
const canEdit = computed(() => api.state.localAvailable && api.state.editing);
const policyLabel = computed(() =>
  spec.value.capturePolicy === 'required'
    ? '建议截图'
    : spec.value.capturePolicy === 'published'
      ? '课程配图'
      : spec.value.capturePolicy === 'none'
        ? '无需截图'
        : '可选截图'
);
const shouldShow = computed(() => {
  const count = displayImages.value.length;
  if (!api.state.localAvailable && !count && !record.value.hidden) return false;
  return slotVisibility({
    editing: canEdit.value,
    hidden: record.value.hidden,
    imageCount: count,
    capturePolicy: spec.value.capturePolicy,
    showOptional: api.state.showOptional,
    hideMissing: api.state.hideMissing,
    active: api.state.active === props.slotId
  });
});
const cleanRead = computed(() => shouldShow.value && !canEdit.value && !record.value.hidden && displayImages.value.length);
function choose(i = -1) {
  replacement.value = i;
  input.value.value = '';
  input.value.click();
}
async function picked(e) {
  try {
    await api.upload(props.slotId, e.target.files, replacement.value);
  } catch (e) {
    api.say(e.message);
  }
  e.target.value = '';
}
function drop(e) {
  if (canEdit.value) api.upload(props.slotId, e.dataTransfer.files).catch((e) => api.say(e.message));
}
function edit() {
  const { images, ...fields } = record.value;
  draft.value = { ...fields };
  metadata.value = true;
}
function save() {
  api.update(props.slotId, { ...record.value, ...draft.value });
  metadata.value = false;
}
function remove(i) {
  if (!confirm('移除此图？当前备份文件不会被修改。')) return;
  api.update(props.slotId, { ...record.value, images: images.value.filter((_, n) => n !== i) });
}
function view(im, event) {
  if (!failedSources.value.has(im.data)) preview.value?.open({ ...im, alt: imageAlt.value, caption: caption.value }, event.currentTarget);
}
function imageFailed(source) {
  failedSources.value.add(source);
}
function imageLoaded(source) {
  failedSources.value.delete(source);
}
function retryImage(source) {
  failedSources.value.delete(source);
}
function inspectImages() {
  const sources = new Set(displayImages.value.map((im) => im.data));
  for (const source of failedSources.value) if (!sources.has(source)) failedSources.value.delete(source);
  // SSR image requests can finish before Vue attaches the error listener.
  for (const image of imageElements.value)
    if (image.isConnected && image.complete && !image.naturalWidth) {
      const source = image.getAttribute('src');
      if (sources.has(source)) imageFailed(source);
    }
}
onMounted(inspectImages);
watch([displayImages, canEdit], inspectImages, { flush: 'post' });
</script>
<template>
  <div v-if="cleanRead" class="shot-reader" :id="'shot-' + slotId">
    <figure v-for="(im, i) in displayImages" :key="i" class="yichen-figure">
      <div v-if="failedSources.has(im.data)" class="shot-load-error"
        ><p role="status">这张截图暂时无法加载</p><p class="shot-load-alt">{{ imageAlt }}</p
        ><div
          ><button type="button" @click="retryImage(im.data)">重试加载</button
          ><a :href="im.data" target="_blank" rel="noopener noreferrer">打开原图链接 ↗</a></div
        ></div
      >
      <button
        v-else
        type="button"
        class="image-open"
        aria-haspopup="dialog"
        @click="view(im, $event)"
        :aria-label="
          '放大截图：' + imageAlt + (displayImages.length > 1 ? '（第 ' + (i + 1) + ' 张，共 ' + displayImages.length + ' 张）' : '')
        "
        ><img
          :key="im.data"
          ref="imageElements"
          :src="im.data"
          :width="im.width || undefined"
          :height="im.height || undefined"
          :alt="imageAlt"
          loading="lazy"
          decoding="async"
          @error="imageFailed(im.data)"
          @load="imageLoaded(im.data)"
      /></button>
      <figcaption v-if="caption">{{ caption }}</figcaption>
    </figure>
  </div>
  <div
    v-else-if="shouldShow"
    class="shot-frame"
    :class="{ 'is-selected': api.state.active === slotId, 'is-editor': canEdit }"
    :id="'shot-' + slotId"
    :tabindex="canEdit ? 0 : -1"
    @focusin="api.state.active = slotId"
    @click="api.state.active = slotId"
    @dragover.prevent
    @drop.prevent="drop"
  >
    <div class="shot-top"
      ><strong>{{ spec.title }}</strong
      ><small
        ><b>{{ policyLabel }}</b> ·
        {{ record.hidden ? '已隐藏' : images.length ? images.length + ' 张截图' : usingFallback ? '课程原图' : '尚未上传' }}</small
      ></div
    >
    <template v-if="!record.hidden || canEdit">
      <div v-if="!displayImages.length" class="shot-empty"
        ><span class="shot-camera">▧</span><b>完成这一步后再截一张</b><p>{{ record.target || spec.target }}</p
        ><small>只截实际操作或结果；文字、表格和参考答案不需要截图。</small
        ><button v-if="canEdit" class="gold-button" @click="choose()">＋ 上传真实截图</button
        ><small v-if="canEdit">可拖入或选中此处粘贴 · PNG / JPG / WebP</small></div
      >
      <figure v-for="(im, i) in displayImages" :key="i" class="shot-image">
        <div v-if="failedSources.has(im.data)" class="shot-load-error"
          ><p role="status">这张截图暂时无法加载</p><p class="shot-load-alt">{{ imageAlt }}</p
          ><div
            ><button type="button" @click="retryImage(im.data)">重试加载</button
            ><a :href="im.data" target="_blank" rel="noopener noreferrer">打开原图链接 ↗</a></div
          ></div
        >
        <button
          v-else
          type="button"
          class="image-open"
          aria-haspopup="dialog"
          @click="view(im, $event)"
          :aria-label="
            '放大截图：' + imageAlt + (displayImages.length > 1 ? '（第 ' + (i + 1) + ' 张，共 ' + displayImages.length + ' 张）' : '')
          "
          ><img
            :key="im.data"
            ref="imageElements"
            :src="im.data"
            :width="im.width || undefined"
            :height="im.height || undefined"
            :alt="imageAlt"
            loading="lazy"
            decoding="async"
            @error="imageFailed(im.data)"
            @load="imageLoaded(im.data)"
        /></button>
        <figcaption
          >{{ caption || spec.title
          }}<small>{{ [record.product, record.system, record.version, record.date].filter(Boolean).join(' · ') }}</small></figcaption
        ><div v-if="canEdit" class="shot-actions"
          ><small>{{ usingFallback ? '当前是课程原图，可换成你自己的截图' : im.name + ' · ' + im.width + '×' + im.height }}</small
          ><button @click="choose(usingFallback ? -1 : i)">{{ usingFallback ? '替换原图' : '替换' }}</button
          ><button v-if="!usingFallback" @click="remove(i)">移除</button></div
        >
      </figure> </template
    ><p v-if="record.hidden" class="muted">此位置已隐藏；编辑模式仍可查看并恢复图片和说明。</p>
    <div v-if="canEdit" class="shot-editor"
      ><p><b>拍摄重点：</b>{{ record.highlight || spec.highlight }}</p
      ><small>上传前请遮盖密钥、邮箱、验证码和客户信息。本工具不会自动脱敏，也不会发布网站。</small
      ><div class="shot-actions"
        ><button v-if="images.length && !record.hidden" @click="choose()">＋ 添加图片</button><button @click="edit">编辑说明 / 隐藏</button
        ><code>{{ slotId }}</code></div
      ></div
    >
    <input v-if="canEdit" ref="input" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden @change="picked" />
    <div v-if="metadata" class="shot-meta"
      ><label
        v-for="[key, label] in [
          ['target', '应截什么'],
          ['caption', '图注'],
          ['alt', '替代说明'],
          ['product', '产品'],
          ['system', '操作系统'],
          ['version', '版本'],
          ['date', '截图日期'],
          ['highlight', '拍摄重点']
        ]"
        :key="key"
        >{{ label }}<input v-model="draft[key]" maxlength="3000" :type="key === 'date' ? 'date' : 'text'" /></label
      ><label><input type="checkbox" v-model="draft.hidden" /> 在阅读版隐藏，保留素材</label
      ><label v-if="!spec.siteOnly"
        >范围<select v-model="draft.scope"
          ><option value="site">仅本站</option
          ><option value="shared">已确认可共用的软件界面</option></select
        ></label
      ><div class="shot-actions"
        ><button class="gold-button" @click="save">保存说明</button><button @click="metadata = false">取消</button></div
      ></div
    >
  </div>
  <ImagePreview v-if="shouldShow" ref="preview" />
</template>
<style scoped>
.shot-reader {
  scroll-margin-top: 150px;
}
.shot-reader .image-open {
  display: block;
  border-radius: 0;
}
.image-open:focus-visible {
  outline: 3px solid #397bc2;
  outline-offset: -4px;
}
.shot-load-error {
  padding: 24px 18px;
  background: #f7f9fc;
  text-align: center;
  overflow-wrap: anywhere;
}
.shot-load-error p {
  margin: 0 0 10px;
}
.shot-load-error [role='status'] {
  font-weight: 600;
  color: #465b73;
}
.shot-load-alt {
  font-size: 13px;
  color: #687d94;
}
.shot-load-error > div {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}
.shot-load-error a {
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
