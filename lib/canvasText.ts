// /lib/canvasText.ts
export type Rect = {x:number;y:number;width:number;height:number};
export type LayoutOptions = {
  fontFamily?: string; maxFont?: number; minFont?: number; lineHeight?: number; padding?: number;
  textAlign?: CanvasTextAlign; verticalAlign?: 'top'|'middle'|'bottom';
  maxLines?: number; overflowStrategy?: 'shrink'|'ellipsis';
  fillStyle?: string; shadowColor?: string; shadowBlur?: number; lang?: 'auto'|'zh'|'en';
};

export function drawTextInRect(ctx:CanvasRenderingContext2D,text:string,rect:Rect,opts:LayoutOptions={}){
  const {
    fontFamily='system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans CJK SC", "PingFang SC", "Microsoft Yahei"',
    maxFont=32,minFont=12,lineHeight=1.45,padding=12,textAlign='center',verticalAlign='middle',
    maxLines=3,overflowStrategy='ellipsis',fillStyle='#111',shadowColor='rgba(255,255,255,0.9)',shadowBlur=2,lang='auto'
  }=opts;
  const w=Math.max(0,rect.width-padding*2), h=Math.max(0,rect.height-padding*2); if(w<=0||h<=0) return;
  const softened = soften(text);

  let lo=minFont, hi=maxFont, best=minFont;
  while(lo<=hi){
    const mid=(lo+hi)>>1; setFont(ctx,mid,fontFamily);
    const lines = wrap(ctx, softened, w, lang);
    const lh = mid*lineHeight;
    const fits = (Math.min(lines.length, maxLines)*lh) <= h;
    if(fits){ best=mid; lo=mid+1; } else { hi=mid-1; }
  }

  setFont(ctx,best,fontFamily);
  let lines = wrap(ctx, softened, w, lang);
  const lh = best*lineHeight;
  if(lines.length>maxLines){
    lines = lines.slice(0,maxLines);
    if(overflowStrategy==='ellipsis') lines[lines.length-1] = ellipsis(ctx, lines[lines.length-1], w);
  }
  while(lines.length*lh>h && lines.length>0){
    if(overflowStrategy==='ellipsis') lines[lines.length-1]=ellipsis(ctx,lines[lines.length-1],w);
    lines.pop();
  }

  ctx.textAlign=textAlign; ctx.textBaseline='alphabetic'; ctx.fillStyle=fillStyle;
  if(shadowBlur>0){ ctx.shadowColor=shadowColor; ctx.shadowBlur=shadowBlur; } else ctx.shadowBlur=0;

  const totalH = lines.length*lh;
  let startY = rect.y + padding + best;
  if(verticalAlign==='middle') startY = rect.y + (rect.height-totalH)/2 + best;
  if(verticalAlign==='bottom') startY = rect.y + rect.height - padding - (lines.length-1)*lh;

  for(let i=0;i<lines.length;i++){
    const L=lines[i]; let x=rect.x+padding;
    if(textAlign==='center'){ const tw=ctx.measureText(L).width; x = rect.x + (rect.width - tw)/2; }
    if(textAlign==='right'){ const tw=ctx.measureText(L).width; x = rect.x + rect.width - padding - tw; }
    const y=startY + i*lh; ctx.fillText(L, x, y);
  }
}
function setFont(ctx:CanvasRenderingContext2D, size:number, family:string){ ctx.font = `${size}px ${family}`; }
function soften(s:string,limit=30){ s=s.replace(/([\/\?#&=_\.\-,:;])/g,'$1\u200B'); return s.replace(new RegExp(`([^\\s]{${limit}})`,'g'),'$1\u200B'); }
function wrap(ctx:CanvasRenderingContext2D,text:string,maxW:number,lang:'auto'|'zh'|'en'){
  const cjk = lang==='zh' || (lang==='auto' && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text));
  const toks = tokenize(text, cjk); const out:string[]=[]; let line='';
  for(const tk of toks){
    if(tk==='\n'){ if(line) out.push(line); line=''; continue; }
    const test=line?line+tk:tk;
    if(ctx.measureText(test).width<=maxW) line=test;
    else{ if(line) out.push(line);
      if(ctx.measureText(tk).width>maxW){ for(const s of hardBreak(ctx,tk,maxW).slice(0,-1)) out.push(s); line=hardBreak(ctx,tk,maxW).slice(-1)[0]; }
      else line=tk;
    }
  }
  if(line) out.push(line); return out;
}
function tokenize(s:string,cjk:boolean){
  const res:string[]=[]; for(const ln of s.split(/\r?\n/)){
    if(cjk){ for(const ch of ln) res.push(ch); } else { res.push(...(ln.match(/(\s+|[^\s]+)/g)||[])); }
    res.push('\n');
  }
  if(res[res.length-1]==='\n') res.pop(); return res;
}
function hardBreak(ctx:CanvasRenderingContext2D,tk:string,maxW:number){
  const out:string[]=[]; let cur=''; for(const ch of tk){ const t=cur+ch; if(ctx.measureText(t).width<=maxW) cur=t; else { if(cur) out.push(cur); cur=ch; } }
  if(cur) out.push(cur); return out;
}
function ellipsis(ctx:CanvasRenderingContext2D,line:string,maxW:number){
  const E='…'; if(ctx.measureText(line).width<=maxW) return line;
  while(line.length>0 && ctx.measureText(line+E).width>maxW) line=line.slice(0,-1);
  return line+E;
}
