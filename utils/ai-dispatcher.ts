// utils/ai-dispatcher.ts

// 简单的内存缓存，用于记录 Key 的使用时间
const keyUsageHistory: Record<string, number> = {};

interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  mode: 'reflex' | 'tactic'; // reflex=Groq(快), tactic=Silicon(稳)
}

export class AIDispatcher {
  private static getKeys(mode: 'reflex' | 'tactic'): string[] {
    const keys = mode === 'reflex' 
      ? process.env.GROQ_KEYS?.split(',') 
      : process.env.SILICON_KEYS?.split(',');
    
    // 调试日志：检查 Key 是否读取成功
    if (!keys || keys.length === 0) {
      console.error(`[AI Error] No keys found for mode: ${mode}. Check Vercel env vars.`);
    }
    return keys || [];
  }

  // 核心：找到一个当前空闲的 Key
  // fix: 增加了 mode 参数，以便判断冷却时间
  private static getAvailableKey(keys: string[], mode: 'reflex' | 'tactic'): string | null {
    const now = Date.now();
    // 随机打乱以实现负载均衡
    const shuffled = keys.sort(() => 0.5 - Math.random());
    
    for (const key of shuffled) {
      // 简单清洗 key 字符串
      const cleanKey = key.trim();
      if (!cleanKey) continue;

      const lastUsed = keyUsageHistory[cleanKey] || 0;
      // 冷却时间：Groq 设为 1秒 (极速)，Silicon 设为 3秒
      const cooldown = mode === 'reflex' ? 1000 : 3000; 
      
      if (now - lastUsed > cooldown) {
        keyUsageHistory[cleanKey] = now;
        return cleanKey;
      }
    }
    // 如果都在冷却，强制取第一个
    return keys[0]?.trim() || null;
  }

  static async chatCompletion({ systemPrompt, userPrompt, mode }: AIRequestOptions) {
    const keys = this.getKeys(mode);
    // fix: 这里调用时传入 mode
    const apiKey = this.getAvailableKey(keys, mode);

    if (!apiKey) {
      console.warn(`[AI Dispatcher] All keys busy/missing for mode ${mode}.`);
      return null; 
    }

    const endpoint = mode === 'reflex' 
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.siliconflow.cn/v1/chat/completions';

    // Groq 使用 llama-3.1-8b-instant
    // SiliconFlow 使用 deepseek-ai/DeepSeek-V3
    const model = mode === 'reflex' ? 'llama-3.1-8b-instant' : 'deepseek-ai/DeepSeek-V3';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.6,
          // 移除了 response_format 以避免 400 错误
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // 手动清洗 Markdown 代码块
      if (content.includes('```json')) {
        content = content.replace(/```json/g, '').replace(/```/g, '');
      } else if (content.includes('```')) {
         content = content.replace(/```/g, '');
      }

      // 尝试解析 JSON，如果失败则返回 null 避免前端炸裂
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error(`[AI Parse Error] Content is not JSON:`, content);
        return null;
      }
      
    } catch (error) {
      console.error(`[AI Error] Mode: ${mode}`, error);
      return null;
    }
  }
}