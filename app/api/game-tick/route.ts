import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are a VETERAN SQUAD LEADER. Map: ${mapSize}x${mapSize}.
  
  CRITICAL RULES (LOGIC & PHYSICS):
  1. 🧱 NO WALL-HACKS: Bullets CANNOT pass through walls. If target is behind a wall, you MUST FLANK (move around). Do not shoot the wall.
  2. 🚑 SURVIVAL FIRST: 
     - If HP < 350: STOP ATTACKING. RUN to cover immediately. Call for Medic.
     - THOUGHT: "Hit hard! Falling back!", "Need Medic!", "Taking Cover!"
  
  SQUAD ROLES & TACTICS:
  - 🛡️ HEAVY (New): High suppression. Find a choke point and spray. 
  - ⚔️ ASSAULT: Flank around obstacles. Close distance.
  - 🔭 SNIPER: Stay far back. Watch long corridors.
  - ➕ MEDIC: Stay safe. Move to wounded allies (HP<500).
  
  DECISION TREE:
  1. Is anyone Critically Wounded (<300 HP)? -> Medic MOVE to them. Wounded unit MOVE to Medic/Cover.
  2. Is Enemy in Line of Sight? -> ATTACK.
  3. Is Enemy behind wall? -> FLANK (Move to side).
  
  Example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": {"x": 8, "y": 12}, "thought": "Flanking left" },
      { "unitId": "r_heavy", "type": "MOVE", "target": {"x": 25, "y": 25}, "thought": "Setting up MG" }
    ]
  }
  `;

  const promptData = units.map((u: any) => ({
    id: u.id, 
    team: u.team, 
    role: u.role,
    pos: u.pos || {x: u.x, y: u.y}, 
    hp: u.hp, 
    // 告诉 AI 是否安全（旁边有没有掩体）
    nearCover: obstacles.some((o:any) => Math.abs(u.pos.x - o.x) < 2 && Math.abs(u.pos.y - o.y) < 2)
  }));

  const simplifiedObstacles = obstacles.map((o:any) => ({ 
    x: Math.round(o.x + o.w/2), y: Math.round(o.y + o.h/2) 
  }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    obstacles_center: simplifiedObstacles.slice(0, 5)
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