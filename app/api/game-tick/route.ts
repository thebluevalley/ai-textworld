import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are a Grand Strategy AI. Map Size: ${mapSize}x${mapSize}.
  Output RAW JSON only. Coordinates: { "x": 10, "y": 20 }.
  
  TACTICS:
  - Advance towards map center or enemies.
  - Snipers (Range 35) use long lines of sight.
  - Avoid obstacles.
  
  Example: { "actions": [{ "unitId": "b1", "type": "MOVE", "target": {"x":25,"y":25}, "thought": "Advance" }] }
  `;

  // 精简数据，减少 Token 消耗，降低 API 压力
  const promptData = units.map((u: any) => ({
    id: u.id, team: u.team, pos: u.pos, hp: u.hp, role: u.role,
    // 只有当有敌人可见时才发 enemy 列表，否则发空，省流
    visibleEnemies: u.visibleEnemies.length > 0 ? u.visibleEnemies : undefined
  }));

  const userPrompt = JSON.stringify({
    squad: promptData,
    // 障碍物列表只发一次或简化发送，这里为了效果还是发全，但前端已做限流
  });

  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex',
    systemPrompt,
    userPrompt
  });

  // 透传 429
  if (result && result.error === 429) {
    return NextResponse.json({ actions: [] }, { status: 429 });
  }

  if (!result || !result.actions) {
    return NextResponse.json({ actions: [] });
  }

  return NextResponse.json(result);
}