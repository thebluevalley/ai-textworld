import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { gameState } = await req.json();
  const { speciesA, speciesB, environment, eventLog } = gameState;
  const recentHistory = eventLog.slice(-4).map((l:any) => l.text).join("\n"); 

  // === PHASE 1: 文明决策 (并行) ===
  
  // 🔴 RED: 科技文明
  const redPrompt = `你扮演【科技文明：${speciesA.name}】。
  现状: 人口 ${speciesA.population}, 能源储备 ${speciesA.food}。
  科技树: ${speciesA.traits.join(', ')}。
  对手: ${speciesB.name} (魔法文明)。
  环境: ${environment.type} (资源丰度: ${environment.resourceLevel}/10)。
  
  请选择本回合国家战略 (Action):
  1. DEVELOP (发展): 建设工业设施，采集能源。
  2. ATTACK (战争): 发动科技战争(轨道轰炸/机械军团)。
  3. EXPAND (扩张): 消耗能源增加人口/殖民地。
  4. RESEARCH (科研): 研发新科技(如: 反重力、纳米虫、戴森球)。

  输出 (JSON): { "action": "DEVELOP/ATTACK/EXPAND/RESEARCH", "detail": "中文描述具体战术或科技名称" }`;

  // 🔵 BLUE: 魔法文明
  const bluePrompt = `你扮演【魔法文明：${speciesB.name}】。
  现状: 信徒 ${speciesB.population}, 魔力储备 ${speciesB.food}。
  禁咒书: ${speciesB.traits.join(', ')}。
  对手: ${speciesA.name} (科技文明)。
  环境: ${environment.type} (灵气浓度: ${environment.resourceLevel}/10)。
  
  请选择本回合国家战略 (Action):
  1. MEDITATE (冥想): 汲取地脉魔力。
  2. CAST (施法): 发动魔法战争(禁咒/召唤/精神控制)。
  3. SUMMON (召唤): 消耗魔力召唤新信徒或魔法生物。
  4. STUDY (研习): 领悟新魔法(如: 时间停止、亡灵天灾、元素护盾)。

  输出 (JSON): { "action": "MEDITATE/CAST/SUMMON/STUDY", "detail": "中文描述具体法术或仪式名称" }`;

  const [redRes, blueRes] = await Promise.all([
    AIDispatcher.chatCompletion({ role: 'RED', systemPrompt: redPrompt, userPrompt: `历史记录:\n${recentHistory}` }),
    AIDispatcher.chatCompletion({ role: 'BLUE', systemPrompt: bluePrompt, userPrompt: `历史记录:\n${recentHistory}` })
  ]);

  if (!redRes || !blueRes) return NextResponse.json({ error: "文明停滞" }, { status: 429 });

  // === PHASE 2: 战争裁决 (Green Brain) ===
  
  const greenPrompt = `你扮演【位面观察者/历史记录者】。
  
  【本回合局势】
  - 科技方 (${speciesA.name}): [${redRes.action}] ${redRes.detail}
  - 魔法方 (${speciesB.name}): [${blueRes.action}] ${blueRes.detail}
  - 世界状态: ${environment.type}

  【裁决逻辑】
  1. **文明碰撞**: 科技 vs 魔法。
     - 例子: "电磁脉冲" vs "魔法护盾" -> 谁更强？
     - 例子: "纳米病毒" vs "神圣净化" -> 谁克制谁？
  2. **资源判定**: 
     - 战争消耗大量能源/魔力。
     - 发展/冥想增加资源。
  3. **随机事件**: 生成偶尔的位面危机 (如: 时空裂缝, 智械叛乱, 魔力枯竭)。

  输出 (JSON):
  {
    "narrative": "史诗般的中文历史记录，描述科技与魔法的碰撞。",
    "global_event": { 
      "name": "事件名(如: 魔法潮汐)", 
      "type": "NONE / DISASTER / BOOM",
      "description": "事件描述"
    },
    "new_resource_level": 1-10,
    "stateUpdates": {
      "speciesA": { "popChange": int, "foodChange": int (能源), "newTrait": "新科技或null" },
      "speciesB": { "popChange": int, "foodChange": int (魔力), "newTrait": "新法术或null" }
    }
  }`;

  const greenRes = await AIDispatcher.chatCompletion({ 
    role: 'GREEN', 
    systemPrompt: greenPrompt, 
    userPrompt: "推演文明进程。" 
  });

  if (!greenRes) return NextResponse.json({ error: "观察者离线" }, { status: 429 });

  return NextResponse.json({
    ...greenRes,
    redAction: redRes,
    blueAction: blueRes
  });
}