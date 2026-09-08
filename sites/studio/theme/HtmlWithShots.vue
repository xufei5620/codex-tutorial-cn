<script setup>
import {ref,shallowRef,onMounted,watch,nextTick} from 'vue'
import ScreenshotSlot from './ScreenshotSlot.vue'
const props=defineProps({html:{type:String,default:''}}),root=ref(),targets=shallowRef([])
async function mount(){targets.value=[];await nextTick();if(!root.value)return;const found=[...root.value.querySelectorAll('[data-shot-id]')];for(const host of found)host.textContent='';targets.value=found.map(host=>({host,id:host.dataset.shotId}))}
onMounted(mount);watch(()=>props.html,mount,{flush:'post'})
</script>
<template><div ref="root" class="lesson-prose" v-html="html"></div><Teleport v-for="target in targets" :key="target.id" :to="target.host"><ScreenshotSlot :slot-id="target.id" /></Teleport></template>
