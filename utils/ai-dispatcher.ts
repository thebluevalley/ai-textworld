// utils/ai-dispatcher.ts

// 简单的内存缓存，用于记录 Key 的使用时间
const keyUsageHistory: Record<string, number> = {};

interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  mode: 'reflex' | 'tactic'; 
}

export class AIDispatcher {
  private static getKeys(mode: 'reflex' | 'tactic'): string[] {
    // 🚨 全面切换到 SiliconFlow，因为 Groq 已被限制
    // 请确保 Vercel 环境变量 SILICON_KEYS 填入了你的 6 个 Key (逗号分隔)
    const keys = process.env.SILICON_KEYS?.split(',');
    
    if (!keys || keys.length === 0) {
      console.error(`[AI Error] No keys found in SILICON_KEYS. Check Vercel env vars.`);
    }
    return keys || [];
  }

  // 核心：找到一个当前空闲的 Key
  // 逻辑：单个 Key 冷却 6.1秒，但多个 Key 轮流工作
  private static getAvailableKey(keys: string[], mode: 'reflex' | 'tactic'): string | null {
    const now = Date.now();
    // 随机打乱以实现负载均衡
    const shuffled = keys.sort(() => 0.5 - Math.random());
    
    for (const key of shuffled) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;

      const lastUsed = keyUsageHistory[cleanKey] || 0;
      
      // 单个 Key 限制 10次/分 = 6秒/次。
      // 我们设为 6100ms 安全缓冲。
      const cooldown = 6100; 
      
      if (now - lastUsed > cooldown) {
        keyUsageHistory[cleanKey] = now;
        return cleanKey;
      }
    }
    
    // 如果所有 Key 都在冷却，返回 null (本次跳过，保护账号不被封)
    return null;
  }

  static async chatCompletion({ systemPrompt, userPrompt, mode }: AIRequestOptions) {
    const keys = this.getKeys(mode);
    const apiKey = this.getAvailableKey(keys, mode);

    if (!apiKey) {
      console.warn(`[AI Dispatcher] All keys are cooling down (rate limit protection).`);
      return null; 
    }

    const endpoint = 'https://api.siliconflow.cn/v1/chat/completions';

    // 两个模式都使用 SiliconFlow 的模型
    // reflex (快): Qwen2.5-7B -> 响应极快，适合每2秒一次的微操
    // tactic (稳): DeepSeek-V3 -> 适合更复杂的逻辑 (目前统一用快模型以保证流畅)
    const model = mode === 'reflex' 
      ? 'Qwen/Qwen2.5-7B-Instruct' 
      : 'deepseek-ai/DeepSeek-V3';

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
          max_tokens: 512,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Fail: ${response.status} - ${errorText}`);
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // 清洗 Markdown 代码块
      if (content.includes('```json')) {
        content = content.replace(/```json/g, '').replace(/```/g, '');
      } else if (content.includes('```')) {
         content = content.replace(/```/g, '');
      }

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