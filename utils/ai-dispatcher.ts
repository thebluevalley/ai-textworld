// utils/ai-dispatcher.ts

interface AIRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  role: 'RED' | 'BLUE' | 'GREEN';
  retryCount?: number; // 内部重试计数
}

export class AIDispatcher {
  
  // === 资源池定义 ===
  private static getSiliconPool() {
    return [
      process.env.SILICON_KEY_1,
      process.env.SILICON_KEY_2
    ].filter(Boolean) as string[];
  }

  // === 智能路由逻辑 ===
  private static getConfig(role: 'RED' | 'BLUE' | 'GREEN', attempt: number) {
    // 🟢 GREEN: 始终走火山引擎 (Doubao)
    if (role === 'GREEN') {
      return {
        apiKey: process.env.VOLCENGINE_KEY || '',
        endpoint: process.env.VOLCENGINE_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        model: process.env.VOLCENGINE_MODEL || 'doubao-pro-32k',
        provider: 'VOLC'
      };
    }

    // 🔴 & 🔵: 走硅基流动 (SiliconFlow) 资源池
    const pool = this.getSiliconPool();
    // 负载均衡算法：随机选择，或者根据重试次数轮询
    // 如果是第 0 次尝试，随机选；如果是第 1 次重试，选另一个
    const keyIndex = (Math.floor(Math.random() * pool.length) + attempt) % pool.length;
    
    return {
      apiKey: pool[keyIndex] || '',
      endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
      model: 'Qwen/Qwen2.5-7B-Instruct',
      provider: 'SILICON'
    };
  }

  static async chatCompletion(options: AIRequestOptions): Promise<any> {
    const { systemPrompt, userPrompt, temperature = 0.7, role, retryCount = 0 } = options;
    
    // 获取配置 (根据重试次数自动切换 Key)
    const config = this.getConfig(role, retryCount);

    if (!config.apiKey) {
      console.error(`[AI Error] No API Key for ${role} (Provider: ${config.provider})`);
      return null;
    }

    try {
      // console.log(`[AI Dispatch] Role: ${role} | Provider: ${config.provider} | KeyIdx: ${retryCount % 2}`);

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
          // 绿脑需要更多 Token 来总结，红蓝脑轻量化
          max_tokens: role === 'GREEN' ? 2048 : 1024, 
        })
      });

      // === ⚡️ 故障转移逻辑 (Failover) ===
      if (response.status === 429 || response.status >= 500) {
        // 如果是硅基流动，且还有备用 Key，且重试次数 < 2
        if (config.provider === 'SILICON' && retryCount < 1) {
          console.warn(`[AI Failover] ${role} hit ${response.status}. Switching Silicon Key...`);
          // 递归调用，retryCount + 1，会自动切换到池子里的下一个 Key
          return this.chatCompletion({ ...options, retryCount: retryCount + 1 });
        }
        return { error: response.status };
      }

      if (!response.ok) {
        const txt = await response.text();
        console.warn(`[AI API Error] ${role} ${response.status}: ${txt}`);
        return null;
      }
      
      const data = await response.json();
      let content = data.choices[0].message.content;

      // === 鲁棒的 JSON 提取 (保持不变) ===
      const jsonBlockMatch = content.match(/```json([\s\S]*?)```/);
      let jsonString = jsonBlockMatch ? jsonBlockMatch[1] : content;
      
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
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
      // 网络错误也可以尝试重试一次
      if (retryCount < 1 && role !== 'GREEN') {
         return this.chatCompletion({ ...options, retryCount: retryCount + 1 });
      }
      return null;
    }
  }
}