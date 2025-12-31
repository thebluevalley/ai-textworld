import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

// 基础 Prompt 生成器
const generateSystemPrompt = (team: string, mapSize: number) => {
  const isBlue = team === 'BLUE';
  
  // 🎭 赋予不同的战术性格
  const personality = isBlue 
    ? `TACTIC: "PRECISION & CONTROL". Use bounding overwatch. Prioritize survival.` // 蓝队：特警风格，稳健
    : `TACTIC: "AGGRESSION & CHAOS". Flank hard. Rush solitary enemies. Overwhelm them.`; // 红队：悍匪风格，激进

  return `You are the COMMANDER of the ${team} TEAM. Map: ${mapSize}x${mapSize}.
  You are fighting against the ${isBlue ? 'RED' : 'BLUE'} Team.
  
  ${personality}
  
  CRITICAL RULES:
  1. You only control units with team="${team}".
  2. You can ONLY see enemies in the "visible_hostiles" list.
  3. If "visible_hostiles" is empty -> SEARCH. Move to map center or cover points.
  4. If HP < 300 -> RETREAT to cover.
  
  SQUAD ROLES:
  - HEAVY: Suppress known enemy locations.
  - SNIPER: Hold long angles.
  - ASSAULT/LEADER: Flank.
  
  Output Example:
  {
    "actions": [
      { "unitId": "${isBlue?'b1':'r1'}", "type": "MOVE", "target": {"x":10,"y":10}, "tactic": "RUSH", "thought": "Flanking!" }
    ]
  }
  `;
};

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  // === 1. 数据拆分 (构建战争迷雾) ===
  const blueUnits = units.filter((u:any) => u.team === 'BLUE');
  const redUnits = units.filter((u:any) => u.team === 'RED');

  // 计算蓝队视野 (蓝队能看到谁？)
  const blueVisibleEnemies = new Set<string>();
  blueUnits.forEach((u:any) => u.visibleEnemies?.forEach((e:any) => blueVisibleEnemies.add(e.id)));
  const redExposedToBlue = redUnits.filter((r:any) => blueVisibleEnemies.has(r.id)).map((r:any) => ({
    id: r.id, pos: r.pos, hp: r.hp, role: r.role // 蓝队只能拿到红队这部分信息
  }));

  // 计算红队视野 (红队能看到谁？)
  const redVisibleEnemies = new Set<string>();
  redUnits.forEach((u:any) => u.visibleEnemies?.forEach((e:any) => redVisibleEnemies.add(e.id)));
  const blueExposedToRed = blueUnits.filter((b:any) => redVisibleEnemies.has(b.id)).map((b:any) => ({
    id: b.id, pos: b.pos, hp: b.hp, role: b.role // 红队只能拿到蓝队这部分信息
  }));

  // 障碍物简化
  const coverPoints = obstacles.map((o:any) => ({ x: Math.round(o.x+o.w/2), y: Math.round(o.y+o.h/2) })).slice(0,6);

  // === 2. 并行请求双大脑 ===
  
  // 🔵 Blue Brain Request
  const blueRequest = AIDispatcher.chatCompletion({
    team: 'BLUE',
    systemPrompt: generateSystemPrompt('BLUE', mapSize),
    userPrompt: JSON.stringify({
      my_squad: blueUnits.map((u:any) => ({ id:u.id, role:u.role, pos:u.pos, hp:u.hp, tactic:u.tactic })),
      visible_hostiles: redExposedToBlue, // 只给看得到的
      cover_points: coverPoints
    })
  });

  // 🔴 Red Brain Request
  const redRequest = AIDispatcher.chatCompletion({
    team: 'RED',
    systemPrompt: generateSystemPrompt('RED', mapSize),
    userPrompt: JSON.stringify({
      my_squad: redUnits.map((u:any) => ({ id:u.id, role:u.role, pos:u.pos, hp:u.hp, tactic:u.tactic })),
      visible_hostiles: blueExposedToRed, // 只给看得到的
      cover_points: coverPoints
    })
  });

  // 等待双核响应
  const [blueResult, redResult] = await Promise.all([blueRequest, redRequest]);

  // === 3. 结果合并 ===
  const combinedActions: any[] = [];
  let has429 = false;

  if (blueResult?.error === 429 || redResult?.error === 429) {
    has429 = true;
  }

  if (blueResult?.actions) combinedActions.push(...blueResult.actions);
  if (redResult?.actions) combinedActions.push(...redResult.actions);

  if (has429) {
    return NextResponse.json({ actions: combinedActions }, { status: 429 });
  }

  return NextResponse.json({ actions: combinedActions });
}