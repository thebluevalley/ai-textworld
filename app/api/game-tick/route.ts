import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles } = await req.json();

  // 1. 构建战术 Prompt
  // 关键修改：加强了对 JSON 格式的强制要求，禁止废话
  const systemPrompt = `You are a Tactical AI Engine.
  Map: 20x20 Grid.
  
  IMPORTANT: Output RAW JSON only. DO NOT add any markdown formatting, explanations, or notes.
  I will parse your response programmatically, so any extra text will crash the system.
  
  OBSTACLES: There are walls/cover on the map. 
  Units should Move BEHIND cover to avoid damage.
  
  Game Rules:
  - High HP System (Units have ~500 HP).
  - Damage should be low (20-40 per hit) to allow long battles.
  - Roles: LEADER (Balanced), SNIPER (Long range), MEDIC (Can HEAL teammates).
  
  Instructions:
  1. Analyze positions relative to obstacles.
  2. If unit is low HP, retreat or find Medic.
  3. Medic should use "HEAL" action type if ally is close (range 3).
  4. Attack damage: 20-50 (Randomize).
  
  Output JSON format example:
  {
    "actions": [
      { "unitId": "b1", "type": "MOVE", "target": { "x": 5, "y": 6 }, "thought": "Moving to cover" },
      { "unitId": "r1", "type": "ATTACK", "targetUnitId": "b1", "damage": 35, "thought": "Target locked" }
    ]
  }
  `;

  // 简化输入，加入障碍物信息
  const userPrompt = JSON.stringify({
    livingUnits: units.map((u: any) => ({ 
      id: u.id, 
      team: u.team, 
      role: u.role, 
      pos: [Math.round(u.x), Math.round(u.y)], 
      hp: u.hp 
    })),
    obstacles: obstacles
  });

  // 2. 调用 AI
  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex',
    systemPrompt,
    userPrompt
  });

  if (!result || !result.actions) {
    // 如果解析失败，返回空数组，避免前端崩溃
    return NextResponse.json({ actions: [] });
  }

  return NextResponse.json(result);
}