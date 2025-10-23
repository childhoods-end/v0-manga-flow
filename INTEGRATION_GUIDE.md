# 🎨 智能文本渲染集成指南

本指南说明如何使用新的智能文本渲染功能，该功能已集成到现有的翻译工作流中。

## 🆕 新增功能

### 1. 智能 Canvas 文本渲染

**位置**: `lib/render/smartRender.ts`

**特点**:
- ✅ 完美的 CJK 字体支持（中文、日文、韩文）
- ✅ 智能字号计算（二分搜索找到最佳字号）
- ✅ 自动换行和文本适配
- ✅ 支持溢出处理（缩小字号或省略号）
- ✅ 可配置的文本样式（阴影、颜色、对齐）

**vs 原有 SVG 渲染**:
- 原有 SVG 渲染在服务器端字体支持有限
- 新的 Canvas 渲染使用 @napi-rs/canvas，完美支持中文

### 2. 气泡检测（可选）

**位置**: `lib/bubbleDetect.ts`

**特点**:
- 使用 OpenCV.js 自动检测对话框
- 基于形状、大小、对比度的智能筛选
- 重叠区域自动合并

**注意**: 目前气泡检测主要用于浏览器端演示，服务器端仍使用基于文本聚类的方式

## 📝 如何使用

### 自动启用（推荐）

智能渲染默认已启用。在 `.env.local` 中设置：

```env
# 启用智能 Canvas 渲染（默认开启）
ENABLE_SMART_RENDER=true

# 如果要禁用，改为 false（使用原有 SVG 渲染）
# ENABLE_SMART_RENDER=false
```

### 渲染配置

智能渲染已在 `app/api/translation-job/worker/route.ts` 中配置，默认参数：

```typescript
{
  maskOriginalText: true,      // 遮盖原文
  maxFont: 36,                  // 最大字号
  minFont: 10,                  // 最小字号
  lineHeight: 1.45,             // 行高
  padding: 12,                  // 内边距
  textAlign: 'center',          // 水平对齐
  verticalAlign: 'middle',      // 垂直对齐
  maxLines: 3,                  // 最大行数
  overflowStrategy: 'ellipsis', // 溢出策略（省略号）
  shadowBlur: 2,                // 文字阴影
  lang: 'auto'                  // 自动检测语言
}
```

### 手动使用智能渲染

如果要在其他地方使用智能渲染：

```typescript
import { renderPageSmart } from '@/lib/render'

const renderedBuffer = await renderPageSmart(
  imageBuffer,
  textBlocks,
  {
    maskOriginalText: true,
    maxFont: 36,
    minFont: 10,
    // ... 其他选项
  }
)
```

## 🔄 工作流程

### 现有翻译流程（已自动整合）

```
1. 上传图片 → 2. OCR识别 → 3. 文本聚类 → 4. 翻译 → 5. 智能渲染 → 6. 上传
   ↓              ↓            ↓             ↓          ↓              ↓
Upload API    Tesseract/   Group into   OpenAI/  renderPageSmart   Vercel
              Google       bubbles      Claude   (自动启用)        Blob
              Vision
```

**关键改进**:
- **Step 5**: 现在使用 `renderPageSmart` 代替 `renderPage`
- **字体渲染**: 中文不再模糊或显示为方块
- **文本布局**: 自动计算最佳字号和换行

### 浏览器端完整流程（演示页面）

```
1. 加载图片 → 2. 气泡检测 → 3. OCR → 4. 翻译 → 5. Canvas渲染
   ↓             ↓              ↓         ↓          ↓
Image         OpenCV.js      Tesseract  API调用   drawTextInRect
Element       bubbleDetect   ocrWords   /api/mt   (客户端)
                                        /api/llm
```

访问 `/manga-demo` 查看完整演示

## 🎯 API 参考

### renderPageSmart

```typescript
async function renderPageSmart(
  originalImageBuffer: Buffer,
  textBlocks: TextBlockWithTranslation[],
  options?: SmartRenderOptions
): Promise<Buffer>
```

**参数**:
- `originalImageBuffer`: 原始图片 Buffer
- `textBlocks`: 文本块数组（包含 bbox 和 translated_text）
- `options`: 渲染选项（可选）

**返回**: PNG 图片 Buffer

### SmartRenderOptions

```typescript
interface SmartRenderOptions {
  maskOriginalText?: boolean       // 是否遮盖原文（默认 false）
  backgroundColor?: string          // 遮盖背景色（默认白色）
  fontFamily?: string               // 字体（默认系统中文字体）
  maxFont?: number                  // 最大字号（默认 36）
  minFont?: number                  // 最小字号（默认 10）
  lineHeight?: number               // 行高（默认 1.45）
  padding?: number                  // 内边距（默认 12）
  textAlign?: CanvasTextAlign       // 水平对齐（默认 center）
  verticalAlign?: 'top'|'middle'|'bottom'  // 垂直对齐（默认 middle）
  maxLines?: number                 // 最大行数（默认 3）
  overflowStrategy?: 'shrink'|'ellipsis'  // 溢出策略（默认 ellipsis）
  fillStyle?: string                // 文字颜色（默认 #111）
  shadowColor?: string              // 阴影颜色（默认半透明白色）
  shadowBlur?: number               // 阴影模糊（默认 2）
  lang?: 'auto'|'zh'|'en'          // 语言（默认 auto）
}
```

## 🔧 调试

### 检查渲染模式

在日志中查看：

```
Using smart Canvas rendering  ✅ 使用智能渲染
Using SVG rendering          ❌ 使用旧渲染（需开启）
```

### 常见问题

**Q: 中文显示为方块？**
A: 确保 `ENABLE_SMART_RENDER=true`，智能渲染已自动处理中文字体

**Q: 文字溢出气泡？**
A: 调整 `maxLines`、`padding` 或 `lineHeight` 参数

**Q: 字号太小？**
A: 增大 `minFont` 参数，或减小 `padding`

**Q: 渲染速度慢？**
A: 智能渲染比 SVG 稍慢，但质量更高。如需快速预览，可暂时禁用

## 📊 性能对比

| 渲染方式 | CJK支持 | 文本布局 | 速度 | 推荐场景 |
|---------|---------|---------|------|---------|
| SVG (旧) | ❌ 有限 | ✅ 基础 | ⚡ 快 | 快速预览 |
| Canvas (新) | ✅ 完美 | ✅ 智能 | 🐢 中等 | **生产环境** |

## 🚀 最佳实践

1. **生产环境**: 始终启用 `ENABLE_SMART_RENDER=true`
2. **开发调试**: 可以临时禁用来加快测试速度
3. **字体配置**: 如需特殊字体，修改 `fontFamily` 参数
4. **布局调优**: 根据漫画风格调整 `lineHeight` 和 `padding`

## 🎨 示例

### 基础使用（自动）

翻译 API 会自动使用智能渲染，无需修改代码。

### 自定义配置

如需自定义渲染参数，修改 `worker/route.ts` 中的配置：

```typescript
const renderedBuffer = await renderPageSmart(
  imageBuffer,
  textBlocksToInsert,
  {
    maxFont: 40,           // 更大字号
    padding: 16,           // 更大内边距
    maxLines: 4,           // 允许更多行
    fillStyle: '#000',     // 纯黑色文字
    shadowBlur: 3,         // 更强阴影
  }
)
```

## 📦 依赖

- `@napi-rs/canvas`: 服务器端 Canvas 渲染
- `sharp`: 图像处理
- `tesseract.js`: OCR（浏览器端）
- `@google-cloud/vision`: OCR（服务器端）

## 📚 相关文档

- [Canvas 文本渲染](./lib/canvasText.ts) - 核心文本布局算法
- [智能渲染](./lib/render/smartRender.ts) - 服务器端渲染
- [气泡检测](./lib/bubbleDetect.ts) - OpenCV 气泡检测
- [漫画翻译系统](./MANGA_TRANSLATION_README.md) - 完整系统文档

---

**提示**: 智能渲染已默认启用，直接使用现有翻译 API 即可体验！
