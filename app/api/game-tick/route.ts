import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles } = await req.json();

  const systemPrompt = `You are a Tactical AI Engine.
  Map: 20x20 Grid.
  
  IMPORTANT: Output RAW JSON only. NO Markdown. NO Explanations.
  
  SYNTAX WARNING:
  - Coordinate format must be STRICTLY: { "x": 10, "y": 20 }
  - DO NOT miss the "y" key! (e.g. { "x": 10, 20 } is WRONG)
  
  Game Rules:
  - High HP System (~500 HP). Low Damage (20-40).
  - Use Obstacles for cover.
  - Roles: LEADER, SNIPER, MEDIC.
  
  Instructions:
  1. Move wounded units to cover.
  2. Medic HEALS nearby allies (range 3).
  3. Attack enemies in range.
  
  Output Example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": { "x": 5, "y": 6 }, "thought": "Cover" },
      { "unitId": "r1", "type": "ATTACK", "targetUnitId": "b1", "damage": 30, "thought": "Fire" }
    ]
  }
  `;

  const userPrompt = JSON.stringify({
    livingUnits: units.map((u: any) => ({ 
      id: u.id, 
      team: u.team, 
      role: u.role, 
      pos: { x: Math.round(u.x), y: Math.round(u.y) }, // 明确传对象结构
      hp: u.hp 
    })),
    obstacles: obstacles
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