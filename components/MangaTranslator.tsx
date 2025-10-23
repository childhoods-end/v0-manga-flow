'use client';

import { useEffect, useRef, useState } from 'react';
import { detectBubblesFromImageEl } from '@/lib/bubbleDetect';
import { ocrWords, groupWordsByBubbles } from '@/lib/ocrClient';
import { translateBlock } from '@/lib/translateClient';
import { drawTextInRect } from '@/lib/canvasText';

type Props = { src: string; targetLang?: string };

export default function MangaTranslator({ src, targetLang='zh-CN' }: Props){
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('准备中…');

  useEffect(() => {
    const run = async () => {
      if (!canvasRef.current || !imgRef.current) return;
      setBusy(true); setMsg('识别气泡…');

      // draw bg
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);

      const img = imgRef.current;
      ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);

      // 1) 检测气泡
      const bubbles = await detectBubblesFromImageEl(img);
      if (!bubbles.length) { setMsg('未检测到气泡'); setBusy(false); return; }

      // 2) OCR 聚合
      setMsg('OCR 文本…');
      const words = await ocrWords(img);
      const rawByBubble = groupWordsByBubbles(words, bubbles);

      // 3) 翻译 & 绘制
      setMsg('翻译并回填…');
      for (const b of bubbles){
        const raw = (rawByBubble[b.id] || '').trim();
        if (!raw) continue;
        const zh = await translateBlock(raw, 'auto', targetLang);

        // 可选：如果原图泡底不干净，先铺一层半透明白
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        roundRect(ctx, b.rect.x, b.rect.y, b.rect.width, b.rect.height, 14);
        ctx.fill();

        drawTextInRect(ctx, zh, b.rect, {
          maxFont: 34, minFont: 12, lineHeight: 1.45, padding: 12,
          textAlign: 'center', verticalAlign: 'middle', maxLines: 3,
          overflowStrategy: 'ellipsis', fillStyle: '#111', shadowBlur: 2,
          shadowColor: 'rgba(255,255,255,0.9)', lang: 'auto'
        });
      }
      setMsg(`完成：${bubbles.length} 个气泡`);
      setBusy(false);
    };
    run();
  }, [src, targetLang]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-gray-600">{busy ? msg : msg}</div>
      <div className="relative w-full max-w-[900px]">
        {/* 用 <img> 方便给 OpenCV 读图；Image 仅做展示 */}
        <img ref={imgRef} src={src} alt="manga" className="invisible absolute" crossOrigin="anonymous" onLoad={() => {
          if (canvasRef.current && imgRef.current) {
            canvasRef.current.width = imgRef.current.naturalWidth;
            canvasRef.current.height = imgRef.current.naturalHeight;
          }
        }} />
        <canvas ref={canvasRef} className="w-full h-auto border rounded-lg shadow" />
      </div>
    </div>
  );
}

function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}
