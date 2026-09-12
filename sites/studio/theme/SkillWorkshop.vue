<script setup>
import {ref,computed,onMounted} from 'vue'
import {download} from './shot-store.js'
import ScreenshotSlot from './ScreenshotSlot.vue'
const tab=ref('build')
const templates={
 writing:{label:'教程口吻',text:'---\nname: tutorial-writing\ndescription: 写中文图文教程时按口语、短段、先结论后步骤。\n---\n\n# 教程写作\n\n用中文。先说读者现在卡在哪，再给能照着做的步骤。\n一段只讲一件事。专有名词第一次出现时用一句话解释。\n不要写购买、套餐、中转、代充或线下引流。\n写完后自检：读者能不能只靠这一页做出结果。\n'},
 office:{label:'办公交付',text:'---\nname: office-files\ndescription: 做 Word、PPT 或网页时，先确认一份能打开的文件再继续改。\n---\n\n# 办公文件\n\n先问清楚交付物是 Word、PPT 还是网页。\n先做一份能打开的草稿，再按反馈改，不要一次做完整套设计。\n文件名用中文说明用途。做完后告诉我文件在哪、怎么打开。\n不要编造没生成的文件。\n'},
 interface:{label:'认界面',text:'---\nname: explain-codex-ui\ndescription: 解释 Codex App 左边、中间、右边和设置时，只讲当前屏幕上能看到的东西。\n---\n\n# 认界面\n\n先对应当前屏幕：左边入口、中间对话、右边结果、设置页。\n一次只讲一个区域。用大白话，不展开没出现的高级功能。\n不确定的按钮就说不确定，让我对着界面确认。\n'}
}
const source=ref(templates.writing.text)
const chosen=ref('writing')
const checks=computed(()=>[['有 YAML 前置信息',/^---\r?\n[\s\S]*?\r?\n---/.test(source.value)],['名称明确',/^name:\s*\S+/m.test(source.value)],['描述不为空',/^description:\s*\S+/m.test(source.value)],['有操作正文',source.value.replace(/^---[\s\S]*?---/,'').trim().length>30]])
function useTemplate(id){chosen.value=id;source.value=templates[id].text}
onMounted(()=>{const value=new URLSearchParams(location.search).get('tab');if(['build','install','test'].includes(value))tab.value=value})
</script>
<template>
<article class="studio-lesson">
  <a href="/learn/codex/" class="crumb">← Codex 零基础</a>
  <p class="eyebrow">Skill 工坊</p>
  <h1>把做顺的任务，<br>留成可复用的方法</h1>
  <p class="lead">Skill 就是一份说明书：下次同类任务直接调用，不必从头讲一遍。这里只帮你写文件、检查格式；不运行代码、不安装技能、不调用模型。</p>
  <div class="filter-bar">
    <button v-for="[id,label] in [['build','制作技能'],['install','安装与调用'],['test','测试与改进']]" :key="id" :class="{active:tab===id}" @click="tab=id">{{label}}</button>
  </div>

  <section v-show="tab==='build'">
    <h2>先选一个底稿，再改成自己的</h2>
    <p>底稿对应 Codex 零基础里最常见的三类事。改名称、改口吻、改禁止项，保存成 <code>SKILL.md</code> 即可。</p>
    <div class="skill-templates">
      <button v-for="(item,id) in templates" :key="id" type="button" :class="{active:chosen===id}" @click="useTemplate(id)">{{item.label}}</button>
    </div>
    <div class="workshop-grid">
      <div>
        <label for="skill-source">SKILL.md</label>
        <textarea id="skill-source" class="skill-source" v-model="source" spellcheck="false"></textarea>
        <button class="gold-button" @click="download('SKILL.md',source,'text/markdown;charset=utf-8')">保存 SKILL.md ↓</button>
      </div>
      <aside class="workshop-checks">
        <h3>基础格式检查</h3>
        <p v-for="[label,ok] in checks" :key="label">{{ok?'✓':'○'}} {{label}}</p>
        <p>这里只检查字段和基本结构，不是完整 YAML 校验，也不证明技能能实际完成任务。</p>
        <pre>.agents/skills/
└── 技能目录/
    └── SKILL.md</pre>
      </aside>
    </div>
    <ScreenshotSlot slot-id="skills-editor" />
  </section>

  <section v-show="tab==='install'">
    <h2>保存文件，不等于已经安装</h2>
    <ol class="numbered-guide">
      <li>检查技能来源、内容和依赖。这三份底稿不需要脚本或外部账号。</li>
      <li>在 Codex 里确认技能目录。常见写法是当前项目下的 <code>.agents/skills/技能名/SKILL.md</code>；以你当前版本的设置页为准。</li>
      <li>文件名必须是 <code>SKILL.md</code>，不要存成 <code>SKILL.md.txt</code>，也不要多套一层空文件夹。</li>
      <li>保存后新开一轮对话，或按当前产品要求刷新技能列表，确认它被发现。</li>
      <li>用技能名称显式调用，例如「按 tutorial-writing 写这一节」。出现在列表里，不等于已经按它执行。</li>
    </ol>
    <p class="edu-note">浏览器里点「保存 SKILL.md」只会下载到你的电脑，不会写入 Codex 的技能目录。放到目录里之后，再回 <a href="/learn/codex/ch01">认清界面</a> 里看插件、技能这些词怎么对应。</p>
    <ScreenshotSlot slot-id="skills-install" />
  </section>

  <section v-show="tab==='test'">
    <h2>不要只测试一次</h2>
    <p>用刚才那份技能跑三个小例子。过了再留着，跑偏了就改说明书，不要先加更多技能。</p>
    <div class="path-grid">
      <article class="path-card">
        <h3>正常</h3>
        <p>「按这个技能写一小节：第一次打开 Codex，先看左边。」</p>
        <strong>应先结论，再给短步骤；不要写成购买或配置长文。</strong>
      </article>
      <article class="path-card">
        <h3>缺失</h3>
        <p>「帮我做一份 PPT。」但没说主题、页数和给谁看。</p>
        <strong>先问清楚，不要编题目，也不要假装已经生成文件。</strong>
      </article>
      <article class="path-card">
        <h3>跑偏</h3>
        <p>用户只要一份能打开的 Word，技能却去改代码或装插件。</p>
        <strong>停下来对齐交付物；办公技能不该变成工程任务。</strong>
      </article>
    </div>
    <ScreenshotSlot slot-id="skills-test" />
    <p>这些是验收标准，不是一次实际模型调用。把实际结果和 Codex 版本记在自己的笔记里。</p>
  </section>
</article>
</template>
