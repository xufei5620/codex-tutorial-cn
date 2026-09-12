import test from 'node:test'
import assert from 'node:assert/strict'
import {slotVisibility,catalogHref,chapterRecommendation} from '../theme/shot-presentation.mjs'

test('reading hides hidden images and optionally hides missing slots',()=>{
 assert.equal(slotVisibility({hidden:true,imageCount:1,hideMissing:false}),false)
 assert.equal(slotVisibility({imageCount:1,hideMissing:true}),true)
 assert.equal(slotVisibility({imageCount:0,hideMissing:true}),false)
 assert.equal(slotVisibility({imageCount:0,hideMissing:false}),true)
 assert.equal(slotVisibility({imageCount:0,capturePolicy:'none',hideMissing:false}),false)
})

test('editing keeps recommendations, active optional slots, and recoverable hidden slots visible',()=>{
 assert.equal(slotVisibility({editing:true,capturePolicy:'required'}),true)
 assert.equal(slotVisibility({editing:true,capturePolicy:'optional',active:true}),true)
 assert.equal(slotVisibility({editing:true,capturePolicy:'optional'}),false)
 assert.equal(slotVisibility({editing:true,capturePolicy:'optional',showOptional:true}),true)
 assert.equal(slotVisibility({editing:true,hidden:true,imageCount:1}),true)
})

test('empty none slots are read-only info links while uploaded none slots open editor',()=>{
 const spec={id:'ch04-s01-overview',route:'/learn/codex/ch04',capturePolicy:'none'}
 assert.equal(catalogHref(spec,{}),'/learn/codex/ch04?info=1#s1')
 assert.equal(catalogHref(spec,{images:[{data:'x'}]}),'/learn/codex/ch04?edit=1#shot-ch04-s01-overview')
})

test('published course figures stay visible unless hidden',()=>{
 assert.equal(slotVisibility({capturePolicy:'published',imageCount:0}),true)
 assert.equal(slotVisibility({capturePolicy:'published',hidden:true}),false)
 assert.equal(slotVisibility({editing:true,capturePolicy:'published',hidden:true}),true)
})
test('chapter recommendation count does not pretend an empty chapter has global recommendations',()=>{
 const manifest=[{id:'a',route:'/learn/codex/ch01',capturePolicy:'required'},{id:'b',route:'/learn/codex/ch02',capturePolicy:'required'}]
 assert.deepEqual(chapterRecommendation(manifest,{},'/learn/codex/ch07',false),{list:[],label:'本章暂无建议截图'})
 assert.equal(chapterRecommendation(manifest,{},'/screenshots',true).list.length,2)
})
