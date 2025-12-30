import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are the WARGAME ENGINE. You control ALL units (BLUE and RED).
  Map: ${mapSize}x${mapSize}.
  
  CRITICAL INSTRUCTION:
  You must generate actions for EVERY SINGLE living unit provided in the input. 
  DO NOT ignore the Red Team.
  
  ROLE DOCTRINE (Follow Strictly):
  1. 🛡️ MEDIC: 
     - Stay BEHIND allies. 
     - If ally HP < 70%, MOVE to them immediately.
     - THOUGHT: "Rushing to aid", "Staying safe".
  
  2. 🔭 SNIPER:
     - Keep distance > 15 tiles from enemies.
     - Find long sightlines. DO NOT rush center.
     - THOUGHT: "Holding angle", "Relocating to high ground".
  
  3. ⚔️ ASSAULT / LEADER:
     - Aggressive. Close distance to < 8 tiles.
     - If distance < 5: FIRE at will.
     - THOUGHT: "Breaching", "Suppressing fire", "Flanking right".
  
  GENERAL TACTICS:
  - If no enemies visible: Blue moves South-East, Red moves North-West (Search pattern).
  - Use Obstacles: End turn near walls for cover.
  
  Output Example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": {"x":10,"y":10}, "thought": "Leading the charge" },
      { "unitId": "r1", "type": "MOVE", "target": {"x":20,"y":20}, "thought": "Intercepting Blue" }
    ]
  }
  `;

  // 整理数据，明确标记队伍，强迫 AI 看到红队
  const promptData = units.map((u: any) => ({
    id: u.id, 
    team: u.team, 
    role: u.role, 
    pos: u.pos, 
    hp: u.hp,
    // 简化可见列表，只保留 ID，节省 token
    visibleEnemies: u.visibleEnemies.map((e:any) => e.id) 
  }));

  const userPrompt = JSON.stringify({
    all_units_on_field: promptData, // 强调这是场上所有单位
    map_obstacles: obstacles
  });

  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex',
    systemPrompt,
    userPrompt
  });

  // 容错：如果 AI 还是没返回红队数据，我们在前端或者这里很难补救，
  // 但新的 Prompt 强调了 "EVERY SINGLE unit"，通常能解决问题。
  
  if (result && result.error === 429) {
    return NextResponse.json({ actions: [] }, { status: 429 });
  }

  if (!result || !result.actions) {
    return NextResponse.json({ actions: [] });
  }

  return NextResponse.json(result);
}