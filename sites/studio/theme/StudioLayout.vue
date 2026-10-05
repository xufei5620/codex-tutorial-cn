<script setup>
import {computed,ref,onMounted,onBeforeUnmount,nextTick,watch} from 'vue'
import {Content,useData,useRoute,useRouter} from 'vitepress'
import {installShots} from './shot-store.js'
import {buildSearchEntries,navigationActive,normalizeRoute,normalizeSearch,searchEntries,searchMatches} from './studio-search.mjs'
import {tutorialTools} from './tools-registry.mjs'
import {skillTemplates} from './skill-workshop.mjs'
import StudioHub from './StudioHub.vue'
import SupportPanel from './SupportPanel.vue'
import ScreenshotSlot from './ScreenshotSlot.vue'
import ImagePreview from './ImagePreview.vue'
import xingmangLogo from './assets/brands/xingmang-horizontal-dark.svg'
import EditorBar from './EditorBar.vue'
import LearningPath from './LearningPath.vue'
import LearningSidebar from './LearningSidebar.vue'
import {resolveLearningPath,completionKey,normalizeCompleted} from './learning-paths.mjs'
import {parseLearningVisits,appendLearningVisit} from './learning-history.mjs'
import './interaction.css'

const {theme}=useData(),route=useRoute(),router=useRouter()
const data=computed(()=>theme.value.studio),api=installShots(data.value)
const menu=ref(false),focus=ref(false),mobile=ref(false),rail=ref(),menuButton=ref()
const search=ref(''),searchDialog=ref(),searchInput=ref(),main=ref(),targets=ref([]),documentPreview=ref()
const errorQuery=ref(''),helpCount=ref(0),routeQuery=ref('')
const routeHash=ref(''),articleSections=ref([]),activeSection=ref(''),completedSteps=ref([]),previousLearningHref=ref(null),completionStorageMessage=ref('')
const current=computed(()=>normalizeRoute(route.path))
const routeKey=computed(()=>route.path+routeQuery.value)
const progressHash=computed(()=>current.value==='/guide/manager'&&activeSection.value?'#'+activeSection.value:routeHash.value)
const learningPath=computed(()=>resolveLearningPath(current.value,routeQuery.value,progressHash.value))
const isHome=computed(()=>current.value==='/'||current.value==='/guide/start')
const isHelp=computed(()=>['/errors','/faq'].includes(current.value))
const chapterId=computed(()=>current.value.match(/\/learn\/codex\/(ch\d+)/)?.[1])
const drawerOpen=computed(()=>mobile.value&&menu.value&&!focus.value)
const railHidden=computed(()=>focus.value||(mobile.value&&!menu.value))
const normalizedSearch=computed(()=>normalizeSearch(search.value))
const normalizedHelp=computed(()=>normalizeSearch(errorQuery.value))
const searchIndex=computed(()=>buildSearchEntries(data.value,tutorialTools,skillTemplates))
const results=computed(()=>searchEntries(searchIndex.value,search.value))
const supportNav=computed(()=>[['▤','教程索引','/tools'],['◷',data.value.site.id==='sub2api'?'订阅与额度':'充值与用量','/guide/account'],['?','常见问题','/faq'],['!','错误码对照','/errors'],['◎','联系客服','/contact']])
const pageKind=computed(()=>{if(isHome.value)return 'home';if(current.value.startsWith('/learn/codex'))return 'course';if(current.value==='/tools')return 'tools';if(current.value==='/skills')return 'skills';if(isHelp.value)return 'help';if(['/guide/manager','/guide/account','/contact'].includes(current.value))return 'doc';return 'page'})
const pageLinks=computed(()=>({
 '/guide/manager':[['下载安装包',data.value.site.download_page_url],['选择适合你的工具','/guide/choose-tool'],['验证第一次调用','/guide/verify'],['Codex 零基础','/learn/codex/']],
 '/guide/account':[['模型与定价','/guide/models'],['验证第一次调用','/guide/verify'],['Codex 零基础','/learn/codex/']],
 '/faq':[['错误码对照','/errors'],['联系客服','/contact']],
 '/errors':[['常见问题','/faq'],['联系客服','/contact']],
 '/contact':[['常见问题','/faq'],['错误码对照','/errors'],['Codex 零基础','/learn/codex/']]
}[current.value]||[]))

let pageRevision=0,disposed=false,mediaQuery,oldOverflow='',locked=false,searchOpener=null,previousAfterRouteChange
let helpGroups=[]
let sectionObserver=null,learningVisits=[]

function learningStorageKey(kind){return 'xingmang-learning-'+kind+'-v1:'+data.value.site.id}
function loadLearningState(){
 try{completedSteps.value=normalizeCompleted(JSON.parse(localStorage.getItem(learningStorageKey('completed'))||'[]'))}catch{completionStorageMessage.value='浏览器存储不可用，完成状态仅在本次页面中保留。'}
 try{learningVisits=parseLearningVisits(sessionStorage.getItem(learningStorageKey('visits')))}catch{learningVisits=[]}
}
function recordLearningVisit(){
 const next=appendLearningVisit(learningVisits,location.pathname+location.search+location.hash)
 learningVisits=next.visits
 previousLearningHref.value=next.previousHref
 try{sessionStorage.setItem(learningStorageKey('visits'),JSON.stringify(learningVisits))}catch{/* Navigation remains available without storage. */}
}
function completeLearningStep(checked){
 if(!learningPath.value)return
 const key=completionKey(learningPath.value.id,learningPath.value.currentStep.id)
 completedSteps.value=normalizeCompleted(checked?[...completedSteps.value,key]:completedSteps.value.filter(item=>item!==key))
 try{localStorage.setItem(learningStorageKey('completed'),JSON.stringify(completedSteps.value));completionStorageMessage.value='完成记录已保存到当前浏览器。'}catch{completionStorageMessage.value='浏览器无法保存，完成状态仅在本次页面中保留。'}
}
function prepareLearningPage(){
 sectionObserver?.disconnect();articleSections.value=[];activeSection.value=''
 recordLearningVisit()
 const path=learningPath.value
 if(path){
  for(const link of main.value?.querySelectorAll('.vp-doc a[href]')||[]){
   const href=link.getAttribute('href')
   if(!href?.startsWith('/')||href.startsWith('//'))continue
   const url=new URL(href,location.origin)
   if(url.searchParams.has('track'))continue
   if(url.pathname==='/guide/verify'&&['codex','claude-code','claude-desktop'].includes(path.id))url.searchParams.set('track',path.id)
   else if(url.pathname==='/learn/claude/first-task'&&path.id.startsWith('claude-'))url.searchParams.set('track',path.id)
   else if(url.pathname==='/learn/review-and-revise'&&path.id==='claude-code')url.searchParams.set('track',path.id)
   else continue
   link.setAttribute('href',url.pathname+url.search+url.hash)
  }
 }
 const headings=[],seen=new Set()
 for(const heading of main.value?.querySelectorAll('.vp-doc h2')||[]){
  const target=heading.id?heading:heading.closest('.course-section[id]')
  if(!target||seen.has(target.id))continue
  seen.add(target.id)
  const copy=heading.cloneNode(true);copy.querySelectorAll('.header-anchor').forEach(node=>node.remove())
  headings.push({node:heading,id:target.id,title:copy.textContent.trim()})
 }
 articleSections.value=headings.map(({id,title})=>({id,title}))
 activeSection.value=headings[0]?.id||''
 if(typeof IntersectionObserver==='undefined')return
 const revision=pageRevision
 sectionObserver=new IntersectionObserver(()=>{
  if(disposed||revision!==pageRevision)return
  const past=headings.filter(heading=>heading.node.getBoundingClientRect().top<=150)
  activeSection.value=(past.at(-1)||headings[0])?.id||''
 },{rootMargin:'-100px 0px -65% 0px',threshold:0})
 headings.forEach(heading=>sectionObserver.observe(heading.node))
}

function closeMenu(restore=true){
 const wasOpen=menu.value
 menu.value=false
 if(wasOpen&&restore)nextTick(()=>menuButton.value?.focus())
}
function toggleMenu(){menu.value?closeMenu():menu.value=true}
function toggleFocus(){closeMenu(false);focus.value=!focus.value}
function updateViewport(){mobile.value=mediaQuery.matches;if(!mobile.value)closeMenu(false)}
function setScrollLock(value){
 if(value&&!locked){oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';locked=true}
 else if(!value&&locked){document.documentElement.style.overflow=oldOverflow;locked=false}
}
function railFocusable(){return [...(rail.value?.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]')||[])].filter(el=>el.getClientRects().length)}
function keyboard(event){
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
  if(document.querySelector('dialog[open]')&&!searchDialog.value?.open)return
  event.preventDefault();openSearch();return
 }
 if(!drawerOpen.value)return
 if(event.key==='Escape'){event.preventDefault();closeMenu();return}
 if(event.key==='Tab'){
  const items=railFocusable(),first=items[0],last=items.at(-1)
  if(!items.length){event.preventDefault();rail.value?.focus();return}
  if(event.shiftKey&&(document.activeElement===first||!rail.value.contains(document.activeElement))){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||!rail.value.contains(document.activeElement))){event.preventDefault();first.focus()}
 }
}
async function openSearch(){
 if(!searchDialog.value)return
 if(!searchDialog.value.open)searchOpener=drawerOpen.value?menuButton.value:document.activeElement
 closeMenu(false)
 await nextTick()
 if(disposed||!searchDialog.value)return
 if(!searchDialog.value.open)searchDialog.value.showModal()
 searchInput.value?.focus()
}
function closeSearch(restore=true){
 searchDialog.value?.close()
 if(restore)nextTick(()=>searchOpener?.isConnected&&searchOpener.focus())
}
function searchKey(event){
 if(event.isComposing)return
 if(!results.value.length)return
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){
  event.preventDefault()
  const links=[...searchDialog.value.querySelectorAll('.search-results>a')]
  const index=links.indexOf(document.activeElement)
  const next=event.key==='ArrowDown'?(index+1)%links.length:(index<=0?links.length-1:index-1)
  links[next]?.focus()
 }else if(event.key==='Enter'&&event.target===searchInput.value&&!event.isComposing){
  event.preventDefault();searchDialog.value.querySelector('.search-results>a')?.click()
 }
}
function navigationClick(event){
 if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return
 const link=event.target.closest?.('a[href]')
 if(!link||link.hasAttribute('download')||link.target)return
 const url=new URL(link.href,location.href)
 if(url.origin!==location.origin)return
 closeMenu(false)
 if(searchDialog.value?.contains(link))closeSearch(false)
 // VitePress owns scrolling. Its capture handler may already have advanced a
 // reactive pager link, so the bubbling href must never select another target.
}
function focusDestination(hash=location.hash,scroll=false){
 let id
 try{id=decodeURIComponent(hash.replace(/^#/,''))}catch{return}
 const target=id?document.getElementById(id):main.value
 if(!target)return
 if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1')
 target.focus({preventScroll:true})
 if(id&&scroll)target.scrollIntoView({block:id.startsWith('shot-')?'center':'start',behavior:'auto'})
}
function enhanceDocumentImages(){
 for(const img of main.value?.querySelectorAll('.vp-doc img')||[]){
  if(img.closest('a,button,.course-shot,.shot-frame,[id^="shot-"],.yichen-lesson,.studio-support,.tool-brand,.brand-icon'))continue
  if(!img.alt.trim()||img.getAttribute('role')==='presentation')continue
  const bounds=img.getBoundingClientRect()
  if((bounds.width>0&&bounds.width<=64)||(bounds.height>0&&bounds.height<=64))continue
  const button=document.createElement('button')
  button.type='button';button.className='document-image-open';button.setAttribute('aria-label','放大图片：'+img.alt)
  img.replaceWith(button);button.append(img)
 }
}
function contentClick(event){
 const button=event.target.closest?.('button.document-image-open')
 if(button){
  const img=button.querySelector('img')
  documentPreview.value?.open({data:img.currentSrc||img.src,alt:img.alt,caption:button.closest('figure')?.querySelector('figcaption')?.textContent,width:img.naturalWidth,height:img.naturalHeight},button)
  return
 }
 copy(event)
}
async function copy(event){
 const button=event.target.closest?.('[data-copy],button.copy')
 if(!button)return
 const code=button.classList.contains('copy')?button.parentElement.querySelector('pre code'):null
 const text=button.dataset.copy??code?.textContent
 if(text===undefined)return
 try{await navigator.clipboard.writeText(text);api.say('已复制。')}
 catch{
  if(code){const range=document.createRange();range.selectNodeContents(code);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range)}
  api.say('浏览器未允许自动复制，请选中文本后手动复制。')
 }
}
function syncShotQuery(){
 if(!api.state.localAvailable)return
 const params=new URLSearchParams(location.search)
 if(params.get('edit')==='1')api.state.editing=true
 if(params.get('showOptional')==='1')api.state.showOptional=true
}
function collectHelp(){
 helpGroups=[]
 if(!isHelp.value)return
 if(current.value==='/errors')helpGroups=[...(main.value?.querySelectorAll('.vp-doc tbody tr')||[])].map(node=>({nodes:[node],text:node.textContent}))
 else for(const heading of main.value?.querySelectorAll('.vp-doc h2')||[]){
  const nodes=[heading]
  let node=heading.nextElementSibling
  while(node&&node.tagName!=='H2'){nodes.push(node);node=node.nextElementSibling}
  helpGroups.push({nodes,text:nodes.map(item=>item.textContent).join(' ')})
 }
 filterHelp()
}
function filterHelp(){
 let visible=0
 for(const group of helpGroups){const matches=searchMatches(group.text,errorQuery.value);group.nodes.forEach(node=>node.hidden=!matches);if(matches)visible++}
 helpCount.value=visible
}
async function pageReady(moveFocus=false){
 const revision=++pageRevision,path=current.value
 routeHash.value=location.hash
 closeMenu(false);documentPreview.value?.close();errorQuery.value='';helpGroups=[];targets.value=[];syncShotQuery()
 await nextTick()
 if(disposed||revision!==pageRevision||path!==current.value)return
 for(const button of main.value?.querySelectorAll('button.copy')||[]){button.type='button';button.setAttribute('aria-label','复制代码');button.title='复制代码'}
 enhanceDocumentImages()
 if(isHelp.value)for(const table of main.value?.querySelectorAll('.vp-doc table')||[]){table.tabIndex=0;table.setAttribute('aria-label','错误排查表，可左右滚动查看全部列')}
 collectHelp()
 prepareLearningPage()
 if(!chapterId.value&&!isHome.value&&!['/tools','/skills','/screenshots'].includes(path)){
  const specs=data.value.manifest.filter(spec=>spec.route===path)
  const items=[...(main.value?.querySelectorAll('.vp-doc ol > li')||[])].filter(li=>!li.parentElement.closest('li'))
  targets.value=items.flatMap((li,index)=>{
   if(!specs[index])return []
   let host=li.querySelector(':scope > .legacy-shot')
   if(!host){host=document.createElement('div');host.className='legacy-shot';host.dataset.shotId=specs[index].id;li.append(host)}
   return [{id:specs[index].id,host}]
  })
 }
 await nextTick()
 if(disposed||revision!==pageRevision)return
 if(moveFocus||location.hash)requestAnimationFrame(()=>{if(!disposed&&revision===pageRevision)focusDestination(location.hash,location.hash.startsWith('#shot-'))})
}
async function afterRouteChange(href){
 await previousAfterRouteChange?.(href)
 if(disposed)return
 const url=new URL(href,location.origin)
 if(normalizeRoute(url.pathname)!==current.value)return
 routeQuery.value=url.search
 routeHash.value=url.hash
 syncShotQuery()
}
function hashChanged(){
 const hash=location.hash
 routeHash.value=hash;closeMenu(false);syncShotQuery();recordLearningVisit()
 nextTick(()=>{if(!disposed&&location.hash===hash)focusDestination(hash,hash.startsWith('#shot-'))})
}

watch(routeKey,()=>pageReady(true),{flush:'post'})
watch(()=>api.state.localAvailable,ok=>{if(ok)syncShotQuery()})
watch(errorQuery,filterHelp)
watch(drawerOpen,async value=>{setScrollLock(value);if(value){await nextTick();if(drawerOpen.value)railFocusable()[0]?.focus()}})
onMounted(()=>{
 mediaQuery=window.matchMedia('(max-width:760px)');updateViewport();mediaQuery.addEventListener('change',updateViewport)
 window.addEventListener('keydown',keyboard);window.addEventListener('hashchange',hashChanged)
 previousAfterRouteChange=router.onAfterRouteChange;router.onAfterRouteChange=afterRouteChange
 loadLearningState();routeQuery.value=location.search;routeHash.value=location.hash;pageReady()
})
onBeforeUnmount(()=>{
 disposed=true;pageRevision++;setScrollLock(false)
 sectionObserver?.disconnect()
 mediaQuery?.removeEventListener('change',updateViewport)
 window.removeEventListener('keydown',keyboard);window.removeEventListener('hashchange',hashChanged)
 if(router.onAfterRouteChange===afterRouteChange)router.onAfterRouteChange=previousAfterRouteChange
})
</script>

<template>
<div class="studio-shell" :class="['page-'+pageKind,{'menu-open':menu,'focus-mode':focus,'manager-page':current==='/guide/manager','has-document-toc':articleSections.length>1&&!focus}]" @click="navigationClick">
 <a class="skip" href="#studio-main" :inert="drawerOpen">跳到正文</a>
 <button v-if="drawerOpen" class="rail-scrim" tabindex="-1" @click="closeMenu()" aria-label="关闭目录"></button>
 <aside ref="rail" id="studio-navigation" class="studio-rail" :inert="railHidden" :aria-hidden="railHidden||undefined" :role="drawerOpen?'dialog':undefined" :aria-modal="drawerOpen?'true':undefined" aria-label="学习中心目录" tabindex="-1">
  <button v-if="mobile" class="rail-close" @click="closeMenu()">关闭目录 ×</button>
  <a class="studio-brand" href="/guide/start" aria-label="星芒 AI 教程首页"><img :src="xingmangLogo" alt="星芒 AI" width="180" height="71"></a>
  <a class="rail-home-link" href="/guide/start" :class="{active:isHome}" :aria-current="isHome?'page':undefined"><span aria-hidden="true">⌂</span>教程总览</a>
  <LearningSidebar :path="current" :query="routeQuery" :hash="progressHash" />
  <div class="rail-nav-group">
   <p class="rail-group-title" id="support-nav-title">账号与帮助</p>
   <nav aria-labelledby="support-nav-title">
    <a v-for="[icon,label,href] in supportNav" :key="href" :href="href" :class="{active:navigationActive(current,href)}" :aria-current="navigationActive(current,href)?'page':undefined"><span aria-hidden="true">{{icon}}</span>{{label}}</a>
   </nav>
  </div>
  <SupportPanel />
  <a v-if="api.state.localAvailable" class="rail-edit" href="/screenshots">截图工作台 · 本机编辑</a>
 </aside>
 <header class="studio-top" :inert="drawerOpen">
  <button ref="menuButton" class="menu-toggle" @click="toggleMenu" :aria-expanded="drawerOpen" aria-controls="studio-navigation" aria-label="展开目录">☰</button>
  <span class="top-crumb">星芒文档 <b>/ 学习中心</b></span>
  <div class="top-actions">
   <span class="version-tag">v5.6</span>
   <button class="search-trigger" @click="openSearch" aria-label="搜索教程、工具与问题" aria-haspopup="dialog">⌕ 搜索教程、工具与问题 <kbd>Ctrl K</kbd></button>
   <a :href="data.site.console_url" target="_top" rel="noreferrer">返回控制台 ↗</a>
   <button class="focus-button" @click="toggleFocus" :aria-pressed="focus">{{focus?'退出专注':'专注阅读'}}</button>
  </div>
 </header>
 <div class="studio-body" :inert="drawerOpen">
  <EditorBar />
  <main ref="main" id="studio-main" tabindex="-1" @click="contentClick">
   <StudioHub v-if="isHome" kind="home"/>
   <template v-else>
    <LearningPath v-if="learningPath" :path="learningPath" :sections="articleSections" :active-section="activeSection" :completed="completedSteps" :back-href="previousLearningHref" />
    <section v-else-if="current==='/guide/verify'" class="learning-track-choice" aria-label="选择验证路线">
     <strong>先选择正在验证的工具</strong><p>两种 CLI 分别验证。普通 Claude Desktop 官方登录按桌面教程检查。</p>
     <nav aria-label="工具验证入口"><a href="/guide/verify?track=codex">Codex 验证路线</a><a href="/guide/verify?track=claude-code">Claude Code 验证路线</a><a href="/clients/claude-desktop">Claude Desktop 教程</a></nav>
    </section>
    <div v-if="isHelp" class="help-search">
     <label>按{{current==='/errors'?'错误原文':'问题关键词'}}查找<input v-model="errorQuery" type="search" placeholder="例如 429、余额、模型、充值" aria-describedby="help-filter-status" /></label>
     <p>先在本页搜一遍。状态码不等于唯一原因；版本、接口和计费以当前本站记录为准。</p>
     <p v-if="normalizedHelp" id="help-filter-status" role="status">{{helpCount?'找到 '+helpCount+' 项相关内容。':'没有匹配内容，请换个关键词，或查看相关页面联系本站客服。'}} <button type="button" class="help-clear" @click="errorQuery=''">清除筛选</button></p>
     <span v-else id="help-filter-status" class="interaction-sr-only" role="status">显示全部内容。</span>
    </div>
    <details v-if="!learningPath&&articleSections.length>1" :key="routeKey+'-outline'" class="document-outline-mobile">
     <summary>本页目录 <span>{{articleSections.length}} 节</span></summary>
     <nav aria-label="本页章节"><a v-for="section in articleSections" :key="section.id" :href="'#'+encodeURIComponent(section.id)">{{section.title}}</a></nav>
    </details>
    <Content :key="route.path" class="vp-doc" />
    <LearningPath v-if="learningPath" position="bottom" :path="learningPath" :completed="completedSteps" :storage-message="completionStorageMessage" @complete="completeLearningStep" />
    <nav v-if="pageLinks.length" class="page-links" aria-label="相关页面"><a v-for="[label,href] in pageLinks" :key="href" :href="href" :target="href.startsWith('https:')?'_blank':undefined" :rel="href.startsWith('https:')?'noopener noreferrer':undefined">{{label}} →</a></nav>
   </template>
   <Teleport v-for="target in targets" :key="target.id" :to="target.host"><ScreenshotSlot :slot-id="target.id"/></Teleport>
   <footer class="studio-footer"><span>星芒 AI 学习空间 · 少一些摸索，多一些开始。</span><a href="/contact">需要帮助</a><span>v5.6 · 课程与实际版本请分别核对</span></footer>
  </main>
 </div>
 <aside v-if="articleSections.length>1&&!focus" class="document-toc" :inert="drawerOpen" aria-label="本页目录">
  <p>本页内容</p>
  <nav><a v-for="section in articleSections" :key="section.id" :href="'#'+encodeURIComponent(section.id)" :aria-current="activeSection===section.id?'location':undefined">{{section.title}}</a></nav>
  <a class="document-toc-top" href="#studio-main">回到顶部 ↑</a>
 </aside>
 <div v-if="api.state.message" class="studio-toast" role="status">{{api.state.message}}</div>
 <ImagePreview ref="documentPreview" />
 <dialog ref="searchDialog" class="search-dialog" aria-labelledby="studio-search-title" @cancel.prevent="closeSearch()" @click="event=>{if(event.target===searchDialog)closeSearch()}" @keydown="searchKey">
  <div class="dialog-head"><strong id="studio-search-title">在本站教程中搜索</strong><button @click="closeSearch()">关闭 ×</button></div>
  <input ref="searchInput" v-model="search" type="search" placeholder="搜索课程、Skill 或报错文案" aria-label="搜索" aria-describedby="studio-search-status" autocomplete="off">
  <p id="studio-search-status" class="search-status" role="status">{{normalizedSearch?(results.length?'找到 '+results.length+' 项结果，按上下方向键选择，回车打开。':'没有结果，请换一个关键词。'):'输入关键词查找课程、工具、Skill 和常见问题。'}}</p>
  <div class="search-results"><a v-for="result in results" :key="result.route" :href="result.route">{{result.title}}<small>{{result.excerpt}}</small></a></div>
 </dialog>
</div>
</template>
