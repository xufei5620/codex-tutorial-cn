// Keep source-relative images readable in editors while using the shared public assets.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

function within(root,file){
 const relative=path.relative(root,file)
 return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)
}

function isFile(file){
 try{return fs.statSync(file).isFile()}catch{return false}
}

export function sharedImagesPlugin(md,directory){
 const site=fileURLToPath(directory),shared=path.resolve(site,'../shared')
 const pages=path.join(shared,'pages'),overrides=path.join(site,'overrides'),images=path.join(shared,'img')
 const image=md.renderer.rules.image
 md.renderer.rules.image=function(tokens,index,options,env,self){
  const token=tokens[index],src=token.attrGet('src'),relativePath=env?.relativePath
  if(typeof src==='string'&&src&&!/^(?:[a-z][a-z\d+.-]*:|[\/\\?#])/i.test(src)&&typeof relativePath==='string'){
   const override=path.resolve(overrides,relativePath),common=path.resolve(pages,relativePath)
   const source=within(overrides,override)&&isFile(override)?override:within(pages,common)&&isFile(common)?common:null
   if(source){
    const suffixAt=src.search(/[?#]/),pathname=suffixAt<0?src:src.slice(0,suffixAt),suffix=suffixAt<0?'':src.slice(suffixAt)
    let decoded
    try{decoded=decodeURIComponent(pathname)}catch{}
    if(decoded&&!decoded.includes('\0')&&!path.isAbsolute(decoded)){
     const target=path.resolve(path.dirname(source),decoded)
     if(within(images,target)){
      const publicPath=path.relative(images,target).split(path.sep).map(encodeURIComponent).join('/')
      token.attrSet('src','/img/shared/'+publicPath+suffix)
     }
    }
   }
  }
  return image?image.call(this,tokens,index,options,env,self):self.renderToken(tokens,index,options)
 }
}
