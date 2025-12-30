import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

// Fisher-Yates 洗牌算法
function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  // === 1. 战术分组 ===
  const alphaIds = units.filter((u:any) => ['LEADER', 'MEDIC', 'ASSAULT'].includes(u.role)).map((u:any) => u.id);

  const systemPrompt = `You are a WARGAME AI controlling TWO opposing teams (BLUE vs RED). 
  Map: ${mapSize}x${mapSize}.
  
  ⚠️ **CRITICAL ISSUE TO FIX**: RED TEAM IS NOT MOVING.
  **YOU MUST GENERATE MOVE COMMANDS FOR THE RED TEAM.**
  
  TACTICAL DOCTRINE:
  1. 🔴 **RED TEAM (AGGRESSORS):**
     - STRATEGY: "VIOLENCE OF ACTION".
     - DO NOT CAMP. MOVE towards Blue team every turn.
     - HEAVY/SNIPER: Move to new vantage points. Don't stay in spawn.
     - ASSAULT: Rush flanks.
  
  2. 🔵 **BLUE TEAM (DEFENDERS):**
     - STRATEGY: "FLEXIBLE DEFENSE".
     - Hold angles, but fall back if overrun.
  
  3. ⚔️ **ACTIONS:**
     - **MOVE**: Standard movement.
     - **RUSH**: Fast move (Speed x1.5), No shooting. Use this to cross open ground.
     - **SUPPRESS**: Stop moving, shoot fast. ONLY use if enemy is VISIBLE. If no enemy, STOP suppressing and MOVE.
  
  Example Output (Must include RED units):
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": {"x": 10, "y": 10}, "tactic": "COVER_FIRE", "thought": "Holding angle" },
      { "unitId": "r1", "type": "MOVE", "target": {"x": 20, "y": 20}, "tactic": "RUSH", "thought": "Flanking Blue!" },
      { "unitId": "r_heavy", "type": "MOVE", "target": {"x": 15, "y": 15}, "tactic": "MOVE", "thought": "Advancing MG" }
    ]
  }
  `;

  // === 2. 数据打乱 (防止 AI 只关注列表前几个单位) ===
  // 我们打乱顺序发给 AI，但保留原始索引以便后续处理（如果需要）
  const promptData = units.map((u: any) => ({
    id: u.id, 
    team: u.team, 
    role: u.role, 
    pos: u.pos || {x: u.x, y: u.y}, 
    hp: u.hp, 
    isSuppressed: (u.suppression || 0) > 50,
    // 简化视野数据
    visibleEnemyCount: (u.visibleEnemies || []).length
  }));

  // ⚡️ 核心修复：打乱顺序，让 AI "雨露均沾"
  const shuffledSquad = shuffleArray([...promptData]);

  const simplifiedObstacles = obstacles.map((o:any) => ({ x: Math.round(o.x+o.w/2), y: Math.round(o.y+o.h/2) }));

  const userPrompt = JSON.stringify({
    active_units_randomized: shuffledSquad, // 发送乱序列表
    key_cover_points: simplifiedObstacles.slice(0, 5)
  });

  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex',
    systemPrompt,
    userPrompt
  });

  if (result && result.error === 429) {
    return NextResponse.json({ actions: [] }, { status: 429 });
  }

  return NextResponse.json(result || { actions: [] });
}