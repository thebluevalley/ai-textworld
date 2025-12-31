import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { gameState } = await req.json();
  const { speciesA, speciesB, environment, eventLog } = gameState;
  const recentHistory = eventLog.slice(-4).join("\n"); 

  // === PHASE 1: 生存决策 (并行) ===
  
  // 通用提示词模板
  const createPrompt = (me: any, enemy: any, role: string) => `
  你扮演物种【${me.name}】。
  状态: 种群 ${me.population}, 食物储备 ${me.food}。
  特征: ${me.traits.join(', ')}。
  对手: ${enemy.name} (种群 ${enemy.population})。
  环境: ${environment.type} (资源丰富度: ${environment.resourceLevel}/10)。

  请选择本回合的【唯一的】生存策略 (Action):
  1. FORAGE (采集): 安全获取食物，用于维持生存。
  2. HUNT (捕猎): 攻击对手。风险高，但能抢夺大量食物并削减对手。
  3. REPRODUCE (繁殖): 消耗大量食物，大幅增加种群。
  4. EVOLVE (进化): 消耗食物，获得一个新特征以适应环境。

  输出 (JSON): { "action": "FORAGE/HUNT/REPRODUCE/EVOLVE", "detail": "中文描述你的意图或新特征名称" }`;

  const [redRes, blueRes] = await Promise.all([
    AIDispatcher.chatCompletion({ role: 'RED', systemPrompt: createPrompt(speciesA, speciesB, 'RED'), userPrompt: `历史:\n${recentHistory}` }),
    AIDispatcher.chatCompletion({ role: 'BLUE', systemPrompt: createPrompt(speciesB, speciesA, 'BLUE'), userPrompt: `历史:\n${recentHistory}` })
  ]);

  if (!redRes || !blueRes) return NextResponse.json({ error: "决策瘫痪" }, { status: 429 });

  // === PHASE 2: 生态演算 (Green Brain) ===
  
  const greenPrompt = `你扮演【自然生态系统/裁判】。

  【本回合行为】
  - 物种A (${speciesA.name}): 选择了 [${redRes.action}] - ${redRes.detail}
  - 物种B (${speciesB.name}): 选择了 [${blueRes.action}] - ${blueRes.detail}
  - 环境: ${environment.type} (资源: ${environment.resourceLevel})

  【演算规则】
  1. **采集**: 增加食物。如果资源少，采集量低。
  2. **捕猎**: 如果A捕猎B -> 判定A的特征是否克制B？成功则A抢夺食物，B死人；失败则A受伤。
  3. **繁殖**: 消耗食物 -> 转化成种群。没食物则失败。
  4. **进化**: 消耗食物 -> 获得新特征。
  5. **代谢**: 所有物种每回合自动消耗一定食物。食物不足则饿死种群。

  请计算结果并更新环境 (随机生成下回合环境事件)。

  输出 (JSON):
  {
    "narrative": "专业的中文生态观察日志，描述双方的行为和后果。",
    "new_environment": { "type": "下回合环境(如: 暴雨, 旱灾, 鱼群爆发)", "resourceLevel": 1-10 },
    "stateUpdates": {
      "speciesA": { "popChange": int, "foodChange": int, "newTrait": "名称或null" },
      "speciesB": { "popChange": int, "foodChange": int, "newTrait": "名称或null" }
    }
  }`;

  const greenRes = await AIDispatcher.chatCompletion({ 
    role: 'GREEN', 
    systemPrompt: greenPrompt, 
    userPrompt: "结算生态循环。" 
  });

  if (!greenRes) return NextResponse.json({ error: "生态离线" }, { status: 429 });

  return NextResponse.json({
    ...greenRes,
    redAction: redRes,
    blueAction: blueRes
  });
}