// utils/ai-dispatcher.ts

interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  team?: 'BLUE' | 'RED'; 
}

export class AIDispatcher {
  
  private static getKeyForTeam(team?: 'BLUE' | 'RED'): string {
    let key = '';
    if (team === 'BLUE') key = process.env.SILICON_KEY_BLUE || '';
    if (team === 'RED') key = process.env.SILICON_KEY_RED || '';
    if (!key) {
      const pool = process.env.SILICON_KEYS?.split(',') || [];
      return pool[Math.floor(Math.random() * pool.length)] || '';
    }
    return key;
  }

  static async chatCompletion({ systemPrompt, userPrompt, temperature = 0.6, team }: AIRequestOptions) { // 温度稍微调低，让逻辑更严密
    const apiKey = this.getKeyForTeam(team);
    
    if (!apiKey) {
      console.error(`[AI Error] No API Key found for team: ${team}`);
      return null;
    }

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
          temperature: temperature,
          max_tokens: 1500, // 增加 Token 以容纳 CoT 思考过程
        })
      });

      if (response.status === 429) return { error: 429 };
      if (!response.ok) return null;
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // === ⚡️ 智能 JSON 提取器 ===
      // 1. 尝试找 ```json 包裹的内容
      const jsonBlockMatch = content.match(/```json([\s\S]*?)```/);
      let jsonString = '';

      if (jsonBlockMatch) {
        jsonString = jsonBlockMatch[1];
      } else {
        // 2. 如果没有 code block，尝试找最外层的 {}
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonString = content.substring(firstBrace, lastBrace + 1);
        }
      }

      // 3. 容错修复
      if (jsonString) {
        // 修复漏掉逗号的常见错误
        jsonString = jsonString.replace(/,\s*}/g, '}'); 
        try {
          const parsed = JSON.parse(jsonString);
          // 把原始思考过程也带上，虽然前端暂时不用，但方便调试
          return { ...parsed, _raw_thought: content };
        } catch (e) {
          console.error(`[AI Parse Error] Content:`, content);
          return null;
        }
      }
      return null;
      
    } catch (error) {
      console.error(`[AI Error] Team: ${team}`, error);
      return null;
    }
  }
}