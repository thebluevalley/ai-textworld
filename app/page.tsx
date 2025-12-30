'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, RefreshCw, Eye, EyeOff, ShieldAlert } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const TICK_RATE = 4000; // 4秒一回合，留给AI思考和物理计算
const MOVE_SPEED = 0.03; 

// === 🧱 复杂战术地图 (CQB 迷宫) ===
const OBSTACLES = [
  // 中央堡垒
  { x: 9, y: 9, w: 2, h: 2 },
  // 左侧掩体群
  { x: 4, y: 4, w: 1, h: 6 },
  { x: 4, y: 12, w: 4, h: 1 },
  // 右侧掩体群
  { x: 15, y: 4, w: 1, h: 6 },
  { x: 12, y: 15, w: 4, h: 1 },
  // 顶部横墙
  { x: 8, y: 2, w: 4, h: 1 },
  // 底部横墙
  { x: 8, y: 17, w: 4, h: 1 },
];

const INITIAL_UNITS = [
  // 蓝队 (左下出生)
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 2, y: 18, hp: 1000, maxHp: 1000, status: 'ALIVE' },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 1, y: 15, hp: 600, maxHp: 600, status: 'ALIVE' },
  { id: 'b3', team: 'BLUE', role: 'MEDIC', x: 3, y: 18, hp: 800, maxHp: 800, status: 'ALIVE' },
  // 红队 (右上出生)
  { id: 'r1', team: 'RED', role: 'LEADER', x: 18, y: 2, hp: 1000, maxHp: 1000, status: 'ALIVE' },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 19, y: 5, hp: 600, maxHp: 600, status: 'ALIVE' },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 16, y: 2, hp: 900, maxHp: 900, status: 'ALIVE' },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [attacks, setAttacks] = useState<any[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]); 

  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  
  // === 📐 物理引擎核心 ===
  
  // 1. 简单的线段与矩形相交检测 (Raycasting)
  const lineIntersectsRect = (p1: any, p2: any, rect: any) => {
    // 简化的 AABB 碰撞检测 (足够用于本游戏)
    // 检查线段是否穿过矩形区域
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    // 如果矩形完全在线段的包围盒之外，肯定不相交
    if (rect.x > maxX || rect.x + rect.w < minX || rect.y > maxY || rect.y + rect.h < minY) {
      return false;
    }
    
    // 更精确的检测：检查线段是否穿过矩形内部
    // 这里用一种简化的采样法：在线段上取 10 个点，看有没有点在矩形内
    // (比完全几何计算省性能，且效果足够)
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = p1.x + (p2.x - p1.x) * t;
      const py = p1.y + (p2.y - p1.y) * t;
      if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
        return true; // 撞墙了
      }
    }
    return false;
  };

  // 2. 视线检测 (Line of Sight)
  const checkLineOfSight = (u1: any, u2: any) => {
    for (const obs of OBSTACLES) {
      if (lineIntersectsRect(u1, u2, obs)) {
        return false; // 视线被阻挡
      }
    }
    return true; // 可见
  };

  // 3. 碰撞检测 (防止穿墙)
  const isColliding = (x: number, y: number) => {
    // 简单的点与矩形碰撞
    for (const obs of OBSTACLES) {
      // 稍微留一点 margin (0.2)，避免贴图重叠
      if (x > obs.x - 0.2 && x < obs.x + obs.w + 0.2 && y > obs.y - 0.2 && y < obs.y + obs.h + 0.2) {
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    units.forEach(u => targetsRef.current[u.id] = { x: u.x, y: u.y });
  }, []);

  // === AI 循环 ===
  useEffect(() => {
    if (!isPlaying) return;

    const tick = async () => {
      try {
        // === 🛡️ 战争迷雾预处理 ===
        // 计算每个单位“看得到”的敌人
        const activeUnits = units.filter(u => u.status === 'ALIVE').map(u => {
          const visibleEnemies = units
            .filter(other => other.team !== u.team && other.status === 'ALIVE')
            .filter(other => checkLineOfSight(u, other)) // 关键：物理检测
            .map(other => ({ id: other.id, pos: {x: other.x, y: other.y}, hp: other.hp, role: other.role }));

          return {
            ...u,
            visibleEnemies: visibleEnemies // 告诉 AI 只能打这些人
          };
        });

        const res = await fetch('/api/game-tick', {
          method: 'POST',
          body: JSON.stringify({ units: activeUnits, obstacles: OBSTACLES })
        });

        if (!res.ok) return;

        const data = await res.json();
        
        if (data.actions) {
          const currentTickAttacks: any[] = [];
          const newTexts: any[] = [];
          const newLogs: any[] = [];
          
          data.actions.forEach((a: any) => {
            // MOVE
            if (a.type === 'MOVE' && a.target) {
              targetsRef.current[a.unitId] = { 
                x: Math.max(1, Math.min(19, a.target.x)), 
                y: Math.max(1, Math.min(19, a.target.y))
              };
            }
            
            // ATTACK (加入 LoS 校验，防止 AI 穿墙作弊)
            if (a.type === 'ATTACK' && a.targetUnitId) {
              const attacker = units.find(u => u.id === a.unitId);
              const target = units.find(u => u.id === a.targetUnitId);
              
              if (attacker && target && target.hp > 0) {
                // 双重校验：前端再次确认是否有视线
                const hasLoS = checkLineOfSight(attacker, target);
                
                if (!hasLoS) {
                  // 如果 AI 强行穿墙射击，判定为无效，显示 "BLOCKED"
                  newTexts.push({
                    x: attacker.x, y: attacker.y - 1, text: "NO LOS", color: "#888888", id: Date.now() + Math.random()
                  });
                  return;
                }

                const isHit = Math.random() > 0.15;
                currentTickAttacks.push({
                  from: { x: attacker.x, y: attacker.y },
                  to: { x: target.x, y: target.y },
                  color: attacker.team === 'BLUE' ? 0x60a5fa : 0xf87171,
                  isMiss: !isHit,
                  timestamp: Date.now()
                });

                if (isHit) {
                  const dmg = a.damage || 30;
                  newTexts.push({
                    x: target.x, y: target.y, text: `-${dmg}`, color: "#ffffff", id: Date.now() + Math.random()
                  });
                  setUnits(prev => prev.map(u => {
                    if (u.id === target.id) {
                      const newHp = Math.max(0, u.hp - dmg);
                      return { ...u, hp: newHp, status: newHp <= 0 ? 'DEAD' : 'ALIVE' };
                    }
                    return u;
                  }));
                  newLogs.push({ text: `${attacker.id} hit ${target.id}`, team: attacker.team });
                } else {
                  newTexts.push({ x: target.x, y: target.y, text: "MISS", color: "#fbbf24", id: Date.now() + Math.random() });
                }
              }
            }
            
            // HEAL (必须在旁边)
            if (a.type === 'HEAL' && a.targetUnitId) {
               const healer = units.find(u => u.id === a.unitId);
               const target = units.find(u => u.id === a.targetUnitId);
               if (healer && target) {
                 // 检查距离
                 const dist = Math.sqrt(Math.pow(healer.x - target.x, 2) + Math.pow(healer.y - target.y, 2));
                 if (dist > 3) {
                    newTexts.push({ x: healer.x, y: healer.y, text: "TOO FAR", color: "#888", id: Date.now() + Math.random() });
                 } else {
                    const healAmount = 80;
                    newTexts.push({ x: target.x, y: target.y, text: `+${healAmount}`, color: "#22c55e", id: Date.now() + Math.random() });
                    setUnits(prev => prev.map(u => {
                        if (u.id === target.id) return { ...u, hp: Math.min(u.maxHp, u.hp + healAmount) };
                        return u;
                    }));
                 }
               }
            }
          });

          setLogs(prev => [...newLogs, ...prev].slice(0, 8));
          setAttacks(currentTickAttacks);
          setFloatingTexts(prev => [...prev, ...newTexts]);
        }
      } catch (e) {
        console.error("Tick err", e);
      }
    };

    tick();
    const interval = setInterval(tick, TICK_RATE);
    return () => clearInterval(interval);
  }, [isPlaying, units]);

  // === 🎥 物理动画循环 ===
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setUnits(prevUnits => {
        return prevUnits.map(u => {
          if (u.status === 'DEAD') return u;
          const target = targetsRef.current[u.id];
          if (!target) return u;
          
          const dx = target.x - u.x;
          const dy = target.y - u.y;
          
          // 如果非常接近，直接归位
          if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
             return { ...u, x: target.x, y: target.y };
          }

          // 计算下一步位置
          const nextX = u.x + dx * MOVE_SPEED;
          const nextY = u.y + dy * MOVE_SPEED;

          // === 🛡️ 碰撞检测：如果下一步撞墙，就不动 ===
          // 这会产生一种自然的“滑墙”或“堵住”的效果
          // 如果 X 轴撞墙，只更新 Y；如果 Y 轴撞墙，只更新 X
          let newX = u.x;
          let newY = u.y;

          if (!isColliding(nextX, u.y)) newX = nextX;
          if (!isColliding(u.x, nextY)) newY = nextY;
          
          // 如果两个方向都撞了（死角），就原地不动
          if (isColliding(nextX, nextY) && newX === u.x && newY === u.y) {
             return u; 
          }

          return { ...u, x: newX, y: newY };
        });
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    if (isPlaying) animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  const resetGame = () => {
    setIsPlaying(false);
    setUnits(INITIAL_UNITS);
    setLogs([]);
    setAttacks([]);
    setFloatingTexts([]);
    INITIAL_UNITS.forEach(u => targetsRef.current[u.id] = {x: u.x, y: u.y});
  };

  return (
    <main className="h-screen w-full bg-[#050505] text-slate-300 font-sans flex overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-14 bg-[#111] border-b border-[#333] z-20 flex items-center justify-between px-6">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldAlert className="text-orange-500" />
          CQB TACTICS <span className="text-[10px] bg-slate-800 px-2 rounded text-slate-400">PHYSICS ENABLED</span>
        </h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-6 py-1.5 font-bold rounded flex items-center gap-2 ${
              isPlaying ? 'bg-slate-700 text-white' : 'bg-orange-700 text-white'
            }`}
          >
            {isPlaying ? <Pause size={14}/> : <Play size={14}/>}
            {isPlaying ? "PAUSE" : "BREACH & CLEAR"}
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-[#0a0a0a] pt-14">
        <div className="border border-slate-700/50 shadow-2xl relative">
           <TacticalViewport units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} />
        </div>
        
        <div className="absolute bottom-4 left-4 w-80 bg-black/80 p-3 rounded border border-white/10 pointer-events-none">
           <div className="text-[10px] text-gray-500 mb-2 flex gap-2">
             <Eye size={12}/> LINE OF SIGHT CHECK ACTIVE
           </div>
           <div className="space-y-1">
             {logs.map((log, i) => (
               <div key={i} className={`text-[10px] flex justify-between ${log.team === 'BLUE' ? 'text-blue-300' : 'text-red-300'}`}>
                 <span>{log.text}</span>
               </div>
             ))}
           </div>
        </div>
      </div>
    </main>
  );
}