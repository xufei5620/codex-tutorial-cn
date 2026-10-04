<script setup>
import {computed,ref,watch} from 'vue'
import BrandIcon from './BrandIcon.vue'
import {normalizeRoute} from './studio-search.mjs'
import {resolveLearningPath} from './learning-paths.mjs'

const props=defineProps({
  path:{type:String,default:''},
  query:{type:String,default:''},
  hash:{type:String,default:''}
})

const categories=[
  {
    id:'manager',label:'星芒 AI 管理工具',href:'/guide/manager',icon:'manager',
    groups:[{id:'manager',links:[
      ...resolveLearningPath('/guide/manager').steps.map(step=>({label:step.title,href:step.href})),
      {label:'备用安装包',href:'/guide/manager#offline-packages'}
    ]}]
  },
  {
    id:'codex',label:'Codex',href:'/learn/codex/',icon:'codex',
    groups:[{id:'codex',links:[
      {label:'安装与接入',href:'/clients/codex'},
      {label:'验证连接',href:'/guide/verify?track=codex'},
      {label:'第一次任务',href:'/learn/first-task'},
      {label:'认清界面',href:'/learn/codex/ch01'},
      {label:'办公交付',href:'/learn/codex/ch02'},
      {label:'文件协作',href:'/learn/working-with-files'},
      {label:'检查与修改',href:'/learn/review-and-revise'},
      {label:'Skill 工坊',href:'/skills'}
    ]}]
  },
  {
    id:'claude',label:'Claude',href:'/learn/claude/',icon:'claude',
    groups:[
      {id:'claude-code',label:'Claude Code',links:[
        {label:'安装与接入',href:'/clients/claude-code'},
        {label:'验证连接',href:'/guide/verify?track=claude-code'},
        {label:'第一次任务',href:'/learn/claude/first-task?track=claude-code'},
        {label:'检查与修改',href:'/learn/review-and-revise?track=claude-code'}
      ]},
      {id:'claude-desktop',label:'Claude Desktop',links:[
        {label:'安装与登录',href:'/clients/claude-desktop'},
        {label:'第一次任务',href:'/learn/claude/first-task?track=claude-desktop'}
      ]}
    ]
  }
]

const currentPath=computed(()=>normalizeRoute(props.path))
const currentHash=computed(()=>decodeHash(props.hash||props.path.split('#')[1]||''))
const currentLearningPath=computed(()=>resolveLearningPath(props.path,props.query,props.hash))
const activeCategory=computed(()=>{
  const path=currentPath.value,track=currentLearningPath.value?.id
  if(path==='/guide/manager')return 'manager'
  if(path==='/learn/review-and-revise')return track==='codex'?'codex':track==='claude-code'?'claude':''
  if(path==='/learn/claude'||path.startsWith('/learn/claude/')||['/clients/claude-code','/clients/claude-desktop'].includes(path)||(path==='/guide/verify'&&['claude-code','claude-desktop'].includes(track)))return 'claude'
  if(path==='/learn/codex'||path.startsWith('/learn/codex/')||['/clients/codex','/skills','/learn/first-task','/learn/firsttask','/learn/working-with-files','/learn/project-rules'].includes(path)||(path==='/guide/verify'&&track==='codex'))return 'codex'
  return ''
})
const expanded=ref({codex:false,claude:false,manager:false})

watch([()=>props.path,()=>props.query],()=>{
  if(activeCategory.value)expanded.value[activeCategory.value]=true
},{immediate:true})

function decodeHash(value){
  const hash=String(value).replace(/^#/,'')
  try{return decodeURIComponent(hash)}catch{return hash}
}

function isPageActive(href){
  const targetPath=normalizeRoute(href)
  const path=currentPath.value==='/learn/firsttask'?'/learn/first-task':currentPath.value
  if(path!==targetPath)return false
  if(['/guide/verify','/learn/claude/first-task','/learn/review-and-revise'].includes(targetPath))return currentLearningPath.value?.currentStep.href===href
  const hash=decodeHash(href.split('#')[1]||'')
  if(targetPath==='/guide/manager'){
    if(['offline-packages','离线包怎么选'].includes(currentHash.value))return hash==='offline-packages'
    return currentLearningPath.value?.currentStep.href===href
  }
  return !hash||currentHash.value===hash
}

function toggleCategory(id){
  expanded.value[id]=!expanded.value[id]
}
</script>

<template>
  <nav class="learning-sidebar" aria-label="按工具浏览教程">
    <p class="learning-sidebar-title">教程分类</p>
    <section v-for="category in categories" :key="category.id" class="learning-category" :class="{'is-current':activeCategory===category.id,'is-primary':category.id==='manager'}">
      <div class="learning-category-heading">
        <a class="learning-category-link" :href="category.href" :aria-current="activeCategory===category.id?'location':undefined">
          <BrandIcon :name="category.icon" :size="20" :class="{'learning-icon-monochrome':category.id==='codex'}" />
          <span>{{category.label}}</span>
        </a>
        <button class="learning-category-toggle" type="button" :aria-expanded="expanded[category.id]" :aria-controls="'learning-'+category.id+'-links'" :aria-label="(expanded[category.id]?'收起':'展开')+category.label+'教程'" @click="toggleCategory(category.id)">
          <svg class="learning-chevron" :class="{'is-expanded':expanded[category.id]}" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
            <path d="m7 4 6 6-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div v-show="expanded[category.id]" :id="'learning-'+category.id+'-links'" class="learning-category-children">
        <div v-for="group in category.groups" :key="group.id" class="learning-link-group">
          <p v-if="group.label" :id="'learning-'+group.id+'-title'" class="learning-subgroup-title">{{group.label}}</p>
          <ul class="learning-page-list" :aria-labelledby="group.label?'learning-'+group.id+'-title':undefined">
            <li v-for="link in group.links" :key="link.href">
              <a class="learning-page-link" :class="{'is-current':isPageActive(link.href)}" :href="link.href" :aria-current="isPageActive(link.href)?'page':undefined">{{link.label}}</a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </nav>
</template>

<style scoped>
.learning-sidebar{display:grid;gap:6px;min-width:0;width:100%;margin:0 0 18px;color:#c3cede}
.learning-sidebar-title{margin:0 10px 2px;color:#a9b7ca;font-size:11px;font-weight:600;letter-spacing:.08em}
.learning-category{min-width:0}
.learning-category-heading{display:grid;grid-template-columns:minmax(0,1fr) 44px;align-items:stretch;min-width:0;border:1px solid transparent;border-radius:8px;background:#16253a}
.learning-category.is-primary>.learning-category-heading{border-color:#9c8253;background:#292d32}
.learning-category.is-primary .learning-category-link{color:#f1d9a6;font-weight:750}
.learning-category.is-current>.learning-category-heading{border-color:#637082;background:#223248;box-shadow:inset 3px 0 #d4b16f}
.learning-category.is-primary.is-current>.learning-category-heading{border-color:#e0bf7b;background:#3b3429;box-shadow:inset 3px 0 #efd49c}
.learning-category-link{display:flex;align-items:center;gap:9px;min-width:0;min-height:44px;padding:8px 8px 8px 10px;border-radius:7px 0 0 7px;color:#e0e7f0;font-size:14px;font-weight:650;line-height:1.5;overflow-wrap:anywhere}
.learning-category-link>span{min-width:0}
.learning-icon-monochrome{filter:brightness(0) invert(1)}
.learning-category-link:hover,.learning-category-link[aria-current]{color:#f1d9a6}
.learning-category-link:hover{background:#2b3b51}
.learning-category-toggle{display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:0;border:0;border-left:1px solid #354459;border-radius:0 7px 7px 0;background:transparent;color:#c3cede}
.learning-category-toggle:hover{background:#2b3b51;color:#f1d9a6}
.learning-category-link:focus-visible,.learning-category-toggle:focus-visible,.learning-page-link:focus-visible{outline:3px solid #93bceb;outline-offset:-3px}
.learning-chevron{flex:none;transition:transform .16s ease}
.learning-chevron.is-expanded{transform:rotate(90deg)}
.learning-category-children{margin:5px 0 5px 19px;padding-left:9px;border-left:1px solid #405068;min-width:0}
.learning-link-group+.learning-link-group{margin-top:9px;padding-top:7px;border-top:1px solid #2d3c51}
.learning-subgroup-title{margin:5px 8px 2px;color:#a9b9cc;font-size:11px;font-weight:650;line-height:1.6;overflow-wrap:anywhere}
.learning-page-list{display:grid;gap:2px;list-style:none;margin:0;padding:0;min-width:0}
.learning-page-list>li{min-width:0;margin:0;padding:0}
.learning-page-link{display:flex;align-items:center;min-width:0;min-height:44px;padding:8px;border:1px solid transparent;border-radius:6px;color:#c3cede;font-size:13px;font-weight:500;line-height:1.55;overflow-wrap:anywhere}
.learning-page-link:hover{background:#203046;color:#f1d9a6}
.learning-page-link.is-current{border-color:#657184;background:#2b3b51;color:#f7dfae;box-shadow:inset 2px 0 #d4b16f}
@media(prefers-reduced-motion:reduce){.learning-chevron{transition:none}}
</style>
