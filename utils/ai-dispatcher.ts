// utils/ai-dispatcher.ts

// 简单的内存缓存
const keyUsageHistory: Record<string, number> = {};

interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  mode: 'reflex' | 'tactic'; 
}

export class AIDispatcher {
  private static getKeys(mode: 'reflex' | 'tactic'): string[] {
    // 确保 Vercel 环境变量 SILICON_KEYS 填入了你的 Key (逗号分隔)
    const keys = process.env.SILICON_KEYS?.split(',');
    if (!keys || keys.length === 0) {
      console.error(`[AI Error] No keys found in SILICON_KEYS.`);
      return [];
    }
    return keys;
  }

  // 核心：找到一个可用 Key，包含强制回退逻辑
  private static getAvailableKey(keys: string[]): string {
    const now = Date.now();
    const cooldown = 6100; // 6.1秒安全间隔
    
    // 1. 优先寻找完全冷却的 Key
    const shuffled = keys.sort(() => 0.5 - Math.random());
    
    for (const key of shuffled) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;
      
      const lastUsed = keyUsageHistory[cleanKey] || 0;
      if (now - lastUsed > cooldown) {
        keyUsageHistory[cleanKey] = now;
        return cleanKey; // 完美，找到一个空闲的
      }
    }

    // 2. 🚨 紧急回退：如果所有 Key 都在冷却，找出那个“休息最久”的 Key 强制使用
    // 防止游戏因为 Key 不够而彻底卡死
    console.warn(`[AI Dispatcher] Warning: All keys busy. Forcing oldest key.`);
    
    let oldestKey = keys[0];
    let oldestTime = now;

    for (const key of keys) {
      const cleanKey = key.trim();
      const lastUsed = keyUsageHistory[cleanKey] || 0;
      if (lastUsed < oldestTime) {
        oldestTime = lastUsed;
        oldestKey = cleanKey;
      }
    }

    // 强制更新这个 Key 的时间
    keyUsageHistory[oldestKey] = now;
    return oldestKey;
  }

  static async chatCompletion({ systemPrompt, userPrompt, mode }: AIRequestOptions) {
    const keys = this.getKeys(mode);
    if (keys.length === 0) return null;

    // 获取 Key (保证不返回 null)
    const apiKey = this.getAvailableKey(keys);

    const endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
    const model = 'Qwen/Qwen2.5-7B-Instruct'; // 统一使用快模型

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
          max_tokens: 512, // 限制 token 数，防止 AI 写小作文
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Fail: ${response.status} - ${errorText}`);
        return null; 
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // === 核心修复：外科手术式提取 JSON ===
      // 1. 清理 Markdown 标记
      content = content.replace(/```json/g, '').replace(/```/g, '');

      // 2. 寻找第一个 '{' 和最后一个 '}'
      // 这能有效忽略 AI 在 JSON 前后的废话
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonString = content.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error(`[AI Parse Error] Extracted string is still invalid:`, jsonString);
          return null;
        }
      } else {
        console.error(`[AI Parse Error] No JSON braces found in:`, content);
        return null;
      }
      
    } catch (error) {
      console.error(`[AI Error] Mode: ${mode}`, error);
      return null;
    }
  }
}