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
    // 🚨 紧急修复：Groq 已被限制，所有模式全部使用 SiliconFlow
    const keys = process.env.SILICON_KEYS?.split(',');
    
    if (!keys || keys.length === 0) {
      console.error(`[AI Error] No keys found in SILICON_KEYS. Check Vercel env vars.`);
    }
    return keys || [];
  }

  // 核心：找到一个当前空闲的 Key
  private static getAvailableKey(keys: string[], mode: 'reflex' | 'tactic'): string | null {
    const now = Date.now();
    const shuffled = keys.sort(() => 0.5 - Math.random());
    
    for (const key of shuffled) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;

      const lastUsed = keyUsageHistory[cleanKey] || 0;
      // 即使是 SiliconFlow，也保持 3 秒冷却以防万一
      const cooldown = 3000; 
      
      if (now - lastUsed > cooldown) {
        keyUsageHistory[cleanKey] = now;
        return cleanKey;
      }
    }
    // 强制取第一个
    return keys[0]?.trim() || null;
  }

  static async chatCompletion({ systemPrompt, userPrompt, mode }: AIRequestOptions) {
    const keys = this.getKeys(mode);
    const apiKey = this.getAvailableKey(keys, mode);

    if (!apiKey) {
      console.warn(`[AI Dispatcher] All keys busy/missing.`);
      return null; 
    }

    // 统一使用 SiliconFlow 的接入点
    const endpoint = 'https://api.siliconflow.cn/v1/chat/completions';

    // 策略调整：
    // reflex (快) -> 使用 Qwen2.5-7B (速度极快，适合高频移动)
    // tactic (稳) -> 使用 DeepSeek-V3 (逻辑强，适合复杂决策)
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
          temperature: 0.6,
          max_tokens: 512, // 限制回复长度，进一步提速
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 打印详细错误方便调试
        console.error(`API Fail: ${response.status} - ${errorText}`);
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // 清洗 Markdown
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