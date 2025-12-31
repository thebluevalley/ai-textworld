interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  role: 'RED' | 'BLUE' | 'GREEN';
  retryCount?: number;
}

export class AIDispatcher {
  
  private static getSiliconPool() {
    return [
      process.env.SILICON_KEY_RED,
      process.env.SILICON_KEY_BLUE,
      process.env.SILICON_KEY_1,
      process.env.SILICON_KEY_2,
      ...(process.env.SILICON_KEYS?.split(',') || [])
    ].filter(Boolean) as string[];
  }

  private static getConfig(role: 'RED' | 'BLUE' | 'GREEN', attempt: number) {
    const siliconPool = this.getSiliconPool();
    
    // 🟢 GREEN: 优先火山引擎，失败一次后降级
    if (role === 'GREEN' && attempt === 0) {
      return {
        apiKey: process.env.VOLCENGINE_KEY || '',
        endpoint: process.env.VOLCENGINE_ENDPOINT || '[https://ark.cn-beijing.volces.com/api/v3/chat/completions](https://ark.cn-beijing.volces.com/api/v3/chat/completions)',
        model: process.env.VOLCENGINE_MODEL || 'doubao-pro-32k',
        provider: 'VOLC'
      };
    }

    // 🔴 🔵: 硅基流动轮询
    const keyIndex = (Math.floor(Math.random() * siliconPool.length) + attempt) % siliconPool.length;
    
    return {
      apiKey: siliconPool[keyIndex] || '',
      endpoint: '[https://api.siliconflow.cn/v1/chat/completions](https://api.siliconflow.cn/v1/chat/completions)',
      model: 'Qwen/Qwen2.5-7B-Instruct',
      provider: 'SILICON'
    };
  }

  static async chatCompletion(options: AIRequestOptions): Promise<any> {
    const { systemPrompt, userPrompt, temperature = 0.7, role, retryCount = 0 } = options;
    
    if (retryCount > 2) {
      console.error(`[AI Fatal] ${role} failed after multiple retries.`);
      return null;
    }

    const config = this.getConfig(role, retryCount);

    if (!config.apiKey) {
      console.error(`[AI Error] No API Key available for ${role} (Provider: ${config.provider})`);
      return null;
    }

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: temperature,
          max_tokens: role === 'GREEN' ? 2048 : 1024,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[AI Failover] ${role} (${config.provider}) Error ${response.status}: ${errorText.slice(0, 100)}...`);
        return this.chatCompletion({ ...options, retryCount: retryCount + 1 });
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // === ⚡️ 增强型 JSON 提取与修复 ===
      // 1. 提取 Markdown (忽略大小写)
      const jsonBlockMatch = content.match(/```json([\s\S]*?)```/i);
      let jsonString = jsonBlockMatch ? jsonBlockMatch[1] : content;
      
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        
        // 2. 修复常见 JSON 语法错误
        // 修复末尾多余逗号
        jsonString = jsonString.replace(/,\s*}/g, '}'); 
        // ⚡️ 核心修复：移除数字前的 '+' 号 (例如 +1000 -> 1000)
        jsonString = jsonString.replace(/:\s*\+(\d+)/g, ': $1');

        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error(`[AI Parse Error] ${role}`, content); // 打印原始内容以便调试
          if (retryCount < 1) return this.chatCompletion({ ...options, retryCount: retryCount + 1 });
          return null;
        }
      }
      return null;
      
    } catch (error) {
      console.error(`[AI Network Error] ${role}`, error);
      return this.chatCompletion({ ...options, retryCount: retryCount + 1 });
    }
  }
}