<script setup>
defineProps({type:{type:String,default:'flow'}})
</script>
<template>
  <figure class="learning-diagram" :class="'diagram-'+type">
    <svg v-if="type==='flow'" viewBox="0 0 900 190" role="img" aria-label="Codex 本地任务流程：准备材料、发出请求、检查结果、保留或回退">
      <g class="diagram-node"><rect x="20" y="54" width="170" height="82" rx="16"/><text x="105" y="88">1 · 准备材料</text><text x="105" y="113">虚构 / 已脱敏</text></g><path class="diagram-arrow" d="M205 95h70m-12-8 12 8-12 8"/><g class="diagram-node"><rect x="295" y="54" width="170" height="82" rx="16"/><text x="380" y="88">2 · 发出请求</text><text x="380" y="113">目标 + 范围 + 限制</text></g><path class="diagram-arrow" d="M480 95h70m-12-8 12 8-12 8"/><g class="diagram-node"><rect x="570" y="54" width="150" height="82" rx="16"/><text x="645" y="88">3 · 检查结果</text><text x="645" y="113">事实 / Diff / 测试</text></g><path class="diagram-arrow" d="M735 95h55m-12-8 12 8-12 8"/><g class="diagram-node"><rect x="810" y="54" width="70" height="82" rx="16"/><text x="845" y="88">4</text><text x="845" y="113">保留 / 回退</text></g>
    </svg>
    <svg v-else-if="type==='interface'" viewBox="0 0 900 240" role="img" aria-label="Codex 界面三块区域：左侧导航、中间对话、右侧结果">
      <rect class="interface-outer" x="18" y="18" width="864" height="204" rx="18"/><rect class="interface-left" x="34" y="34" width="190" height="172" rx="12"/><rect class="interface-center" x="240" y="34" width="400" height="172" rx="12"/><rect class="interface-right" x="656" y="34" width="210" height="172" rx="12"/><text x="129" y="78">左侧：导航</text><text x="129" y="108">项目 · 对话 · 设置</text><text x="440" y="78">中间：对话</text><text x="440" y="108">输入任务 / 看过程</text><text x="761" y="78">右侧：结果</text><text x="761" y="108">Diff · 文件 · 预览</text>
    </svg>
    <svg v-else viewBox="0 0 900 180" role="img" aria-label="清楚请求的四个要素：目标、材料、限制、验收">
      <g class="prompt-chip"><rect x="20" y="45" width="185" height="88" rx="18"/><text x="112" y="82">目标</text><text x="112" y="108">要做成什么</text></g><path class="diagram-arrow" d="M220 89h40m-12-8 12 8-12 8"/><g class="prompt-chip"><rect x="275" y="45" width="185" height="88" rx="18"/><text x="367" y="82">材料</text><text x="367" y="108">依据是什么</text></g><path class="diagram-arrow" d="M475 89h40m-12-8 12 8-12 8"/><g class="prompt-chip"><rect x="530" y="45" width="145" height="88" rx="18"/><text x="602" y="82">限制</text><text x="602" y="108">不能做什么</text></g><path class="diagram-arrow" d="M690 89h40m-12-8 12 8-12 8"/><g class="prompt-chip"><rect x="745" y="45" width="135" height="88" rx="18"/><text x="812" y="82">验收</text><text x="812" y="108">怎样算好</text></g>
    </svg>
    <figcaption>{{type==='flow'?'先准备，再请求，再检查，最后决定是否保留。':type==='interface'?'先认区域，再找功能；不同版本按钮位置可能变化。':'一条可执行的请求，至少说清目标、材料、限制和验收。'}}</figcaption>
  </figure>
</template>
