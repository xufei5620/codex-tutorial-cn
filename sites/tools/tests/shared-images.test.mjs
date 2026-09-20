import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {sharedImagesPlugin} from '../shared-images.mjs'

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'xm-shared-images-'))
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
 function put(name,content='fixture'){
  const file=path.join(root,name)
  fs.mkdirSync(path.dirname(file),{recursive:true})
  fs.writeFileSync(file,content)
  return file
 }
 const source=put('sites/shared/pages/clients/codex.md','![Install](../../img/clients/install.png)')
 put('sites/shared/img/clients/install.png')
 for(const id of ['sub2api','newapi'])fs.mkdirSync(path.join(root,'sites',id),{recursive:true})
 return {root,put,source,directory:id=>pathToFileURL(path.join(root,'sites',id)+path.sep)}
}

function renderer(directory){
 const calls=[],context={},link=()=>'<a>',fence=()=>'<pre>'
 const md={renderer:{rules:{link_open:link,fence,image:function(...args){
  calls.push({args,context:this})
  return '<img src="'+args[0][args[1]].attrGet('src')+'">'
 }}}}
 sharedImagesPlugin(md,directory)
 function render(src,relativePath='clients/codex.md'){
  const attrs=new Map([['src',src],['alt','Install'],['title','Step one']])
  const token={attrGet:name=>attrs.get(name),attrSet:(name,value)=>attrs.set(name,value)}
  const tokens=[token],options={xhtmlOut:true},env={relativePath},self={}
  const html=md.renderer.rules.image.call(context,tokens,0,options,env,self)
  return {src:attrs.get('src'),attrs,html,args:[tokens,0,options,env,self]}
 }
 return {md,calls,context,link,fence,render}
}

test('editor-relative shared pictures render at the public URL in both sites',t=>{
 const f=fixture(t),before=fs.readFileSync(f.source,'utf8')
 for(const id of ['sub2api','newapi']){
  const r=renderer(f.directory(id)),result=r.render('../../img/clients/install.png')
  assert.equal(result.src,'/img/shared/clients/install.png')
  assert.equal(result.html,'<img src="/img/shared/clients/install.png">')
  assert.equal(result.attrs.get('alt'),'Install')
  assert.equal(result.attrs.get('title'),'Step one')
  assert.deepEqual(r.calls[0].args,result.args)
  assert.equal(r.calls[0].context,r.context)
  assert.equal(r.md.renderer.rules.link_open,r.link)
  assert.equal(r.md.renderer.rules.fence,r.fence)
 }
 assert.equal(fs.readFileSync(f.source,'utf8'),before)
})

test('site overrides resolve relative images from their own source location',t=>{
 const f=fixture(t)
 f.put('sites/sub2api/overrides/clients/codex.md','![Install](../../../shared/img/clients/install.png)')
 assert.equal(renderer(f.directory('sub2api')).render('../../../shared/img/clients/install.png').src,'/img/shared/clients/install.png')
 assert.equal(renderer(f.directory('newapi')).render('../../img/clients/install.png').src,'/img/shared/clients/install.png')
 // An override must not accidentally inherit the shared source's relative base.
 assert.equal(renderer(f.directory('sub2api')).render('../../img/clients/install.png').src,'../../img/clients/install.png')
})

test('spaces and Chinese names are encoded while query strings and fragments survive',t=>{
 const f=fixture(t),name='安装 截图.png'
 f.put('sites/shared/img/clients/'+name)
 const r=renderer(f.directory('sub2api')),suffix='?version=2%20new#配置'
 for(const src of ['../../img/clients/'+name,'../../img/clients/'+encodeURIComponent(name)]){
  assert.equal(r.render(src+suffix).src,'/img/shared/clients/'+encodeURIComponent(name)+suffix)
 }
})

test('unrelated images, missing sources and malformed encodings remain unchanged',t=>{
 const f=fixture(t),r=renderer(f.directory('sub2api'))
 for(const src of [
  '/img/shared/clients/install.png','https://example.invalid/a.png','//example.invalid/a.png',
  'data:image/png;base64,AAAA','#image','?image=1','../../other/a.png',
  '../../img-neighbor/a.png','../../img/../private/a.png','../../img/%broken.png',
  '../../img/%00.png'
 ])assert.equal(r.render(src).src,src)
 const image='../../img/clients/install.png'
 assert.equal(r.render(image,'clients/missing.md').src,image)
 assert.equal(r.render(image,'../../outside.md').src,image)
 assert.equal(r.render(image,null).src,image)
})

test('a renderer without an image rule delegates to renderToken',t=>{
 const f=fixture(t),md={renderer:{rules:{}}},options={}
 const token={attrGet:()=>'/logo.png'},tokens=[token]
 sharedImagesPlugin(md,f.directory('sub2api'))
 const self={renderToken(actual,index,opts){assert.equal(actual,tokens);assert.equal(index,0);assert.equal(opts,options);return 'fallback'}}
 assert.equal(md.renderer.rules.image(tokens,0,options,{},self),'fallback')
})
