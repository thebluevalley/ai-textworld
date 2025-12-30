import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are a Combat AI. Map: ${mapSize}x${mapSize}.
  
  RULES OF ENGAGEMENT:
  1. AGGRESSION: If an enemy is listed in 'visibleEnemies', you MUST ATTACK. Do not just move.
  2. CLOSE QUARTERS: If distance < 5, FIRE immediately.
  3. MOVING: If no enemies visible, move towards map center or last known enemy position.
  
  OUTPUT FORMAT:
  - "thought": Short tactical phrase (max 3 words) e.g. "Firing", "Flanking", "Covering". This will be shown above unit's head.
  - Coordinates: { "x": 10, "y": 20 }
  
  Example:
  {
    "actions": [
      { "unitId": "b1", "type": "ATTACK", "targetUnitId": "r1", "damage": 40, "thought": "ENGAGING HOSTILE" },
      { "unitId": "b2", "type": "MOVE", "target": {"x":12,"y":12}, "thought": "REPOSITIONING" }
    ]
  }
  `;

  const promptData = units.map((u: any) => ({
    id: u.id, team: u.team, pos: u.pos, hp: u.hp, role: u.role,
    visibleEnemies: u.visibleEnemies // 这个列表现在更准确了
  }));

  const userPrompt = JSON.stringify({
    squad: promptData,
    map_obstacles: obstacles
  });

  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex',
    systemPrompt,
    userPrompt
  });

  if (result && result.error === 429) {
    return NextResponse.json({ actions: [] }, { status: 429 });
  }

  if (!result || !result.actions) {
    return NextResponse.json({ actions: [] });
  }

  return NextResponse.json(result);
}