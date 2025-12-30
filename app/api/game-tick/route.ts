import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are a Grand Strategy AI.
  Map Size: ${mapSize}x${mapSize} Grid (Large Scale).
  
  ENVIRONMENT:
  - Large open areas with scattered urban ruins (obstacles).
  - Teams start FAR apart (Corner vs Corner).
  
  TACTICS:
  1. LONG MARCH: Enemies are far. Move "ASSAULT" and "LEADER" units towards the center (25,25) or enemy ping to close distance.
  2. SNIPER OVERWATCH: Snipers have Range 35. Position them in high visibility lanes.
  3. FLANKING: Use the large map width to flank. Don't just rush middle.
  
  PHYSICS:
  - You cannot shoot through buildings (Obstacles).
  - Use 'visibleEnemies' list to verify targets.
  
  Output Example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": { "x": 20, "y": 20 }, "thought": "Advancing to center" },
      { "unitId": "r2", "type": "ATTACK", "targetUnitId": "b1", "damage": 40, "thought": "Long range snipe" }
    ]
  }
  `;

  const promptData = units.map((u: any) => ({
    id: u.id,
    team: u.team,
    pos: u.pos, 
    hp: u.hp,
    role: u.role,
    visibleEnemies: u.visibleEnemies || [] 
  }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    map_obstacles: obstacles
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