// utils/ai-dispatcher.ts

const keyUsageHistory: Record<string, number> = {};

interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  mode: 'reflex' | 'tactic'; 
}

export class AIDispatcher {
  private static getKeys(mode: 'reflex' | 'tactic'): string[] {
    const keys = process.env.SILICON_KEYS?.split(',');
    if (!keys || keys.length === 0) {
      console.error(`[AI Error] No keys found in SILICON_KEYS.`);
      return [];
    }
    return keys;
  }

  private static getAvailableKey(keys: string[]): string {
    const now = Date.now();
    // ⚡ 极速模式：实名账号冷却仅需 1000ms
    const cooldown = 1000; 
    
    const shuffled = keys.sort(() => 0.5 - Math.random());
    
    for (const key of shuffled) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;
      
      const lastUsed = keyUsageHistory[cleanKey] || 0;
      if (now - lastUsed > cooldown) {
        keyUsageHistory[cleanKey] = now;
        return cleanKey; 
      }
    }

    // 强制回退
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
    keyUsageHistory[oldestKey] = now;
    return oldestKey;
  }

  static async chatCompletion({ systemPrompt, userPrompt, mode }: AIRequestOptions) {
    const keys = this.getKeys(mode);
    if (keys.length === 0) return null;

    const apiKey = this.getAvailableKey(keys);
    const endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
    const model = 'Qwen/Qwen2.5-7B-Instruct'; 

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
        console.warn(`API Warn: ${response.status} - ${errorText}`);
        return null; 
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // 1. 清洗 Markdown
      content = content.replace(/```json/g, '').replace(/```/g, '');
      
      // 2. 提取 JSON 主体
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1) {
        let jsonString = content.substring(firstBrace, lastBrace + 1);
        
        // === 🛠️ 核心修复：自动修补 AI 漏写的 "y" 键 ===
        // 将 { "x": 17, 12 } 替换为 { "x": 17, "y": 12 }
        jsonString = jsonString.replace(/"x":\s*(\d+),\s*(\d+)\s*}/g, '"x": $1, "y": $2 }');

        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error(`[AI Parse Error] Invalid JSON`, jsonString);
          return null;
        }
      } else {
        return null;
      }
      
    } catch (error) {
      console.error(`[AI Error] Mode: ${mode}`, error);
      return null;
    }
  }
}