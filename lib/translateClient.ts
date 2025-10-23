// /lib/translateClient.ts
type Lang = string;
const GLOSSARY: Record<string,string> = { "LLM":"大语言模型", "API":"API" };

export async function mtTranslate(text:string, source:Lang, target:Lang){
  const r = await fetch('/api/mt', { method:'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ text, source, target }) });
  try { const { translation } = await r.json(); return translation || text; } catch { return text; }
}

export async function polishManga(mtOut:string, target:Lang){
  const system = `你是漫画对白本地化译后编辑：在忠实原意前提下，把对白改写为口语化、贴合画面与人物性格、适合气泡短句展示。短句、自然、信息完整；保留占位符/标签；本地化拟声；每行约10–14个中文字符，2–3行优先。只输出结果。`;
  const user = `【术语表】
${Object.entries(GLOSSARY).map(([k,v])=>`${k}=>${v}`).join('\n')}

【待润色（目标语言：${target}）】
${mtOut}`;
  const r = await fetch('/api/llm', { method:'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ system, user }) });
  const { text } = await r.json(); return text;
}

export async function translateBlock(raw:string, source:Lang, target:Lang){
  const mt = await mtTranslate(raw, source, target);
  return await polishManga(mt, target);
}
