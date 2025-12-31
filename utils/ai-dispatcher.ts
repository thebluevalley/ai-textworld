interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  role: 'RED' | 'BLUE' | 'GREEN'; // ⚡️ 核心修复：定义 role 属性
}

export class AIDispatcher {
  
  static async chatCompletion({ systemPrompt, userPrompt, temperature = 0.7, role }: AIRequestOptions) {
    let apiKey = '';
    let endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
    let model = 'Qwen/Qwen2.5-7B-Instruct'; // 默认使用硅基流动 Qwen

    // === 🔑 密钥与模型路由逻辑 ===
    if (role === 'RED') {
      // 红脑：硅基流动 Key 1
      apiKey = process.env.SILICON_KEY_RED || process.env.SILICON_KEYS?.split(',')[0] || '';
    } else if (role === 'BLUE') {
      // 蓝脑：硅基流动 Key 2
      apiKey = process.env.SILICON_KEY_BLUE || process.env.SILICON_KEYS?.split(',')[1] || '';
    } else if (role === 'GREEN') {
      // 🟢 绿脑：火山引擎 (Volcengine)
      apiKey = process.env.VOLCENGINE_KEY || '';
      endpoint = process.env.VOLCENGINE_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      model = process.env.VOLCENGINE_MODEL || 'doubao-pro-32k'; 
    }

    if (!apiKey) {
      console.error(`[AI Error] Missing API Key for role: ${role}`);
      // 兜底：如果没有特定 Key，尝试用第一个可用的
      apiKey = process.env.SILICON_KEYS?.split(',')[0] || '';
    }

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
          max_tokens: role === 'GREEN' ? 2000 : 1000, // 绿脑负责总结，给多点空间
        })
      });

      if (response.status === 429) {
        console.warn(`[AI Rate Limit] ${role} hit 429`);
        return { error: 429 };
      }

      if (!response.ok) {
        const txt = await response.text();
        console.warn(`[AI API Error] ${role} ${response.status}: ${txt}`);
        return null;
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // === ⚡️ 鲁棒的 JSON 提取 ===
      // 1. 尝试提取 Markdown 代码块
      const jsonBlockMatch = content.match(/```json([\s\S]*?)```/);
      let jsonString = jsonBlockMatch ? jsonBlockMatch[1] : content;
      
      // 2. 尝试定位 JSON 对象的大括号
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        // 3. 自动修复常见的 JSON 格式错误 (如末尾多余逗号)
        jsonString = jsonString.replace(/,\s*}/g, '}');
        
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error(`[AI Parse Error] ${role}`, content);
          return null;
        }
      }
      return null;
      
    } catch (error) {
      console.error(`[AI Fetch Error] ${role}`, error);
      return null;
    }
  }
}