import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are a STRATEGIC COMMANDER AI. Map: ${mapSize}x${mapSize}.
  
  YOUR JOB: POSITIONING ONLY.
  Shooting is handled automatically by unit reflexes. You must put them in the best spot to shoot.
  
  TACTICAL DOCTRINE:
  1. 🏥 MEDIC: Stay safe behind walls. Follow Leader.
  2. 🔭 SNIPER: Find LONG SIGHTLINES (Corridors). Stay away from enemies.
  3. ⚔️ LEADER/ASSAULT: FLANK enemies. Do not just run into the middle death zone. Use the sides.
  
  SITUATION AWARENESS:
  - If HP < 400: RETREAT to cover immediately.
  - If Enemy is camping: FLANK them from the side.
  
  OUTPUT FORMAT:
  - "thought": Strategic intent (e.g. "Flanking Left", "Holding Angle", "Retreating").
  - "type": "MOVE"
  - Coordinates: Integers only.
  
  Example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": {"x": 5, "y": 10}, "thought": "Flanking Left" },
      { "unitId": "r1", "type": "MOVE", "target": {"x": 25, "y": 20}, "thought": "Taking High Ground" }
    ]
  }
  `;

  const promptData = units.map((u: any) => {
    const myPos = u.pos || { x: u.x, y: u.y };
    return {
      id: u.id, 
      team: u.team, 
      pos: myPos, 
      hp: u.hp, 
      role: u.role
    };
  });

  // 简化障碍物数据
  const simplifiedObstacles = obstacles.map((o:any) => ({ 
    type: "WALL", x: Math.round(o.x + o.w/2), y: Math.round(o.y + o.h/2) 
  }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    key_locations: simplifiedObstacles.slice(0, 5) 
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