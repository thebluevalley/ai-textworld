import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { gameState } = await req.json();
  const { speciesA, speciesB, environment, eventLog } = gameState;
  const recentHistory = eventLog.slice(-5).join("\n"); 

  // === PHASE 1: 双雄博弈 (并行生成策略) ===
  
  // 🔴 RED: 物种 A (深红)
  const redPrompt = `你扮演【物种A：${speciesA.name}】。
  你的对手是：${speciesB.name} (特征: ${speciesB.traits.join(', ')}).
  当前环境: ${environment.type} (强度 ${environment.severity}).
  
  任务: 进化出一个新特征，以此来：
  1. 抵抗环境压力。
  2. 击败或捕食对手。
  
  输出 (JSON): { "mutation": "特征名称", "tactic": "攻击/防御/适应", "reason": "中文解释战术意图" }`;

  // 🔵 BLUE: 物种 B (蔚蓝)
  const bluePrompt = `你扮演【物种B：${speciesB.name}】。
  你的对手是：${speciesA.name} (特征: ${speciesA.traits.join(', ')}).
  当前环境: ${environment.type} (强度 ${environment.severity}).
  
  任务: 进化出一个新特征，以此来：
  1. 在环境中存活。
  2. 防御对手的进攻或反击。
  
  输出 (JSON): { "mutation": "特征名称", "tactic": "攻击/防御/适应", "reason": "中文解释战术意图" }`;

  const [redRes, blueRes] = await Promise.all([
    AIDispatcher.chatCompletion({ role: 'RED', systemPrompt: redPrompt, userPrompt: `上一轮战况:\n${recentHistory}` }),
    AIDispatcher.chatCompletion({ role: 'BLUE', systemPrompt: bluePrompt, userPrompt: `上一轮战况:\n${recentHistory}` })
  ]);

  if (!redRes || !blueRes) return NextResponse.json({ error: "进化停滞" }, { status: 429 });

  // === PHASE 2: 星球意志裁决 (Green Brain) ===
  
  // 🟢 GREEN: 裁判与环境
  const greenPrompt = `你扮演【星球意志/最高裁判】。
  
  【战场数据】
  - 物种A (红): 进化了 [${redRes.mutation}] (战术: ${redRes.tactic})
  - 物种B (蓝): 进化了 [${blueRes.mutation}] (战术: ${blueRes.tactic})
  - 当前环境: ${environment.type}
  
  【裁决任务】
  1. **生成新环境**: 随机生成一个新的环境事件(如: 冰河世纪, 陨石, 病毒爆发)。
  2. **判定胜负**: 
     - 比较 A vs 环境, B vs 环境 (谁适应得更好?)
     - 比较 A vs B (谁的特征克制了谁? 例如: "利齿" 克 "软皮", 但 "硬壳" 克 "利齿")
  3. **计算伤害**: 失败方扣除种群数量，胜利方增加。
  
  输出 (JSON):
  {
    "narrative": "激情的中文解说，描述这场进化战争和环境剧变。",
    "new_environment": { "type": "新环境名称", "severity": 1-10 },
    "battle_result": {
      "winner": "A" 或 "B" 或 "DRAW",
      "reason": "中文解释胜负原因"
    },
    "stateUpdates": {
      "popA_change": +500 或 -1000,
      "popB_change": +500 或 -1000,
      "newTraitA": "${redRes.mutation}",
      "newTraitB": "${blueRes.mutation}"
    }
  }`;

  const greenRes = await AIDispatcher.chatCompletion({ 
    role: 'GREEN', 
    systemPrompt: greenPrompt, 
    userPrompt: "裁决本轮进化战争。" 
  });

  if (!greenRes) return NextResponse.json({ error: "裁判离线" }, { status: 429 });

  return NextResponse.json({
    ...greenRes,
    redMove: redRes,
    blueMove: blueRes
  });
}