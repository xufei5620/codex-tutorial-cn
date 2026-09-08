import {readFileSync} from 'node:fs'
import {siteConfig} from '../../shared/theme/site-config.mts'
export function studioConfig(directory:URL){
 const config=siteConfig(directory)
 const studio=JSON.parse(readFileSync(new URL('studio.generated.json',directory),'utf8'))
 config.themeConfig={...config.themeConfig,studio}
 config.head=[...(config.head||[]),['meta',{name:'xingmang-release',content:'5.3'}]]
 return config
}
