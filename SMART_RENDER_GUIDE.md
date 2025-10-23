# ⚡ 智能文本渲染 - 快速指南

## 🎯 一句话总结

**智能文本渲染已自动集成到翻译系统中，无需额外配置即可使用！**

## ✨ 新功能亮点

### 之前 ❌
- 中文显示为方块或模糊
- 字号计算不准确
- 文本布局差

### 之后 ✅
- **完美的中文字体渲染**
- **智能字号自适应**
- **自动换行和文本布局**
- **可自定义样式（阴影、颜色等）**

## 🚀 立即使用

### 零配置使用（推荐）

直接使用现有的翻译功能，智能渲染已默认启用：

1. 上传漫画图片
2. 创建翻译任务
3. 等待处理完成
4. 下载结果 ✨

**就这么简单！**

### 访问演示页面

1. 将测试图片放在 `/public/sample-manga.png`
2. 访问 http://localhost:3000/manga-demo
3. 查看实时翻译效果

## 🎛️ 配置选项（可选）

### 环境变量

在 `.env.local` 中：

```env
# 启用智能渲染（默认已开启）
ENABLE_SMART_RENDER=true

# 如果要使用旧的 SVG 渲染（不推荐）
# ENABLE_SMART_RENDER=false
```

### 自定义渲染参数

编辑 `app/api/translation-job/worker/route.ts`：

```typescript
const renderedBuffer = await renderPageSmart(
  imageBuffer,
  textBlocksToInsert as any,
  {
    maskOriginalText: true,
    maxFont: 36,           // 最大字号（默认 36）
    minFont: 10,           // 最小字号（默认 10）
    lineHeight: 1.45,      // 行高（默认 1.45）
    padding: 12,           // 内边距（默认 12）
    textAlign: 'center',   // 对齐方式
    maxLines: 3,           // 最大行数
    fillStyle: '#111',     // 文字颜色
    shadowBlur: 2,         // 阴影强度
  }
)
```

## 📊 效果对比

| 功能 | 旧渲染 (SVG) | 新渲染 (Canvas) |
|------|--------------|-----------------|
| 中文显示 | ❌ 方块/模糊 | ✅ 完美清晰 |
| 字号适配 | ⚠️ 基础 | ✅ 智能计算 |
| 文本布局 | ⚠️ 简单 | ✅ 自动换行 |
| 性能 | ⚡ 快 | 🐢 中等 |
| 推荐场景 | 快速预览 | **生产环境** |

## 🔍 如何确认已启用

查看终端日志（翻译时）：

```
✅ Using smart Canvas rendering  // 已启用
❌ Using SVG rendering          // 未启用
```

## 🎨 核心文件

| 文件 | 说明 |
|------|------|
| `lib/render/smartRender.ts` | 智能渲染核心 |
| `lib/canvasText.ts` | 文本布局算法 |
| `lib/bubbleDetect.ts` | 气泡检测（演示用） |
| `components/MangaTranslator.tsx` | 浏览器端组件 |

## 🐛 常见问题

### Q: 中文还是方块？

**A**: 确认以下步骤：
1. `.env.local` 中 `ENABLE_SMART_RENDER=true`
2. 重启开发服务器
3. 查看日志确认使用 "smart Canvas rendering"

### Q: 文字溢出气泡？

**A**: 调整参数：
- 减小 `padding`（12 → 8）
- 增大 `maxLines`（3 → 4）
- 减小 `lineHeight`（1.45 → 1.3）

### Q: 字号太小？

**A**: 增大 `minFont`（10 → 12）

### Q: 渲染速度慢？

**A**: 智能渲染比 SVG 稍慢，但质量提升明显。如需快速预览，可临时禁用。

## 📚 相关文档

- [**集成指南**](./INTEGRATION_GUIDE.md) - 详细技术文档
- [漫画翻译系统](./MANGA_TRANSLATION_README.md) - 完整功能说明
- [快速开始](./QUICK_START.md) - 项目配置

## 💡 最佳实践

1. **生产环境**: 始终启用 `ENABLE_SMART_RENDER=true`
2. **测试阶段**: 使用演示页面 (`/manga-demo`) 快速验证
3. **参数调优**: 根据漫画风格微调 `lineHeight`、`padding`
4. **性能优化**: 批量处理时可考虑并发控制

## ✅ 检查清单

- [x] 智能渲染已集成到翻译 Worker
- [x] 默认启用
- [x] 中文字体完美支持
- [x] 智能文本布局
- [x] 可自定义样式
- [x] 演示页面可用

**一切就绪，开始翻译吧！** 🎉

---

**问题反馈**: 如遇到问题，请查看终端日志或浏览器控制台错误信息。
