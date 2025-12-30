import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  // === 🧠 情报融合层 (Intel Fusion Layer) ===
  // 计算每个队伍的“共享视野”
  const blueIntel = new Set();
  const redIntel = new Set();

  // 第一遍遍历：收集情报
  units.forEach((u: any) => {
    if (u.visibleEnemies) {
      u.visibleEnemies.forEach((e: any) => {
        const enemyInfo = `Enemy ${e.role} at [${e.pos.x},${e.pos.y}] (HP:${e.hp})`;
        if (u.team === 'BLUE') blueIntel.add(enemyInfo);
        if (u.team === 'RED') redIntel.add(enemyInfo);
      });
    }
  });

  const systemPrompt = `You are a SQUAD COMMANDER AI. Map: ${mapSize}x${mapSize}.
  
  CORE MECHANIC: **HIVE MIND INTELLIGENCE**
  - All units share vision. If Unit A sees an enemy, Unit B knows its location too.
  - Use this to coordinate attacks even if units are separated.
  
  TACTICAL DOCTRINE:
  1. 📡 SHARED VISION: 
     - If a teammate spots an enemy, other units must MOVE to engage or flank that target.
     - Do not wander aimlessly if a target is known.
  
  2. 🤝 COORDINATION:
     - **FOCUS FIRE:** If multiple units can reach a target, attack the SAME target to kill it faster.
     - **SUPPORT:** If a unit is low HP, nearby allies should move in front to tank damage (Body Block).
  
  3. ⚔️ ROLES:
     - SNIPER: Move to a line-of-sight that covers the "Known Enemy Locations".
     - ASSAULT: Rush the "Known Enemy Locations" via flank routes.
  
  OUTPUT FORMAT:
  - "thought": Team-based reasoning (e.g., "Moving to support B1", "Flanking spotted sniper").
  
  Example:
  {
    "actions": [
      { "unitId": "b2", "type": "MOVE", "target": {"x": 10, "y": 10}, "thought": "Responding to B1's ping" }
    ]
  }
  `;

  const promptData = units.map((u: any) => {
    const myPos = u.pos || { x: u.x, y: u.y };
    // 注入团队情报：即使我自己没看见，如果队友看见了，我也能知道
    const teamKnowledge = u.team === 'BLUE' ? Array.from(blueIntel) : Array.from(redIntel);
    
    return {
      id: u.id, 
      team: u.team, 
      pos: myPos, 
      hp: u.hp, 
      role: u.role,
      // 告诉 AI：我自己看见了谁
      myVision: u.visibleEnemies.map((e:any) => e.id),
      // 告诉 AI：我们全队都知道谁在哪 (这是关键！)
      squadIntel: teamKnowledge 
    };
  });

  const simplifiedObstacles = obstacles.map((o:any) => ({ 
    type: "WALL", x: Math.round(o.x + o.w/2), y: Math.round(o.y + o.h/2) 
  }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    key_locations: simplifiedObstacles.slice(0, 6) 
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