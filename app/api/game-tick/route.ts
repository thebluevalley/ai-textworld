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

  // === 🛠️ 修复：坐标数据健壮性处理 ===
  // 无论前端发来的是扁平结构 (x,y) 还是嵌套结构 (pos.x, pos.y)，这里都能兼容
  const promptData = units.map((u: any) => {
    // 强制获取自身坐标
    const myPos = u.pos || { x: u.x, y: u.y };

    // 处理可见敌人列表
    const processedEnemies = (u.visibleEnemies || []).map((e: any) => {
      // 强制获取敌人坐标 (兼容 e.pos 或 e.x/e.y)
      const ePos = e.pos || { x: e.x || 0, y: e.y || 0 };
      
      // 安全计算距离
      const dx = myPos.x - ePos.x;
      const dy = myPos.y - ePos.y;
      const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

      return { 
        id: e.id, 
        hp: e.hp, 
        dist: dist 
      };
    });

    return {
      id: u.id, 
      team: u.team, 
      pos: myPos, // 修正后的坐标对象
      hp: u.hp, 
      role: u.role,
      visibleEnemies: processedEnemies
    };
  });

  // 简化障碍物数据 (只发中心点，省 Token)
  const simplifiedObstacles = obstacles.map((o:any) => ({ 
    type: "COVER", x: Math.round(o.x + o.w/2), y: Math.round(o.y + o.h/2) 
  }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    nearby_cover: simplifiedObstacles.slice(0, 6) 
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