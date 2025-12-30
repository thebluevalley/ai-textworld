import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are a USMC TACTICAL AI COMMANDER. Map: ${mapSize}x${mapSize}.
  
  DOCTRINE: "FIRE AND MANEUVER"
  
  1. 📉 SUPPRESSION LOGIC:
     - If a teammate is "SUPPRESSED" (taking fire), they cannot aim well.
     - ACTION: Another unit MUST fire at the enemy to suppress THEM back (Cover Fire).
     - The suppressed unit should RETREAT or HOLD COVER.
  
  2. 🧱 BOUNDING OVERWATCH:
     - NEVER move everyone at once.
     - Split squad into "Base of Fire" (Stationary, shooting) and "Maneuver Element" (Moving).
     - SNIPER/LEADER: Hold angles (Overwatch).
     - ASSAULT: Move to flank while others shoot.
  
  3. ⚠️ ENGAGEMENT CONTROL:
     - Outnumbered? RETREAT.
     - Enemy in strong cover? FLANK (Do not shoot wall).
     - Enemy in open? FOCUS FIRE.
  
  OUTPUT FORMAT:
  - "thought": Tactical callout (e.g. "Covering Fire!", "Bounding Forward!", "Pinned Down!").
  - "type": "MOVE" (Shooting is automatic by reflex engine, you manage positioning).
  - Coordinates: Integers.
  
  Example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": {"x": 5, "y": 10}, "thought": "Bounding to cover" },
      { "unitId": "b2", "type": "MOVE", "target": {"x": 5, "y": 5}, "thought": "Holding Overwatch" } // Moves slightly or stays
    ]
  }
  `;

  const promptData = units.map((u: any) => ({
    id: u.id, 
    team: u.team, 
    role: u.role, 
    pos: u.pos || {x: u.x, y: u.y}, 
    hp: u.hp, 
    suppression: u.suppression || 0, // 告诉 AI 谁被打得抬不起头
    isSuppressed: (u.suppression || 0) > 50
  }));

  const simplifiedObstacles = obstacles.map((o:any) => ({ 
    type: "COVER", x: Math.round(o.x + o.w/2), y: Math.round(o.y + o.h/2) 
  }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    cover_locations: simplifiedObstacles.slice(0, 6) 
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