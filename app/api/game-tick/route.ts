import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

// Fisher-Yates 洗牌算法
function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const generateSystemPrompt = (team: string, mapSize: number) => {
  const isBlue = team === 'BLUE';
  
  const doctrine = isBlue 
    ? `DOCTRINE: "SPECIAL FORCES". Precision. Minimum exposure. Focus fire on high-threat targets (Snipers/Heavies).`
    : `DOCTRINE: "GUERRILLA WARFARE". Chaos. Ambush. Rush isolated enemies. Use suppression to pin, then flank.`;

  return `You are an ELITE AI COMMANDER for the ${team} TEAM. Map: ${mapSize}x${mapSize}.
  Opponent: ${isBlue ? 'RED' : 'BLUE'} Team.
  
  ${doctrine}
  
  🔴 **CRITICAL THINKING PROCESS (OODA LOOP)**:
  Before generating JSON, you MUST think in this format:
  
  1. **OBSERVE (SITREP)**: 
     - Who is suppressed? Who is low HP?
     - Where are the visible enemies?
  2. **ORIENT (ANALYSIS)**:
     - Is it safe to move? 
     - IF under fire -> RETREAT or SUPPRESS back.
     - IF enemy is behind wall -> FLANK (Do not shoot wall).
     - IF outnumbered -> FALL BACK to cover.
  3. **DECIDE (EXECUTION)**:
     - Assign specific tactics (RUSH, SUPPRESS, COVER_FIRE) to specific units.
  
  ---
  
  **TACTICAL RULES:**
  - **SUPPRESSION**: Use HEAVY/ASSAULT to suppress enemies. Suppressed enemies have low accuracy.
  - **FLANKING**: Use ASSAULT/LEADER to move AROUND cover to get Line of Sight.
  - **SURVIVAL**: If HP < 400, unit MUST retreat or hide.
  
  **JSON OUTPUT FORMAT:**
  Return ONLY the JSON object at the end.
  {
    "actions": [
      { "unitId": "...", "type": "MOVE", "target": {"x":.., "y":..}, "tactic": "SUPPRESS", "thought": "Brief tactical reason" }
    ]
  }
  `;
};

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  // === 数据预处理 ===
  const blueUnits = units.filter((u:any) => u.team === 'BLUE');
  const redUnits = units.filter((u:any) => u.team === 'RED');

  // 计算视野 (战争迷雾)
  const blueVisibleEnemies = new Set<string>();
  blueUnits.forEach((u:any) => u.visibleEnemies?.forEach((e:any) => blueVisibleEnemies.add(e.id)));
  const redExposedToBlue = redUnits.filter((r:any) => blueVisibleEnemies.has(r.id)).map((r:any) => ({
    id: r.id, pos: r.pos, hp: r.hp, role: r.role, suppression: r.suppression // 知道敌人的压制状态
  }));

  const redVisibleEnemies = new Set<string>();
  redUnits.forEach((u:any) => u.visibleEnemies?.forEach((e:any) => redVisibleEnemies.add(e.id)));
  const blueExposedToRed = blueUnits.filter((b:any) => redVisibleEnemies.has(b.id)).map((b:any) => ({
    id: b.id, pos: b.pos, hp: b.hp, role: b.role, suppression: b.suppression
  }));

  const coverPoints = obstacles.map((o:any) => ({ x: Math.round(o.x+o.w/2), y: Math.round(o.y+o.h/2) })).slice(0,8);

  // === 并行双脑思考 ===
  
  // Blue Brain
  const blueRequest = AIDispatcher.chatCompletion({
    team: 'BLUE',
    systemPrompt: generateSystemPrompt('BLUE', mapSize),
    userPrompt: JSON.stringify({
      my_squad: shuffleArray([...blueUnits]).map((u:any) => ({ 
        id:u.id, role:u.role, pos:u.pos, hp:u.hp, suppression:u.suppression, 
        status: u.hp < 400 ? 'CRITICAL' : 'OK' // 显式告诉 AI 状态
      })),
      known_hostiles: redExposedToBlue,
      nearby_cover: coverPoints
    })
  });

  // Red Brain
  const redRequest = AIDispatcher.chatCompletion({
    team: 'RED',
    systemPrompt: generateSystemPrompt('RED', mapSize),
    userPrompt: JSON.stringify({
      my_squad: shuffleArray([...redUnits]).map((u:any) => ({ 
        id:u.id, role:u.role, pos:u.pos, hp:u.hp, suppression:u.suppression,
        status: u.hp < 400 ? 'CRITICAL' : 'OK'
      })),
      known_hostiles: blueExposedToRed,
      nearby_cover: coverPoints
    })
  });

  const [blueResult, redResult] = await Promise.all([blueRequest, redRequest]);

  // === 结果处理 ===
  const combinedActions: any[] = [];
  let has429 = false;

  if (blueResult?.error === 429 || redResult?.error === 429) has429 = true;

  if (blueResult?.actions) combinedActions.push(...blueResult.actions);
  if (redResult?.actions) combinedActions.push(...redResult.actions);

  // 调试日志：看看 AI 到底想了什么 (Vercel 后台可见)
  // console.log("Blue Thought Process:", blueResult?._raw_thought); 

  if (has429) return NextResponse.json({ actions: combinedActions }, { status: 429 });

  return NextResponse.json({ actions: combinedActions });
}