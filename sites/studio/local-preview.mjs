import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {preview} from 'vite'
import {createLocalScreenshotPlugin} from './local-screenshots.mjs'

const filename=fileURLToPath(import.meta.url)
const sitesDirectory=path.resolve(path.dirname(filename),'..')

export async function startLocalScreenshotPreview(siteId='newapi',requestedPort){
 if(!['newapi','sub2api'].includes(siteId))throw Error('站点必须是 newapi 或 sub2api')
 const port=requestedPort??(siteId==='newapi'?4184:4183)
 if(!/^[1-9][0-9]{0,4}$/.test(String(port))||Number(port)>65535)throw Error('端口必须是 1 到 65535 的整数')
 const siteDirectory=path.join(sitesDirectory,siteId)
 try{await fs.access(path.join(siteDirectory,'.vitepress/dist/index.html'))}
 catch{throw Error(`尚未找到 ${siteId} 的本地构建，请先在 sites 目录执行 npm run build:${siteId==='newapi'?'new':'sub'}`)}
 const server=await preview({
  configFile:false,
  root:siteDirectory,
  appType:'mpa',
  build:{outDir:'.vitepress/dist'},
  plugins:[createLocalScreenshotPlugin(siteDirectory)],
  preview:{host:'127.0.0.1',port:Number(port),strictPort:true,cors:false}
 })
 return server
}

if(process.argv[1]&&path.resolve(process.argv[1])===filename){
 try{
  if(process.argv.length>4)throw Error('用法：node studio/local-preview.mjs [newapi|sub2api] [端口]')
  const server=await startLocalScreenshotPreview(process.argv[2],process.argv[3])
  server.printUrls()
  console.log('截图自动保存已启用；此服务仅在本机运行，不会提交、推送或发布。')
 }catch(error){console.error(error.message);process.exitCode=1}
}
