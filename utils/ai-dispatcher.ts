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
    return keys || [];
  }

  // 核心：找到一个当前空闲的 Key
  private static getAvailableKey(keys: string[]): string | null {
    const now = Date.now();
    // 简单的轮询：每次随机取一个，如果冷却中则找下一个
    // 为了简化，这里我们随机打乱数组尝试
    const shuffled = keys.sort(() => 0.5 - Math.random());
    
    for (const key of shuffled) {
      const lastUsed = keyUsageHistory[key] || 0;
      // 冷却时间：Groq 设为 2秒，Silicon 设为 5秒
      const cooldown = 2000; 
      if (now - lastUsed > cooldown) {
        keyUsageHistory[key] = now;
        return key;
      }
    }
    return null; // 所有 Key 都在冷却中
  }

  static async chatCompletion({ systemPrompt, userPrompt, mode }: AIRequestOptions) {
    const keys = this.getKeys(mode);
    const apiKey = this.getAvailableKey(keys);

    if (!apiKey) {
      console.warn(`[AI Dispatcher] All keys busy for mode ${mode}.`);
      return null; // 前端应处理此情况（如跳过该帧）
    }

    const endpoint = mode === 'reflex' 
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.siliconflow.cn/v1/chat/completions';

    const model = mode === 'reflex' ? 'llama3-8b-8192' : 'deepseek-ai/DeepSeek-V3';

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
          temperature: 0.7,
          response_format: { type: "json_object" } // 强制 JSON
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error(`[AI Error] Mode: ${mode}`, error);
      return null;
    }
  }
}