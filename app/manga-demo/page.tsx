import MangaTranslator from '@/components/MangaTranslator';

export default function MangaDemoPage() {
  // 把下面的图片地址换成你的漫画页（建议先 1200px 内的图）
  const img = '/sample-manga.png';
  return (
    <main className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Manga 翻译预览</h1>
        <p className="text-gray-600 mb-6">
          自动检测气泡、OCR 识别、机器翻译、口语化润色、智能排版
        </p>
        <MangaTranslator src={img} targetLang="zh-CN" />

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">使用说明</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>将漫画图片放在 <code className="bg-white px-1 rounded">/public/sample-manga.png</code></li>
            <li>配置翻译 API：
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Google Translate: <code className="bg-white px-1 rounded">GOOGLE_TRANSLATE_API_KEY</code></li>
                <li>DeepL: <code className="bg-white px-1 rounded">DEEPL_API_KEY</code></li>
              </ul>
            </li>
            <li>配置 LLM API（用于润色）：
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>OpenAI: <code className="bg-white px-1 rounded">OPENAI_API_KEY</code></li>
                <li>Anthropic: <code className="bg-white px-1 rounded">ANTHROPIC_API_KEY</code></li>
              </ul>
            </li>
            <li>页面会自动：
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>使用 OpenCV.js 检测气泡</li>
                <li>使用 Tesseract.js 进行 OCR</li>
                <li>调用翻译 API</li>
                <li>智能排版并绘制到 Canvas</li>
              </ul>
            </li>
          </ol>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">⚠️ 注意事项</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li>首次加载会下载 OpenCV.js（~8MB）和 Tesseract 语言包</li>
            <li>建议使用宽度 1200px 以内的图片以获得最佳性能</li>
            <li>如果没有配置 API key，翻译功能会返回原文</li>
            <li>气泡检测算法针对白色对话框优化，其他样式可能需要调整参数</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
