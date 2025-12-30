import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, obstacles, mapSize } = await req.json();

  // 1. 战术分组 (Fire Teams)
  // Alpha: 灵活机动 (Leader, Medic, Assault 1)
  // Bravo: 重火力压制 (Heavy, Sniper)
  const alphaIds = units.filter((u:any) => ['LEADER', 'MEDIC', 'ASSAULT'].includes(u.role)).map((u:any) => u.id);
  const bravoIds = units.filter((u:any) => ['HEAVY', 'SNIPER'].includes(u.role)).map((u:any) => u.id);

  const systemPrompt = `You are a MILITARY TACTICAL AI (USMC Doctrine). Map: ${mapSize}x${mapSize}.
  
  ORGANIZATION:
  - **Team Alpha (Maneuver):** Leader, Medic, Assault. (Fast, Flanking, CQB)
  - **Team Bravo (Base of Fire):** Heavy, Sniper. (Suppression, Overwatch)
  
  TACTICAL DOCTRINE (Choose one per turn):
  1. 🏃 **BOUNDING OVERWATCH (Advance):**
     - Bravo STOPS and uses "SUPPRESS" tactic on enemies.
     - Alpha uses "RUSH" tactic to move to next cover.
  2. 🛡️ **PEELING (Retreat):**
     - If Squad HP < 40%, Low HP units "RETREAT".
     - High HP units "COVER_FIRE" to pin enemies down.
  3. 🚑 **CASEVAC (Rescue):**
     - If unit Critical (<300 HP): Medic uses "RESCUE".
     - Heavy/Sniper MUST use "SUPPRESS" on nearest enemy to cover the Medic.
  4. ⚔️ **LSH (Linear Ambush):**
     - If enemies in open: All units "FOCUS_FIRE".
  
  AVAILABLE TACTICS (Output in 'tactic' field):
  - "RUSH": Double move speed, NO shooting (Sprinting).
  - "SUPPRESS": Zero movement, Double fire rate, Lower accuracy (Pinning enemy).
  - "COVER_FIRE": Normal move, Normal shoot.
  - "RETREAT": Move away from enemy, reduced shooting.
  - "RESCUE": Medic only. Move to low HP ally.
  
  Output Example:
  {
    "actions": [
      { "unitId": "b_heavy", "type": "MOVE", "target": {"x": 5, "y": 5}, "tactic": "SUPPRESS", "thought": "Laying hate!" },
      { "unitId": "b_leader", "type": "MOVE", "target": {"x": 10, "y": 10}, "tactic": "RUSH", "thought": "Bounding forward!" }
    ]
  }
  `;

  // 数据预处理
  const promptData = units.map((u: any) => ({
    id: u.id, team: u.team, role: u.role, pos: u.pos || {x: u.x, y: u.y}, hp: u.hp, 
    isSuppressed: (u.suppression || 0) > 50,
    fireTeam: alphaIds.includes(u.id) ? 'ALPHA' : 'BRAVO'
  }));

  const simplifiedObstacles = obstacles.map((o:any) => ({ x: Math.round(o.x+o.w/2), y: Math.round(o.y+o.h/2) }));

  const userPrompt = JSON.stringify({
    squad_status: promptData,
    cover_points: simplifiedObstacles.slice(0, 6)
  });

  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex',
    systemPrompt,
    userPrompt
  });

  if (result && result.error === 429) {
    return NextResponse.json({ actions: [] }, { status: 429 });
  }

  return NextResponse.json(result || { actions: [] });
}