import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are an ELITE TACTICAL AI. Map: ${mapSize}x${mapSize}.
  
  CORE DOCTRINE: "SURVIVE AND ELIMINATE"
  
  1. 🛡️ SELF-PRESERVATION (HIGHEST PRIORITY):
     - If HP < 500: DO NOT stand in the open. MOVE behind nearest Obstacle.
     - If HP is low, RETREAT away from enemies.
  
  2. 🔫 COMBAT LOGIC:
     - If enemy is visible AND you have high HP (>500): ATTACK.
     - If enemy is visible BUT you have low HP: ATTACK then RETREAT (if possible) or just HIDE.
     - Do NOT just stand still and trade shots if you are losing.
  
  3. 🏃 MANEUVERING:
     - SNIPER: Keep range > 10. Move to corners.
     - ASSAULT: Flank enemies behind cover. Don't charge in a straight line if they are watching.
     - MEDIC: Hide. Only move to heal.

  DATA PROVIDED:
  - "visibleEnemies": List of targets currently seen.
  
  Output Example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": {"x": 5, "y": 10}, "thought": "Taking Cover!" },
      { "unitId": "r1", "type": "ATTACK", "targetUnitId": "b1", "damage": 45, "thought": "Suppressing Fire" }
    ]
  }
  `;

  // Pre-process data to give AI situational awareness
  const promptData = units.map((u: any) => ({
    id: u.id, 
    team: u.team, 
    pos: u.pos, 
    hp: u.hp, 
    role: u.role,
    // Provide simplified enemy data
    visibleEnemies: u.visibleEnemies.map((e:any) => ({ 
      id: e.id, 
      hp: e.hp, 
      dist: Math.round(Math.sqrt(Math.pow(u.pos.x - e.pos.x, 2) + Math.pow(u.pos.y - e.pos.y, 2))) 
    }))
  }));

  // Send simplified obstacle data (just centers) to save tokens but give spatial awareness
  const simplifiedObstacles = obstacles.map((o:any) => ({ 
    type: "COVER", x: o.x + o.w/2, y: o.y + o.h/2 
  }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    nearby_cover: simplifiedObstacles.slice(0, 6) // Give them a few cover options
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