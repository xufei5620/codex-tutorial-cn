/* Offline QR Code encoder, byte mode, ECC M, mask 0, versions 1–20.
 Matrix placement / RS block table adapted from python-qrcode 8.2 (BSD-3-Clause).
 See python-qrcode.txt. No external service is contacted. */
(() => { 'use strict';
const TABLE=[null,{"blocks":[[26,16]],"align":[]},{"blocks":[[44,28]],"align":[6,18]},{"blocks":[[70,44]],"align":[6,22]},{"blocks":[[50,32],[50,32]],"align":[6,26]},{"blocks":[[67,43],[67,43]],"align":[6,30]},{"blocks":[[43,27],[43,27],[43,27],[43,27]],"align":[6,34]},{"blocks":[[49,31],[49,31],[49,31],[49,31]],"align":[6,22,38]},{"blocks":[[60,38],[60,38],[61,39],[61,39]],"align":[6,24,42]},{"blocks":[[58,36],[58,36],[58,36],[59,37],[59,37]],"align":[6,26,46]},{"blocks":[[69,43],[69,43],[69,43],[69,43],[70,44]],"align":[6,28,50]},{"blocks":[[80,50],[81,51],[81,51],[81,51],[81,51]],"align":[6,30,54]},{"blocks":[[58,36],[58,36],[58,36],[58,36],[58,36],[58,36],[59,37],[59,37]],"align":[6,32,58]},{"blocks":[[59,37],[59,37],[59,37],[59,37],[59,37],[59,37],[59,37],[59,37],[60,38]],"align":[6,34,62]},{"blocks":[[64,40],[64,40],[64,40],[64,40],[65,41],[65,41],[65,41],[65,41],[65,41]],"align":[6,26,46,66]},{"blocks":[[65,41],[65,41],[65,41],[65,41],[65,41],[66,42],[66,42],[66,42],[66,42],[66,42]],"align":[6,26,48,70]},{"blocks":[[73,45],[73,45],[73,45],[73,45],[73,45],[73,45],[73,45],[74,46],[74,46],[74,46]],"align":[6,26,50,74]},{"blocks":[[74,46],[74,46],[74,46],[74,46],[74,46],[74,46],[74,46],[74,46],[74,46],[74,46],[75,47]],"align":[6,30,54,78]},{"blocks":[[69,43],[69,43],[69,43],[69,43],[69,43],[69,43],[69,43],[69,43],[69,43],[70,44],[70,44],[70,44],[70,44]],"align":[6,30,56,82]},{"blocks":[[70,44],[70,44],[70,44],[71,45],[71,45],[71,45],[71,45],[71,45],[71,45],[71,45],[71,45],[71,45],[71,45],[71,45]],"align":[6,30,58,86]},{"blocks":[[67,41],[67,41],[67,41],[68,42],[68,42],[68,42],[68,42],[68,42],[68,42],[68,42],[68,42],[68,42],[68,42],[68,42],[68,42],[68,42]],"align":[6,34,62,90]}];
const EXP=new Uint16Array(512),LOG=new Uint16Array(256);
let a=1;for(let i=0;i<255;i++){EXP[i]=a;LOG[a]=i;a<<=1;if(a&256)a^=0x11d;}for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
function ecc(bytes,count){let g=[1];for(let i=0;i<count;i++){const n=Array(g.length+1).fill(0);for(let j=0;j<g.length;j++){n[j]^=g[j];n[j+1]^=mul(g[j],EXP[i]);}g=n;}const out=bytes.concat(Array(count).fill(0));for(let i=0;i<bytes.length;i++){const factor=out[i];if(factor)for(let j=0;j<g.length;j++)out[i+j]^=mul(g[j],factor);}return out.slice(bytes.length);}
function bch(v,poly,shift){let d=v<<shift;const degree=x=>32-Math.clz32(x);while(degree(d)>=degree(poly))d^=poly<<(degree(d)-degree(poly));return (v<<shift)|d;}
function matrix(text){
 if(typeof text!=='string')throw new Error('二维码内容必须是文字。');
 const bytes=[...new TextEncoder().encode(text)];let v=1,cap=0;
 for(;v<=20;v++){cap=TABLE[v].blocks.reduce((a,b)=>a+b[1],0);if(4+(v<10?8:16)+bytes.length*8<=cap*8)break;}
 if(v>20)throw new Error('客服链接过长，请使用较短的 HTTPS 链接或上传原始二维码图片。');
 const bits=[];function put(value,length){for(let i=length-1;i>=0;i--)bits.push((value>>>i)&1);}
 put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));
 for(let i=Math.min(4,cap*8-bits.length);i>0;i--)bits.push(0);while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>(a<<1)|b,0));
 let pad=0;while(data.length<cap)data.push(pad++%2?0x11:0xec);
 let off=0;const blocks=TABLE[v].blocks.map(([total,count])=>{const d=data.slice(off,off+count);off+=count;return {data:d,ecc:ecc(d,total-count)};});
 const inter=[];for(const key of ['data','ecc']){const n=Math.max(...blocks.map(b=>b[key].length));for(let i=0;i<n;i++)blocks.forEach(b=>{if(i<b[key].length)inter.push(b[key][i]);});}
 const n=4*v+17,m=Array.from({length:n},()=>Array(n).fill(null));
 function finder(row,col){for(let r=-1;r<8;r++)for(let c=-1;c<8;c++){if(row+r<0||col+c<0||row+r>=n||col+c>=n)continue;m[row+r][col+c]=((r>=0&&r<=6&&(c===0||c===6))||(c>=0&&c<=6&&(r===0||r===6))||(r>=2&&r<=4&&c>=2&&c<=4));}}
 finder(0,0);finder(n-7,0);finder(0,n-7);
 TABLE[v].align.forEach(row=>TABLE[v].align.forEach(col=>{if(m[row][col]!==null)return;for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++)m[row+r][col+c]=Math.abs(r)===2||Math.abs(c)===2||(r===0&&c===0);}));
 for(let r=8;r<n-8;r++)if(m[r][6]===null)m[r][6]=r%2===0;
 for(let c=8;c<n-8;c++)if(m[6][c]===null)m[6][c]=c%2===0;
 const format=bch(0,0x537,10)^0x5412;
 for(let i=0;i<15;i++){const dark=!!((format>>>i)&1);m[i<6?i:i<8?i+1:n-15+i][8]=dark;m[8][i<8?n-i-1:i<9?15-i:14-i]=dark;}
 m[n-8][8]=true;
 if(v>=7){const ver=bch(v,0x1f25,12);for(let i=0;i<18;i++){const dark=!!((ver>>>i)&1);m[Math.floor(i/3)][i%3+n-11]=dark;m[i%3+n-11][Math.floor(i/3)]=dark;}}
 let row=n-1,inc=-1,idx=0,bit=7;
 for(let base=n-1;base>0;base-=2){const col=base<=6?base-1:base;while(true){for(const c of [col,col-1]){if(m[row][c]!==null)continue;let dark=idx<inter.length?!!((inter[idx]>>>bit)&1):false;if((row+c)%2===0)dark=!dark;m[row][c]=dark;if(--bit<0){idx++;bit=7;}}row+=inc;if(row<0||row>=n){row-=inc;inc=-inc;break;}}}
 return m;
}
globalThis.XMQR={matrix};
})();
