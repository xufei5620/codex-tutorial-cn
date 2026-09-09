<script setup>
import {ref,computed} from 'vue'
import {useShots} from './shot-store.js'
const props=defineProps({slotId:{type:String,required:true}});const api=useShots(),input=ref(),dialog=ref(),zoom=ref(''),metadata=ref(false),draft=ref({}),replacement=ref(-1)
const spec=computed(()=>api.specs.get(props.slotId)||{id:props.slotId,title:'本步骤截图',target:'请拍摄实际操作或结果。',siteOnly:true});const record=computed(()=>api.state.records[props.slotId]||{images:[]});const images=computed(()=>record.value.images||[])
function choose(i=-1){replacement.value=i;input.value.value='';input.value.click()}
async function picked(e){try{await api.upload(props.slotId,e.target.files,replacement.value)}catch(e){api.say(e.message)}e.target.value=''}
function drop(e){if(api.state.editing)api.upload(props.slotId,e.dataTransfer.files).catch(e=>api.say(e.message))}
function edit(){draft.value={...record.value};metadata.value=true}
function save(){api.update(props.slotId,{...record.value,...draft.value});metadata.value=false}
function remove(i){if(!confirm('移除此图？当前备份文件不会被修改。'))return;api.update(props.slotId,{...record.value,images:images.value.filter((_,n)=>n!==i)})}
function view(im){zoom.value=im.data;dialog.value.showModal()}
</script>
<template>
<div v-if="api.state.editing||(!record.hidden&&(!api.state.hideMissing||images.length))" class="shot-frame" :class="{'is-selected':api.state.active===slotId,'is-editor':api.state.editing}" :id="'shot-'+slotId" :tabindex="api.state.editing?0:-1" @focusin="api.state.active=slotId" @click="api.state.active=slotId" @dragover.prevent @drop.prevent="drop">
 <div class="shot-top"><strong>{{spec.title}}</strong><small>{{record.hidden?'已隐藏':images.length?images.length+' 张截图':'待补图'}}</small></div>
 <template v-if="!record.hidden">
  <div v-if="!images.length" class="shot-empty"><span class="shot-camera">▧</span><b>把你实际看到的界面放在这里</b><p>{{record.target||spec.target}}</p><button v-if="api.state.editing" class="gold-button" @click="choose()">＋ 上传真实截图</button><small v-if="api.state.editing">可拖入或选中此处粘贴 · PNG / JPG / WebP</small></div>
  <figure v-for="(im,i) in images" :key="i" class="shot-image"><button class="image-open" @click="view(im)" :aria-label="'放大截图：'+(record.alt||spec.title)"><img :src="im.data" :width="im.width" :height="im.height" :alt="record.alt||spec.title" loading="lazy"></button><figcaption>{{record.caption||spec.title}}<small>{{[record.product,record.system,record.version,record.date].filter(Boolean).join(' · ')}}</small></figcaption><div v-if="api.state.editing" class="shot-actions"><small>{{im.name}} · {{im.width}}×{{im.height}}</small><button @click="choose(i)">替换</button><button @click="remove(i)">移除</button></div></figure>
 </template><p v-else class="muted">此位置已隐藏；图片和说明仍保留。</p>
 <div v-if="api.state.editing" class="shot-editor"><p><b>拍摄重点：</b>{{record.highlight||spec.highlight}}</p><small>上传前请遮盖密钥、邮箱、验证码和客户信息。本工具不会自动脱敏，也不会发布网站。</small><div class="shot-actions"><button v-if="images.length&&!record.hidden" @click="choose()">＋ 添加图片</button><button @click="edit">编辑说明 / 隐藏</button><code>{{slotId}}</code></div></div>
 <input v-if="api.state.editing" ref="input" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden @change="picked">
 <div v-if="metadata" class="shot-meta"><label v-for="[key,label] in [['target','应截什么'],['caption','图注'],['alt','替代说明'],['product','产品'],['system','操作系统'],['version','版本'],['date','截图日期'],['highlight','拍摄重点']]" :key="key">{{label}}<input v-model="draft[key]" maxlength="3000" :type="key==='date'?'date':'text'"></label><label><input type="checkbox" v-model="draft.hidden"> 在阅读版隐藏，保留素材</label><label v-if="!spec.siteOnly">范围<select v-model="draft.scope"><option value="site">仅本站</option><option value="shared">已确认可共用的软件界面</option></select></label><div class="shot-actions"><button class="gold-button" @click="save">保存说明</button><button @click="metadata=false">取消</button></div></div>
 <dialog ref="dialog" class="shot-dialog" @click="e=>{if(e.target===dialog)dialog.close()}"><button class="dialog-close" @click="dialog.close()">关闭 ×</button><img :src="zoom" :alt="record.alt||spec.title"></dialog>
</div>
</template>
