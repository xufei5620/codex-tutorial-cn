<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { download } from './shot-store.js';
import ScreenshotSlot from './ScreenshotSlot.vue';
import {
  skillTemplates,
  MAX_SOURCE_LENGTH,
  templateSource,
  validateSkillSource,
  skillInstallPath,
  skillPrompt,
  createWorkshopDrafts,
  selectWorkshopTemplate,
  updateWorkshopSource,
  loadWorkshopDrafts,
  saveWorkshopDrafts
} from './skill-workshop.mjs';

const tabs = [
  { id: 'build', label: '1. 制作文件' },
  { id: 'install', label: '2. 安装与调用' },
  { id: 'test', label: '3. 检查结果' }
];
const tab = ref('build');
const state = ref(createWorkshopDrafts());
const storageStatus = ref('正在读取本机草稿…');
const ready = ref(false);
const message = ref('');
const downloaded = ref({ source: '', templateId: '' });
const platform = ref('windows');
const scope = ref('project');
const resetPending = ref(false);
const selected = computed(() => skillTemplates.find((item) => item.id === state.value.chosen));
const source = computed({
  get: () => state.value.drafts[state.value.chosen],
  set: (value) => {
    state.value = updateWorkshopSource(state.value, value);
    resetPending.value = false;
    persist();
  }
});
const validation = computed(() => validateSkillSource(source.value));
const installPath = computed(() => (validation.value.valid ? skillInstallPath(validation.value.name, platform.value, scope.value) : ''));
const currentDownload = computed(() => downloaded.value.source === source.value && downloaded.value.templateId === selected.value.id);
const invocation = computed(() => (validation.value.valid ? skillPrompt(validation.value.name, selected.value.cases[0].prompt) : ''));

function persist() {
  if (!ready.value) return;
  storageStatus.value = saveWorkshopDrafts(() => window.localStorage, state.value)
    ? '草稿已保存在此浏览器。'
    : '浏览器未能保存草稿（可能禁用存储或空间不足）。当前文字仍可编辑，请及时复制或下载。';
}
function chooseTemplate(id) {
  state.value = selectWorkshopTemplate(state.value, id);
  resetPending.value = false;
  message.value = '';
  persist();
}
function resetTemplate() {
  source.value = templateSource(selected.value);
  resetPending.value = false;
  message.value = '已恢复当前模板；其他模板的草稿仍保留。';
}
function openStep(id) {
  tab.value = id;
  nextTick(() => document.getElementById('skill-tab-' + id)?.focus());
}
function saveSkill() {
  if (!validation.value.valid) {
    message.value = '请先修正格式检查列出的问题。';
    return;
  }
  try {
    download('SKILL.md', source.value, 'text/markdown;charset=utf-8');
    downloaded.value = { source: source.value, templateId: selected.value.id };
    openStep('install');
    message.value = '已请求浏览器下载 SKILL.md。请在下载记录中确认文件，再按下方路径放置。';
  } catch {
    message.value = '浏览器未能开始下载。请复制内容，在本机手动保存为 SKILL.md。';
  }
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    message.value = '已复制。';
  } catch {
    message.value = '当前浏览器不能自动复制。请手动选中下面的文本复制，或返回制作文件下载。';
  }
}
function moveTab(event) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const current = tabs.findIndex((item) => item.id === tab.value);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tab.value = tabs[next].id;
  event.currentTarget.parentElement.querySelector('#skill-tab-' + tab.value)?.focus();
}
onMounted(() => {
  const loaded = loadWorkshopDrafts(() => window.localStorage);
  state.value = loaded.state;
  storageStatus.value = loaded.available
    ? '草稿保存在此浏览器；每个模板分别保留。'
    : '无法读取本机草稿。当前可以继续编辑；离开前请复制或下载。';
  ready.value = true;
  const value = new URLSearchParams(location.search).get('tab');
  if (tabs.some((item) => item.id === value)) tab.value = value;
});
</script>

<template>
  <article class="studio-lesson skill-workshop">
    <a href="/learn/codex/" class="crumb">← Codex 零基础</a>
    <p class="eyebrow">Skill 工坊 · Codex 本地技能</p>
    <h1>把做顺的任务，<br />留成可复用的方法</h1>
    <p class="lead"
      >从三份纯指令模板开始，写清什么时候使用、按什么步骤做、怎样检查结果。技能本身不会增加文件生成、屏幕访问或外部账号权限。</p
    >
    <p class="skill-boundary"
      >这里制作的是 <code>SKILL.md</code> 文件。页面不会替你安装技能、运行命令或调用模型；示例由本站编写，适用于支持本地技能的 Codex
      入口。</p
    >

    <fieldset class="skill-template-picker">
      <legend>选择模板</legend>
      <div class="skill-templates">
        <button
          v-for="item in skillTemplates"
          :key="item.id"
          type="button"
          :class="{ active: selected.id === item.id }"
          :aria-pressed="selected.id === item.id"
          @click="chooseTemplate(item.id)"
          >{{ item.label }}</button
        >
      </div>
      <p>{{ selected.summary }} <span class="skill-chip">纯指令 · 无附带脚本</span></p>
    </fieldset>
    <p class="skill-storage" role="status"
      >{{ storageStatus }} 草稿仅在本机当前浏览器保存，不上传服务器；清理浏览器数据会删除草稿，请勿写入密钥或私人资料。</p
    >

    <div class="filter-bar skill-tabs" role="tablist" aria-label="制作、安装和验证步骤">
      <button
        v-for="item in tabs"
        :id="'skill-tab-' + item.id"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="tab === item.id"
        :aria-controls="'skill-panel-' + item.id"
        :tabindex="tab === item.id ? 0 : -1"
        :class="{ active: tab === item.id }"
        @click="tab = item.id"
        @keydown="moveTab"
        >{{ item.label }}</button
      >
    </div>
    <p v-if="message" class="skill-message" role="status">{{ message }}</p>

    <section v-show="tab === 'build'" id="skill-panel-build" role="tabpanel" aria-labelledby="skill-tab-build" tabindex="0">
      <h2>改成自己的方法</h2>
      <p>更换模板会保留各自草稿。先改触发范围、操作步骤和验收要求，再检查并下载。</p>
      <div class="workshop-grid">
        <div class="skill-editor">
          <label for="skill-source">SKILL.md 正文</label>
          <textarea
            id="skill-source"
            v-model="source"
            class="skill-source"
            :maxlength="MAX_SOURCE_LENGTH"
            spellcheck="false"
            aria-describedby="skill-format-scope"
            :aria-invalid="!validation.valid"
          ></textarea>
          <div class="skill-actions">
            <button type="button" class="gold-button" :disabled="!validation.valid" @click="saveSkill">下载 SKILL.md ↓</button>
            <button type="button" @click="copyText(source)">复制当前内容</button>
            <button type="button" @click="resetPending = !resetPending">恢复模板</button>
          </div>
          <div v-if="resetPending" class="skill-reset" role="group" aria-label="确认恢复当前模板">
            <p>恢复将覆盖“{{ selected.label }}”的当前草稿。</p>
            <button type="button" @click="resetTemplate">确认恢复</button>
            <button type="button" @click="resetPending = false">保留草稿</button>
          </div>
        </div>
        <aside class="workshop-checks" aria-label="当前文件检查结果">
          <h3>{{ validation.valid ? '文件检查通过' : '先修正这些问题' }}</h3>
          <p v-if="validation.valid" class="skill-valid">✓ 前置信息、名称、描述和正文符合工坊格式。</p>
          <ul v-else class="skill-errors"
            ><li v-for="error in validation.errors" :key="error">{{ error }}</li></ul
          >
          <p id="skill-format-scope"
            >工坊仅支持 <code>name</code> 与
            <code>description</code> 两个单行文本字段。为便于跨平台放置文件，名称限定小写字母、数字和连字符，最长 64 位；描述最长 1024
            字符。高级 YAML 或额外字段需在专门编辑器中检查。</p
          >
          <p>检查通过只代表符合这里的格式范围；内容是否可信、方法是否有效，仍要阅读文件并实际试用。</p>
        </aside>
      </div>
      <ScreenshotSlot slot-id="skills-editor" />
    </section>

    <section v-show="tab === 'install'" id="skill-panel-install" role="tabpanel" aria-labelledby="skill-tab-install" tabindex="0">
      <h2>把文件放对，再确认被发现</h2>
      <p>下载文件只完成第一步。接下来在你实际运行 Codex 的环境中放置文件；本机、WSL 和远程工作区要分别核对。</p>
      <p v-if="!validation.valid" class="skill-message">当前草稿未通过检查。请回到“制作文件”修正，路径和调用示例会根据有效的 name 显示。</p>
      <template v-else>
        <p class="skill-download-state">{{
          currentDownload
            ? '已为当前这份内容发起下载，请核对浏览器下载记录。'
            : '当前内容尚未在本轮下载，或下载后又有修改。安装前请下载最新文件。'
        }}</p>
        <div class="skill-install-options">
          <label
            >运行环境<select v-model="platform"
              ><option value="windows">Windows 本机</option
              ><option value="macos">macOS / Linux</option></select
            ></label
          >
          <label
            >使用范围<select v-model="scope"
              ><option value="project">当前项目</option
              ><option value="personal">当前用户的多个项目</option></select
            ></label
          >
        </div>
        <div class="skill-copy-block">
          <p
            ><strong>{{ validation.name }}</strong> 的目标文件路径</p
          >
          <pre>{{ installPath }}</pre>
          <button type="button" @click="copyText(installPath)">复制路径</button>
        </div>
        <ol class="numbered-guide">
          <li>先阅读下载文件。若你加入了脚本、外链或依赖，请另行核对来源、用途与权限。</li>
          <li v-if="scope === 'project'"
            >把“你的项目目录”换成在 Codex 中打开的项目文件夹，逐层新建 <code>.agents/skills/{{ validation.name }}</code
            >。已有同名目录时先备份，不要直接覆盖。</li
          >
          <li v-else
            >个人路径从用户主目录开始。Windows 默认用 <code>%USERPROFILE%</code>，macOS / Linux 用 <code>~</code>；自定义了 HOME 时以 Codex
            实际主目录为准。缺少的文件夹需先创建，已有同名技能先备份。</li
          >
          <li v-if="platform === 'windows'"
            >在资源管理器中打开项目文件夹；安装个人技能时，可按 Win + R 输入 <code>%USERPROFILE%</code> 打开用户主目录。开启“查看 → 显示 →
            文件扩展名”，再检查文件名。</li
          >
          <li v-else
            >macOS 可在 Finder 按 Shift + Command + G 输入项目路径或 <code>~</code>，再按 Shift + Command + . 显示隐藏的
            <code>.agents</code> 文件夹；Linux 用文件管理器打开对应目录。</li
          >
          <li
            >将下载文件放入目标目录，最终名称应是 <code>SKILL.md</code>。注意浏览器可能下载成 <code>SKILL (1).md</code>，Windows 也可能隐藏
            <code>.txt</code> 后缀。</li
          >
          <li
            >打开对应项目并确认技能被发现。CLI / IDE 扩展可用 <code>/skills</code> 或输入
            <code>$</code> 查找；桌面入口按当前版本的技能界面检查，未出现时重启后再查。</li
          >
          <li>在新对话里复制下面的调用请求。检查实际回复是否使用了该方法，再进入“检查结果”做三个小测试。</li>
        </ol>
        <div class="skill-copy-block"
          ><h3>第一次调用</h3><pre>{{ invocation }}</pre
          ><button type="button" @click="copyText(invocation)">复制调用请求</button></div
        >
        <div class="skill-actions"
          ><button type="button" @click="saveSkill">下载当前文件</button
          ><button type="button" class="gold-button" @click="openStep('test')">继续检查结果 →</button></div
        >
      </template>
      <ScreenshotSlot slot-id="skills-install" />
    </section>

    <section v-show="tab === 'test'" id="skill-panel-test" role="tabpanel" aria-labelledby="skill-tab-test" tabindex="0">
      <h2>用“{{ selected.label }}”跑三个小例子</h2>
      <p>下面的请求和验收标准跟随所选模板。修改了方法后，也要调整测试材料；分别新开对话更容易发现是否依赖上一轮内容。</p>
      <p v-if="!validation.valid" class="skill-message">先修正文件格式，才可以生成带当前技能名称的调用请求。</p>
      <div class="skill-test-grid">
        <article v-for="example in selected.cases" :key="example.label" class="path-card">
          <h3>{{ example.label }}</h3>
          <pre>{{ validation.valid ? skillPrompt(validation.name, example.prompt) : example.prompt }}</pre>
          <button v-if="validation.valid" type="button" @click="copyText(skillPrompt(validation.name, example.prompt))"
            >复制{{ example.label }}请求</button
          >
          <p><strong>检查什么</strong>{{ example.expected }}</p>
        </article>
      </div>
      <div class="skill-review"
        ><h3>记下真实结果</h3
        ><p
          >记录 Codex
          入口与版本、输入材料、实际输出、通过或失败的原因。文件已下载、技能出现在列表、输出符合方法，是三件需要分别检查的事。页面不会替你执行这些测试，也不会自动标记通过。</p
        ><p>没被发现时检查目录、文件名和前置信息；发现了却没按方法执行时，收窄描述中的触发范围，补充步骤，再用新材料重试。</p></div
      >
      <ScreenshotSlot slot-id="skills-test" />
    </section>
    <p class="skill-source-note"
      >目录与调用方式依据
      <a href="https://learn.chatgpt.com/docs/build-skills" target="_blank" rel="noopener noreferrer">OpenAI 官方 Build skills 文档</a
      >（2026-10-04 核对）。Windows 路径按默认用户主目录展开；具体入口以当前版本为准。</p
    >
  </article>
</template>

<style src="./skill-workshop.css"></style>
