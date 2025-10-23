// /lib/bubbleDetect.ts
import { loadOpenCV } from './loadOpenCV';

export type Rect = { x:number; y:number; width:number; height:number };
export type Bubble = { id:string; rect:Rect; contour?: Array<{x:number;y:number}>; score:number };

export async function detectBubblesFromImageEl(img: HTMLImageElement): Promise<Bubble[]> {
  const cv = await loadOpenCV();
  const src = cv.imread(img);
  const gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  // 去噪且保边
  const smooth = new cv.Mat(); cv.bilateralFilter(gray, smooth, 9, 75, 75);

  // 亮区（对白泡通常更亮）
  const thr = new cv.Mat();
  cv.adaptiveThreshold(smooth, thr, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 35, -10);
  cv.bitwise_not(thr, thr);

  // 边缘
  const edges = new cv.Mat();
  cv.Canny(smooth, edges, 50, 150);
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3,3));
  cv.dilate(edges, edges, kernel);

  // 候选区域 = 亮区 ∧ 边缘，闭运算平滑
  const cand = new cv.Mat();
  cv.bitwise_and(thr, edges, cand);
  cv.morphologyEx(cand, cand, cv.MORPH_CLOSE, kernel, new cv.Point(-1,-1), 2);

  const contours = new cv.MatVector(); const hierarchy = new cv.Mat();
  cv.findContours(cand, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const bubbles: Bubble[] = [];
  for (let i=0;i<contours.size();i++){
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area < 1000) continue;

    const rect = cv.boundingRect(cnt);
    const peri = cv.arcLength(cnt, true);
    const circularity = peri ? (4*Math.PI*area)/(peri*peri) : 0;
    const extent = area / (rect.width*rect.height);

    const mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    cv.drawContours(mask, contours, i, new cv.Scalar(255), -1);
    const meanInside = cv.mean(gray, mask)[0];

    const borderMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    cv.drawContours(borderMask, contours, i, new cv.Scalar(255), 2);
    const meanBorder = cv.mean(gray, borderMask)[0];

    const condArea = area > 1200;
    const condAspect = rect.width/rect.height < 2.6 && rect.height/rect.width < 2.6;
    const condCirc = circularity > 0.22;
    const condExtent = extent > 0.32;
    const condContrast = (meanInside - meanBorder) < -5 || meanInside > 200;

    if (!(condArea && condAspect && condCirc && condExtent && condContrast)) {
      mask.delete(); borderMask.delete(); continue;
    }

    bubbles.push({
      id: `b${i}`,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      score: (circularity*0.4) + (extent*0.3) + (Math.min(meanInside/255,1)*0.3),
      contour: contourToPoly(cv, cnt),
    });

    mask.delete(); borderMask.delete();
  }

  const merged = mergeOverlaps(bubbles);
  merged.sort((a,b)=> (a.rect.y===b.rect.y ? a.rect.x-b.rect.x : a.rect.y-b.rect.y));

  // 清理
  src.delete(); gray.delete(); smooth.delete(); thr.delete();
  edges.delete(); kernel.delete(); cand.delete(); contours.delete(); hierarchy.delete();

  return merged;
}

function contourToPoly(cv: typeof import('./loadOpenCV'), cnt: any) {
  const approx = new cv.Mat();
  const peri = cv.arcLength(cnt, true);
  cv.approxPolyDP(cnt, approx, 0.02*peri, true);
  const pts: Array<{x:number;y:number}> = [];
  for (let i=0; i<approx.data32S.length; i+=2) pts.push({x: approx.data32S[i], y: approx.data32S[i+1]});
  approx.delete(); return pts;
}

function mergeOverlaps(items: Bubble[], iou=0.2): Bubble[] {
  const res: Bubble[] = []; const used = new Array(items.length).fill(false);
  for (let i=0;i<items.length;i++){
    if (used[i]) continue;
    let cur = items[i];
    for (let j=i+1;j<items.length;j++){
      if (used[j]) continue;
      if (rectIoU(cur.rect, items[j].rect) >= iou){
        cur = { ...cur, rect: union(cur.rect, items[j].rect), score: Math.max(cur.score, items[j].score) };
        used[j]=true;
      }
    }
    res.push(cur);
  }
  return res;
}
function rectIoU(a:Rect,b:Rect){
  const x1=Math.max(a.x,b.x), y1=Math.max(a.y,b.y);
  const x2=Math.min(a.x+a.width,b.x+b.width), y2=Math.min(a.y+a.height,b.y+b.height);
  const inter = Math.max(0,x2-x1)*Math.max(0,y2-y1);
  const union = a.width*a.height + b.width*b.height - inter;
  return union? inter/union : 0;
}
function union(a:Rect,b:Rect):Rect{
  const x = Math.min(a.x,b.x), y = Math.min(a.y,b.y);
  const r = Math.max(a.x+a.width, b.x+b.width), bt = Math.max(a.y+a.height, b.y+b.height);
  return { x, y, width: r-x, height: bt-y };
}
