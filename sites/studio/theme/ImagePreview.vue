<script setup>
import {ref,onBeforeUnmount} from 'vue'
const dialog=ref(),image=ref(null)
let opener=null
function open(item,trigger){
  if(!dialog.value?.isConnected)return
  image.value=item
  opener=trigger
  if(!dialog.value.open)dialog.value.showModal()
}
function close(){dialog.value?.close()}
function restoreFocus(){
  if(dialog.value?.open)return
  image.value=null
  if(opener?.isConnected)opener.focus({preventScroll:true})
  opener=null
}
onBeforeUnmount(close)
defineExpose({open,close})
</script>
<template>
<dialog ref="dialog" class="image-preview" aria-label="截图预览" @click.self="close" @close="restoreFocus">
 <button type="button" class="preview-close" autofocus aria-label="关闭截图预览" @click="close">关闭 ×</button>
 <figure v-if="image">
  <img :src="image.data" :alt="image.alt" :width="image.width||undefined" :height="image.height||undefined">
  <figcaption v-if="image.caption">{{image.caption}}</figcaption>
 </figure>
</dialog>
</template>
<style scoped>
.image-preview{padding:64px 20px 20px;min-width:min(320px,96vw);max-width:96vw;max-height:96dvh;border:0;border-radius:14px;background:#122139;color:white;overflow:auto}
.image-preview::backdrop{background:#0c172bcc;backdrop-filter:blur(5px)}
.image-preview figure{margin:0}
.image-preview img{display:block;max-width:calc(96vw - 40px);max-height:calc(96dvh - 130px);width:auto;height:auto;object-fit:contain;margin:auto}
.image-preview figcaption{max-width:80ch;margin:12px auto 0;line-height:1.6;overflow-wrap:anywhere}
.preview-close{position:absolute;right:12px;top:10px;min-height:44px;min-width:72px;background:white;color:#122139;border:1px solid #d8e1ec;border-radius:8px;padding:8px 14px;cursor:pointer}
.preview-close:focus-visible{outline:3px solid #93bceb;outline-offset:3px}
</style>
