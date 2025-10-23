# 🎨 漫画自动翻译系统

完整的浏览器端漫画气泡检测、OCR 识别、机器翻译和智能排版系统。

## ✨ 功能特点

- **🔍 气泡检测**：使用 OpenCV.js 自动检测漫画对话框
- **📖 OCR 识别**：使用 Tesseract.js 提取文字
- **🌐 机器翻译**：支持 Google Translate / DeepL API
- **✍️ 口语化润色**：使用 LLM（OpenAI/Anthropic）优化翻译
- **📐 智能排版**：自适应字体大小、换行、对齐
- **⚡ 纯浏览器端**：无需服务器处理，保护隐私

## 📁 文件结构

```
lib/
├── loadOpenCV.ts          # OpenCV.js 加载器
├── bubbleDetect.ts        # 气泡检测算法
├── ocrClient.ts           # OCR 集成
├── translateClient.ts     # 翻译模块
└── canvasText.ts          # Canvas 文本渲染

components/
└── MangaTranslator.tsx    # 主组件

app/
├── api/
│   ├── mt/route.ts       # 机器翻译 API
│   └── llm/route.ts      # LLM 润色 API
└── manga-demo/page.tsx   # 演示页面

types/
└── opencv.d.ts           # OpenCV.js 类型定义
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
# tesseract.js 已自动安装
```

### 2. 配置环境变量

在 `.env.local` 中添加：

```env
# 翻译 API（选择其一）
GOOGLE_TRANSLATE_API_KEY=your_google_api_key
# 或
DEEPL_API_KEY=your_deepl_api_key

# LLM API（用于润色，选择其一）
OPENAI_API_KEY=your_openai_key
# 或
ANTHROPIC_API_KEY=your_anthropic_key
```

### 3. 准备测试图片

将漫画图片放在 `/public/sample-manga.png`

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000/manga-demo

## 📖 使用方法

### 基础用法

```tsx
import MangaTranslator from '@/components/MangaTranslator';

export default function Page() {
  return (
    <MangaTranslator
      src="/your-manga.png"
      targetLang="zh-CN"
    />
  );
}
```

### 高级用法 - 自定义处理流程

```tsx
import { detectBubblesFromImageEl } from '@/lib/bubbleDetect';
import { ocrWords, groupWordsByBubbles } from '@/lib/ocrClient';
import { translateBlock } from '@/lib/translateClient';
import { drawTextInRect } from '@/lib/canvasText';

// 1. 检测气泡
const bubbles = await detectBubblesFromImageEl(imgElement);

// 2. OCR 识别
const words = await ocrWords(imgElement, 'eng');
const textByBubble = groupWordsByBubbles(words, bubbles);

// 3. 翻译
const translated = await translateBlock(text, 'en', 'zh-CN');

// 4. 绘制到 Canvas
drawTextInRect(ctx, translated, bubble.rect, {
  maxFont: 34,
  minFont: 12,
  lineHeight: 1.45,
  padding: 12,
  textAlign: 'center',
  verticalAlign: 'middle',
  maxLines: 3,
  fillStyle: '#111',
  shadowBlur: 2,
});
```

## ⚙️ 配置选项

### 气泡检测参数

在 `lib/bubbleDetect.ts` 中调整：

```typescript
// 最小面积阈值
if (area < 1000) continue;

// 形状过滤条件
const condArea = area > 1200;                    // 面积
const condAspect = rect.width/rect.height < 2.6; // 宽高比
const condCirc = circularity > 0.22;             // 圆度
const condExtent = extent > 0.32;                // 填充率
```

### OCR 语言

```typescript
// 支持的语言代码
await ocrWords(img, 'eng');  // 英语
await ocrWords(img, 'jpn');  // 日语
await ocrWords(img, 'chi_sim');  // 简体中文
```

### 文本渲染选项

```typescript
drawTextInRect(ctx, text, rect, {
  fontFamily: 'system-ui, Arial',  // 字体
  maxFont: 32,        // 最大字号
  minFont: 12,        // 最小字号
  lineHeight: 1.45,   // 行高
  padding: 12,        // 内边距
  textAlign: 'center', // 对齐: left/center/right
  verticalAlign: 'middle', // 垂直: top/middle/bottom
  maxLines: 3,        // 最大行数
  overflowStrategy: 'ellipsis', // 溢出: shrink/ellipsis
  fillStyle: '#111',  // 文字颜色
  shadowColor: 'rgba(255,255,255,0.9)', // 阴影
  shadowBlur: 2,      // 阴影模糊
  lang: 'auto',       // 语言: auto/zh/en
});
```

## 🎯 算法说明

### 气泡检测流程

1. **图像预处理**
   - 转灰度图
   - 双边滤波（保边去噪）

2. **候选区域生成**
   - 自适应阈值（检测亮区）
   - Canny 边缘检测
   - 按位与运算组合
   - 形态学闭运算

3. **轮廓筛选**
   - 面积过滤（> 1200px²）
   - 宽高比（< 2.6）
   - 圆度（> 0.22）
   - 填充率（> 0.32）
   - 对比度检测

4. **后处理**
   - 重叠区域合并（IoU > 0.2）
   - 按位置排序

### 智能排版算法

1. **字号二分搜索**
   - 在 minFont~maxFont 范围内找最大可用字号
   - 保证文本不溢出气泡

2. **智能换行**
   - CJK 字符：按字符换行
   - 英文：按单词换行
   - 支持零宽空格软换行

3. **溢出处理**
   - shrink: 继续缩小字号
   - ellipsis: 添加省略号

## 🔧 故障排除

### 气泡检测不准确

1. 调整阈值参数（condArea, condCirc 等）
2. 检查图片质量（建议 1200px 宽度以内）
3. 尝试不同的边缘检测参数

### OCR 识别率低

1. 确保文字清晰
2. 选择正确的语言代码
3. 考虑使用 Google Cloud Vision API（更准确）

### 翻译质量差

1. 配置 OpenAI GPT-4 而非 GPT-3.5
2. 调整 `lib/translateClient.ts` 中的 system prompt
3. 在 GLOSSARY 中添加专业术语

### 文字溢出气泡

1. 增大 maxLines
2. 减小 padding
3. 调整 lineHeight
4. 使用更紧凑的字体

## 📊 性能优化

### 首次加载优化

```typescript
// 预加载 OpenCV 和 Tesseract
useEffect(() => {
  loadOpenCV();
  Tesseract.createWorker('eng').then(w => w.terminate());
}, []);
```

### 批量处理

```typescript
// 并行处理多个气泡
await Promise.all(
  bubbles.map(async (bubble) => {
    const text = await translateBlock(rawText, 'en', 'zh');
    drawText(text, bubble.rect);
  })
);
```

## 📝 API 参考

### detectBubblesFromImageEl

```typescript
function detectBubblesFromImageEl(img: HTMLImageElement): Promise<Bubble[]>

type Bubble = {
  id: string
  rect: Rect
  contour?: Array<{x: number; y: number}>
  score: number
}
```

### ocrWords

```typescript
function ocrWords(img: HTMLImageElement, lang?: string): Promise<WordBox[]>

type WordBox = {
  text: string
  x: number
  y: number
  w: number
  h: number
}
```

### translateBlock

```typescript
function translateBlock(
  raw: string,
  source: string,
  target: string
): Promise<string>
```

### drawTextInRect

```typescript
function drawTextInRect(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: Rect,
  opts?: LayoutOptions
): void
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**提示**：建议先用小图测试（宽度 800px 左右），调优参数后再处理完整漫画页。
