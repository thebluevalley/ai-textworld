import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles } = await req.json();

  const systemPrompt = `You are a CQB Tactical AI.
  Map: 20x20 Grid. Complex Obstacles present.
  
  PHYSICS RULES:
  1. NO WALL-HACKS: You cannot shoot through walls.
  2. LINE OF SIGHT (LoS): You can only attack enemies listed in 'visibleEnemies'.
  3. COLLISION: Do not walk into walls. Use waypoints to go AROUND obstacles.
  
  TACTICS:
  - If no enemies visible: MOVE to corners or gaps to gain LoS (Search).
  - If enemy visible but far: MOVE closer to ensure hit.
  - If low HP: HIDE behind cover (break LoS).
  
  DATA FORMAT:
  - "visibleEnemies": List of targets currently seen by the unit.
  
  Output Example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": { "x": 10, "y": 5 }, "thought": "Rounding corner" },
      { "unitId": "b2", "type": "ATTACK", "targetUnitId": "r1", "damage": 25, "thought": "Visual confirmed" }
    ]
  }
  `;

  // 精简数据，重点是 visibleEnemies
  const promptData = units.map((u: any) => ({
    id: u.id,
    team: u.team,
    pos: u.pos, // 前端已经把 x,y 包装好了
    hp: u.hp,
    role: u.role,
    visibleEnemies: u.visibleEnemies || [] // 关键数据
  }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    map_obstacles: obstacles // 还是传给 AI，让它大致知道哪有墙
  });

  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex',
    systemPrompt,
    userPrompt
  });

  if (!result || !result.actions) {
    return NextResponse.json({ actions: [] });
  }

  return NextResponse.json(result);
}