import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  const systemPrompt = `You are a PRO GAMER AI playing a deathmatch.
  Map: ${mapSize}x${mapSize}.
  
  OBJECTIVE: ELIMINATE ENEMY TEAM.
  
  STRATEGY RULES (HUMAN-LIKE BEHAVIOR):
  1. 🔫 IF ENEMY VISIBLE: SHOOT! Do not move. Shooting is free. Moving risks exposure.
  2. 🛡️ IF UNDER FIRE: Move to nearest OBSTACLE (Wall) for cover.
  3. 🏃 IF NO ENEMY: 
     - ASSAULT: Rush to map center (15,15).
     - SNIPER: Move to corners or long hallways.
     - LEADER: Flank around the edges.
  
  CRITICAL:
  - You control BOTH Blue and Red teams.
  - RED TEAM MUST BE AGGRESSIVE.
  - Output coordinates must be Integers.
  
  Format:
  { "actions": [{ "unitId": "b1", "type": "ATTACK", "targetUnitId": "r1", "damage": 50, "thought": "Gotcha!" }] }
  `;

  // 精简数据
  const promptData = units.map((u: any) => ({
    id: u.id, team: u.team, pos: u.pos, hp: u.hp, role: u.role,
    // 只有当有敌人可见时才发 enemy 列表
    visibleEnemies: u.visibleEnemies.map((e:any) => ({ id: e.id, hp: e.hp, pos: e.pos }))
  }));

  // 把障碍物概略告诉 AI (只发前5个大的，省token)
  const mainCover = obstacles.slice(0, 5).map((o:any) => ({ x: o.x, y: o.y }));

  const userPrompt = JSON.stringify({
    units_status: promptData,
    cover_locations: mainCover
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