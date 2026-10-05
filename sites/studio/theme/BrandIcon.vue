<script setup>
import { computed } from 'vue';
import openaiIcon from './assets/brands/openai.svg';
import claudeIcon from './assets/brands/claude-color.svg';
import geminiIcon from './assets/brands/gemini-color.svg';
import grokIcon from './assets/brands/grok.svg';
import hermesIcon from './assets/brands/hermes.png';
import openclawIcon from './assets/brands/openclaw-color.svg';
import opencodeIcon from './assets/brands/opencode.svg';
import deepseekIcon from './assets/brands/deepseek-color.svg';
import cursorIcon from './assets/brands/cursor.svg';
import vscodeIcon from './assets/brands/vscode.svg';
import xingmangIcon from './assets/brands/xingmang.svg';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 24 },
  label: { type: String, default: '' }
});
const icons = {
  codex: openaiIcon,
  openai: openaiIcon,
  'claude-code': claudeIcon,
  claude: claudeIcon,
  'gemini-cli': geminiIcon,
  'grok-build': grokIcon,
  hermes: hermesIcon,
  openclaw: openclawIcon,
  opencode: opencodeIcon,
  'deepseek-harness': deepseekIcon,
  cursor: cursorIcon,
  vscode: vscodeIcon,
  manager: xingmangIcon
};
const src = computed(() => (Object.hasOwn(icons, props.name) ? icons[props.name] : undefined));
</script>

<template>
  <img
    v-if="src"
    class="brand-icon"
    :src="src"
    :width="size"
    :height="size"
    :style="{ width: size + 'px', height: size + 'px' }"
    :alt="label"
    :aria-hidden="label ? undefined : true"
    decoding="async"
    draggable="false"
  />
</template>

<style scoped>
.brand-icon {
  display: inline-block;
  flex: none;
  object-fit: contain;
  vertical-align: middle;
}
</style>
