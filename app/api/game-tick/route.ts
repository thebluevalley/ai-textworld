import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units } = await req.json();

  // 1. 构建战术 Prompt (Dungeon Master 模式)
  const systemPrompt = `You are the AI Engine for a Turn-Based Tactical RPG (like XCOM).
  Control TWO squads: BLUE TEAM vs RED TEAM.
  
  Map: 20x20 Grid.
  Roles: 
  - LEADER: Balanced, close-range.
  - SNIPER: Long range, high dmg, low hp.
  - ASSAULT: Avg range, tanky.
  
  OBJECTIVE: Eliminate the opposing team.
  
  INSTRUCTIONS:
  1. Analyze positions.
  2. Decide actions for each living unit.
  3. Actions can be: "MOVE" or "ATTACK".
  4. If Enemy is within range (Sniper: 8, Leader: 4, Assault: 3), PREFER ATTACK.
  5. Calculate DAMAGE based on role (Sniper ~40, Leader ~20, Assault ~15). Randomize slightly.
  
  Output JSON format ONLY:
  {
    "actions": [
      { 
        "unitId": "b1", 
        "team": "BLUE",
        "type": "MOVE", 
        "target": { "x": 10, "y": 10 }, 
        "thought": "Taking cover" 
      },
      { 
        "unitId": "r1", 
        "team": "RED",
        "type": "ATTACK", 
        "targetUnitId": "b1", 
        "damage": 25,
        "thought": "Suppressing fire!" 
      }
    ]
  }
  
  Language: English (for tactical logs). Keep thoughts short and military-style.
  `;

  // 简化输入，只传必要信息
  const userPrompt = JSON.stringify({
    units: units.map((u: any) => ({ 
      id: u.id, 
      team: u.team, 
      role: u.role, 
      x: Math.round(u.x), 
      y: Math.round(u.y), 
      hp: u.hp 
    }))
  });

  // 2. 调用 AI
  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex', // 依然用快模型，反应更灵敏
    systemPrompt,
    userPrompt
  });

  if (!result || !result.actions) {
    return NextResponse.json({ actions: [] });
  }

  return NextResponse.json(result);
}