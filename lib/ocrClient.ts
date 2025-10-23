// /lib/ocrClient.ts
import Tesseract from 'tesseract.js';
import type { Rect, Bubble } from './bubbleDetect';

export type WordBox = { text:string; x:number; y:number; w:number; h:number };

export async function ocrWords(imgEl: HTMLImageElement, lang='eng'): Promise<WordBox[]> {
  const worker = await Tesseract.createWorker(lang, 1);
  const { data } = await worker.recognize(imgEl);
  await worker.terminate();
  const words: WordBox[] = [];
  data.blocks.forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => {
    l.words.forEach(w => words.push({
      text: w.text, x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0
    }));
  })));
  return words;
}

export function groupWordsByBubbles(words: WordBox[], bubbles: Bubble[]): Record<string,string> {
  const map: Record<string,string> = {};
  for (const b of bubbles) {
    const r = b.rect;
    const inB = words.filter(w => centerIn(w, r))
      .sort((a,b)=> a.y===b.y ? a.x-b.x : a.y-b.y);
    map[b.id] = inB.map(w => w.text).join(' ');
  }
  return map;
}

function centerIn(w:WordBox, r:Rect){
  const cx=w.x+w.w/2, cy=w.y+w.h/2; return cx>=r.x && cx<=r.x+r.width && cy>=r.y && cy<=r.y+r.height;
}
