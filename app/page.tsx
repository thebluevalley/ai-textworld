'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, RefreshCw, Map as MapIcon, Shield, Zap } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

// === 游戏平衡性调整 ===
const API_INTERVAL = 3500; // 减慢节奏：3.5秒一回合
const MOVE_SPEED = 0.04;   // 移动变慢，看得更清楚

// === 地图障碍物 (墙壁/掩体) ===
// 简单的坐标数组，用于绘制灰色方块
const OBSTACLES = [
  { x: 5, y: 8, w: 2, h: 4 }, // 左侧掩体
  { x: 13, y: 8, w: 2, h: 4 }, // 右侧掩体
  { x: 8, y: 4, w: 4, h: 1 }, // 上方墙
  { x: 8, y: 15, w: 4, h: 1 }, // 下方墙
  { x: 9, y: 9, w: 2, h: 2 }, // 中心碉堡
];

// === 初始单位 (血量大幅提升) ===
const INITIAL_UNITS = [
  // 蓝队
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 2, y: 5, hp: 500, maxHp: 500, status: 'ALIVE' },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 1, y: 2, hp: 300, maxHp: 300, status: 'ALIVE' },
  { id: 'b3', team: 'BLUE', role: 'MEDIC', x: 2, y: 8, hp: 400, maxHp: 400, status: 'ALIVE' },
  // 红队
  { id: 'r1', team: 'RED', role: 'LEADER', x: 17, y: 14, hp: 500, maxHp: 500, status: 'ALIVE' },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 18, y: 17, hp: 300, maxHp: 300, status: 'ALIVE' },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 17, y: 11, hp: 450, maxHp: 450, status: 'ALIVE' },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  
  // 视觉特效状态
  const [attacks, setAttacks] = useState<any[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]); // 伤害飘字

  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  
  // 初始化
  useEffect(() => {
    units.forEach(u => targetsRef.current[u.id] = { x: u.x, y: u.y });
  }, []);

  // === AI 循环 ===
  useEffect(() => {
    if (!isPlaying) return;

    const tick = async () => {
      // 检查胜负
      const blueCount = units.filter(u => u.team === 'BLUE' && u.hp > 0).length;
      const redCount = units.filter(u => u.team === 'RED' && u.hp > 0).length;
      if (blueCount === 0 || redCount === 0) {
        setIsPlaying(false);
        return;
      }

      try {
        const activeUnits = units.map(u => ({
          ...u,
          x: targetsRef.current[u.id]?.x || u.x,
          y: targetsRef.current[u.id]?.y || u.y
        })).filter(u => u.status === 'ALIVE');

        const res = await fetch('/api/game-tick', {
          method: 'POST',
          body: JSON.stringify({ units: activeUnits, obstacles: OBSTACLES })
        });

        if (!res.ok) return; 
        const data = await res.json();
        
        if (data.actions) {
          const currentTickAttacks: any[] = [];
          const newTexts: any[] = [];
          
          const newLogs = data.actions.map((a: any) => {
            // 处理移动 (增加边界限制)
            if (a.type === 'MOVE' && a.target) {
               targetsRef.current[a.unitId] = { 
                x: Math.max(1, Math.min(19, a.target.x)), 
                y: Math.max(1, Math.min(19, a.target.y))
              };
              return null; // 移动不记入主日志，太吵了
            }
            
            // 处理攻击
            if (a.type === 'ATTACK' && a.targetUnitId) {
              const attacker = units.find(u => u.id === a.unitId);
              const target = units.find(u => u.id === a.targetUnitId);
              
              if (attacker && target && target.hp > 0) {
                // 1. 添加攻击线特效
                currentTickAttacks.push({
                  from: { x: attacker.x, y: attacker.y },
                  to: { x: target.x, y: target.y },
                  color: attacker.team === 'BLUE' ? 0x60a5fa : 0xf87171,
                  timestamp: Date.now()
                });

                // 2. 计算掩体闪避逻辑 (简单模拟)
                const hitChance = Math.random();
                const isHit = hitChance > 0.15; // 85% 命中率
                let finalDmg = 0;
                let hitText = "MISS";
                let textColor = "#fbbf24"; // 黄色 Miss

                if (isHit) {
                  finalDmg = a.damage || 30;
                  // 暴击逻辑
                  if (Math.random() > 0.8) {
                    finalDmg = Math.floor(finalDmg * 1.5);
                    hitText = `CRIT -${finalDmg}`;
                    textColor = "#ff00ff"; // 紫色暴击
                  } else {
                    hitText = `-${finalDmg}`;
                    textColor = "#ffffff"; // 白色普通
                  }
                }

                // 3. 添加飘字
                newTexts.push({
                  x: target.x,
                  y: target.y,
                  text: hitText,
                  color: textColor,
                  id: Date.now() + Math.random()
                });

                // 4. 扣血
                if (finalDmg > 0) {
                  setUnits(prev => prev.map(u => {
                    if (u.id === target.id) {
                      const newHp = Math.max(0, u.hp - finalDmg);
                      return { ...u, hp: newHp, status: newHp <= 0 ? 'DEAD' : 'ALIVE' };
                    }
                    return u;
                  }));
                }

                return { 
                  text: `${a.unitId} >> ${target.id} [${hitText}]`, 
                  type: 'ATTACK', 
                  team: attacker.team 
                };
              }
            }
            return null;
          }).filter(Boolean);

          setLogs(prev => [...newLogs, ...prev].slice(0, 8));
          setAttacks(currentTickAttacks);
          setFloatingTexts(prev => [...prev, ...newTexts]); // 累加飘字
        }
      } catch (e) {
        console.error("Tick err", e);
      }
    };

    tick();
    const interval = setInterval(tick, API_INTERVAL); 
    return () => clearInterval(interval);
  }, [isPlaying, units]);

  // === 动画循环 ===
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      // 更新单位位置
      setUnits(prevUnits => {
        return prevUnits.map(u => {
          if (u.status === 'DEAD') return u;
          const target = targetsRef.current[u.id];
          if (!target) return u;
          const dx = target.x - u.x;
          const dy = target.y - u.y;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { ...u, x: target.x, y: target.y };
          return { ...u, x: u.x + dx * MOVE_SPEED, y: u.y + dy * MOVE_SPEED };
        });
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    if (isPlaying) animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  return (
    <main className="h-screen w-full bg-[#111] text-slate-300 font-sans flex overflow-hidden">
      
      {/* 顶部状态栏 */}
      <div className="absolute top-0 left-0 w-full h-16 bg-[#1a1a1a]/90 backdrop-blur border-b border-[#333] z-20 flex items-center justify-between px-8">
        <h1 className="text-xl font-black italic tracking-widest text-white flex items-center gap-2">
          <Zap className="text-yellow-400" fill="currentColor"/>
          NEON TACTICS
        </h1>
        
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
             <span className="text-xs text-blue-400 font-bold">BLUE TEAM</span>
             <div className="flex gap-1">
               {units.filter(u => u.team === 'BLUE').map(u => (
                 <div key={u.id} className={`w-3 h-3 rounded-sm ${u.hp>0 ? 'bg-blue-500' : 'bg-slate-700'}`}/>
               ))}
             </div>
          </div>
          <div className="w-px h-8 bg-[#444]"/>
          <div className="flex flex-col items-start">
             <span className="text-xs text-red-400 font-bold">RED TEAM</span>
             <div className="flex gap-1">
               {units.filter(u => u.team === 'RED').map(u => (
                 <div key={u.id} className={`w-3 h-3 rounded-sm ${u.hp>0 ? 'bg-red-500' : 'bg-slate-700'}`}/>
               ))}
             </div>
          </div>
        </div>

        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-8 py-2 font-bold rounded shadow-lg transition-transform active:scale-95 ${
            isPlaying ? 'bg-slate-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {isPlaying ? <span className="flex items-center gap-2"><Pause size={16}/> PAUSE</span> : <span className="flex items-center gap-2"><Play size={16}/> START BATTLE</span>}
        </button>
      </div>

      {/* 游戏主舞台 */}
      <div className="flex-1 relative bg-[#0d0d0d] flex items-center justify-center pt-16">
        <TacticalViewport units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} />
        
        {/* 左下角日志 */}
        <div className="absolute bottom-8 left-8 w-80 bg-black/60 p-4 rounded border border-white/10 pointer-events-none">
           <div className="text-xs font-bold text-slate-500 mb-2">COMBAT LOG</div>
           {logs.map((log, i) => (
             <div key={i} className={`text-xs mb-1 font-mono ${log.team === 'BLUE' ? 'text-blue-300' : 'text-red-300'}`}>
               {log.text}
             </div>
           ))}
        </div>
      </div>
    </main>
  );
}