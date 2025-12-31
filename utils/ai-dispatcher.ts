// utils/ai-dispatcher.ts

interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  team?: 'BLUE' | 'RED'; // ⚡️ 新增：指定队伍
}

export class AIDispatcher {
  
  // 获取对应队伍的 Key
  private static getKeyForTeam(team?: 'BLUE' | 'RED'): string {
    let key = '';
    if (team === 'BLUE') key = process.env.SILICON_KEY_BLUE || '';
    if (team === 'RED') key = process.env.SILICON_KEY_RED || '';
    
    // 兜底：如果没有配置专用 Key，就用通用的 SILICON_KEYS
    if (!key) {
      const pool = process.env.SILICON_KEYS?.split(',') || [];
      return pool[Math.floor(Math.random() * pool.length)] || '';
    }
    return key;
  }

  static async chatCompletion({ systemPrompt, userPrompt, temperature = 0.7, team }: AIRequestOptions) {
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
          max_tokens: 1024, // 增加 token 数以支持复杂战术
        })
      });

      if (response.status === 429) {
        console.warn(`[AI Warn] Rate Limit 429 for ${team}`);
        return { error: 429 };
      }

      if (!response.ok) {
        const txt = await response.text();
        console.warn(`API Warn: ${response.status} - ${txt}`);
        return null; 
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // JSON 提取与修复
      content = content.replace(/```json/g, '').replace(/```/g, '');
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1) {
        let jsonString = content.substring(firstBrace, lastBrace + 1);
        // 自动修复常见的 JSON 格式错误 (如漏掉 y 坐标)
        jsonString = jsonString.replace(/"x":\s*(\d+),\s*(\d+)\s*}/g, '"x": $1, "y": $2 }');
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error(`[AI Parse Error]`, jsonString);
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