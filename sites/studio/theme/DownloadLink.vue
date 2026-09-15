<script setup>
import {computed} from 'vue'
import {useData} from 'vitepress'
function packageHref(site){
 for(const item of Object.values(site?.downloads||{})){
  if(item.enabled===false||!item.url)continue
  try{const u=new URL(String(item.url));if(u.protocol==='https:'&&!u.username&&!u.password)return u.href}catch{}
 }
 return '/contact'
}
const {theme}=useData()
const href=computed(()=>packageHref(theme.value.site||theme.value.studio?.site))
const external=computed(()=>href.value.startsWith('https:'))
</script>
<template>
<a class="gold-button" :href="href" :target="external?'_blank':undefined" :rel="external?'noopener noreferrer':undefined" referrerpolicy="no-referrer">下载安装包</a>
</template>
