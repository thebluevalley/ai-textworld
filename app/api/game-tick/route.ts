import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { gameState, playerIntervention } = await req.json(); 
  const { species, environment, eventLog } = gameState;
  const recentHistory = eventLog.slice(-5).join("\n"); 

  // === PHASE 1: 刺激与变异 (Stimulus & Mutation) ===
  
  // 🔴 RED BRAIN: 大自然 (环境与灾难)
  const redPrompt = `你扮演【大自然/行星环境】。
  当前时代: ${species.era}。
  环境参数: 温度 ${environment.temperature}°C, 辐射 ${environment.radiation}mSv, 水位 ${environment.waterLevel}%。
  
  玩家(上帝)干预指令: "${playerIntervention || '无'}"
  
  任务: 
  1. 如果有玩家干预，以此为基础生成一场灾难。
  2. 如果无干预，根据当前时代随机生成一个自然选择压力（如捕食者、病毒、气候突变）。
  
  **输出要求 (JSON):**
  { 
    "event": "灾难的详细中文描述", 
    "type": "COLD/HEAT/TOXIC/PREDATOR", 
    "severity": 1-10 
  }`;

  // 🔵 BLUE BRAIN: 生命 (基因架构师)
  const bluePrompt = `你扮演【生命/基因架构师】。
  物种名称: ${species.name}。
  当前基因库: ${JSON.stringify(species.genes)}。
  
  任务: 针对当前环境，进化出一个【全新的基因】来生存下去。
  
  基因分类选择:
  - MORPHOLOGY (形态: 甲壳, 翅膀, 触手)
  - METABOLISM (代谢: 光合作用, 耐寒, 毒素消化)
  - SENSORY (感官: 声纳, 热感应, 复眼)
  - COGNITION (认知: 蜂巢思维, 工具使用, 本能)
  
  **输出要求 (JSON):**
  { 
    "new_gene_name": "基因的学术名称 (中文, 如: '低温休眠腺体')", 
    "category": "METABOLISM",
    "function": "中文解释该基因如何帮助生存" 
  }`;

  const [redRes, blueRes] = await Promise.all([
    AIDispatcher.chatCompletion({ role: 'RED', systemPrompt: redPrompt, userPrompt: `历史记录:\n${recentHistory}` }),
    AIDispatcher.chatCompletion({ role: 'BLUE', systemPrompt: bluePrompt, userPrompt: `历史记录:\n${recentHistory}` })
  ]);

  if (!redRes || !blueRes) return NextResponse.json({ error: "进化停滞" }, { status: 429 });

  // === PHASE 2: 自然选择 (Natural Selection) ===
  
  // 🟢 GREEN BRAIN: 达尔文裁决者 (DeepSeek/Volcengine)
  const greenPrompt = `你扮演【自然选择/进化论】(最高裁决者)。
  
  输入数据:
  - 威胁 (大自然): ${redRes.event} (类型: ${redRes.type}, 强度: ${redRes.severity})
  - 突变 (生命): ${blueRes.new_gene_name} (${blueRes.function})
  
  裁决指令:
  1. **判定 (JUDGE)**: 这个突变能否在逻辑上对抗该威胁？
     - 成功例子: "厚重皮毛" 对抗 "冰河世纪" -> 成功。
     - 失败例子: "水下鳃" 对抗 "干旱" -> 失败 (进化死胡同)。
  2. **计算 (CALCULATE)**:
     - 成功: 基因保留，种群爆发。
     - 失败: 基因丢弃，种群锐减。
  3. **命名 (RENAME)**: 如果进化成功且意义重大，给物种起一个新的、霸气的中文学名 (如 "原生质" -> "装甲原生质")。
  
  **输出要求 (JSON, 内容必须是中文):**
  {
    "narrative": "像纪录片一样描述这场生存斗争的中文旁白。",
    "is_successful": true/false,
    "evolutionary_verdict": "中文解释为什么存活或死亡。",
    "new_species_name": "新物种名称 或 null",
    "stateUpdates": {
      "populationChange": +1000 或 -500,
      "environmentChange": {"temperature": -5, "radiation": +2} 
    }
  }`;

  const greenRes = await AIDispatcher.chatCompletion({ 
    role: 'GREEN', 
    systemPrompt: greenPrompt, 
    userPrompt: "开始自然选择模拟。" 
  });

  if (!greenRes) return NextResponse.json({ error: "裁决离线" }, { status: 429 });

  return NextResponse.json({
    ...greenRes,
    mutation_attempt: blueRes
  });
}