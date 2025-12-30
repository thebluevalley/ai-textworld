'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, RefreshCw, Zap, Radio } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

// === ⚡ 极速模式 (已认证账号专用) ===
const API_INTERVAL = 2000; // 2秒一回合
const MOVE_SPEED = 0.08;   // 快速移动插值

// === 地图障碍物 ===
const OBSTACLES = [
  { x: 5, y: 8, w: 2, h: 4 }, 
  { x: 13, y: 8, w: 2, h: 4 }, 
  { x: 8, y: 4, w: 4, h: 1 }, 
  { x: 8, y: 15, w: 4, h: 1 }, 
  { x: 9, y: 9, w: 2, h: 2 }, 
];

// === 初始单位 (高血量 RPG 设定) ===
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
  
  const [attacks, setAttacks] = useState<any[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]); 

  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  
  useEffect(() => {
    units.forEach(u => targetsRef.current[u.id] = { x: u.x, y: u.y });
  }, []);

  // === AI 循环 (2秒极速) ===
  useEffect(() => {
    if (!isPlaying) return;

    const tick = async () => {
      // 胜负判定
      const blueAlive = units.some(u => u.team === 'BLUE' && u.hp > 0);
      const redAlive = units.some(u => u.team === 'RED' && u.hp > 0);
      if (!blueAlive || !redAlive) {
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
            if (a.type === 'MOVE' && a.target) {
               targetsRef.current[a.unitId] = { 
                x: Math.max(1, Math.min(19, a.target.x)), 
                y: Math.max(1, Math.min(19, a.target.y))
              };
              return null; 
            }
            
            if (a.type === 'ATTACK' && a.targetUnitId) {
              const attacker = units.find(u => u.id === a.unitId);
              const target = units.find(u => u.id === a.targetUnitId);
              
              if (attacker && target && target.hp > 0) {
                currentTickAttacks.push({
                  from: { x: attacker.x, y: attacker.y },
                  to: { x: target.x, y: target.y },
                  color: attacker.team === 'BLUE' ? 0x60a5fa : 0xf87171,
                  timestamp: Date.now()
                });

                const hitChance = Math.random();
                const isHit = hitChance > 0.15; 
                let finalDmg = 0;
                let hitText = "MISS";
                let textColor = "#fbbf24"; 

                if (isHit) {
                  finalDmg = a.damage || 30;
                  if (Math.random() > 0.8) {
                    finalDmg = Math.floor(finalDmg * 1.5);
                    hitText = `CRIT -${finalDmg}`;
                    textColor = "#ff00ff"; 
                  } else {
                    hitText = `-${finalDmg}`;
                    textColor = "#ffffff"; 
                  }
                }

                newTexts.push({
                  x: target.x,
                  y: target.y,
                  text: hitText,
                  color: textColor,
                  id: Date.now() + Math.random()
                });

                if (finalDmg > 0) {
                  setUnits(prev => prev.map(u => {
                    if (u.id === target.id) {
                      const newHp = Math.max(0, u.hp - finalDmg);
                      return { ...u, hp: newHp, status: newHp <= 0 ? 'DEAD' : 'ALIVE' };
                    }
                    return u;
                  }));
                }

                return { text: `${a.unitId} >> ${target.id} [${hitText}]`, type: 'ATTACK', team: attacker.team };
              }
            }
            if (a.type === 'HEAL' && a.targetUnitId) {
               const healer = units.find(u => u.id === a.unitId);
               const target = units.find(u => u.id === a.targetUnitId);
               if (healer && target && target.hp > 0) {
                 const healAmount = a.healAmount || 40;
                 newTexts.push({
                    x: target.x, y: target.y, text: `+${healAmount}`, color: "#22c55e", id: Date.now() + Math.random()
                 });
                 setUnits(prev => prev.map(u => {
                    if (u.id === target.id) return { ...u, hp: Math.min(u.maxHp, u.hp + healAmount) };
                    return u;
                 }));
                 return { text: `${a.unitId} heals ${target.id}`, type: 'HEAL', team: healer.team };
               }
            }
            return null;
          }).filter(Boolean);

          setLogs(prev => [...newLogs, ...prev].slice(0, 8));
          setAttacks(currentTickAttacks);
          setFloatingTexts(prev => [...prev, ...newTexts]);
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

  const resetGame = () => {
    setIsPlaying(false);
    setUnits(INITIAL_UNITS);
    setLogs([]);
    setAttacks([]);
    setFloatingTexts([]);
    INITIAL_UNITS.forEach(u => targetsRef.current[u.id] = {x: u.x, y: u.y});
  };

  return (
    <main className="h-screen w-full bg-[#111] text-slate-300 font-sans flex overflow-hidden">
      
      {/* 顶部状态栏 */}
      <div className="absolute top-0 left-0 w-full h-16 bg-[#1a1a1a]/90 backdrop-blur border-b border-[#333] z-20 flex items-center justify-between px-8 shadow-lg">
        <h1 className="text-xl font-black italic tracking-widest text-white flex items-center gap-2">
          <Zap className="text-cyan-400" fill="currentColor"/>
          NEON TACTICS <span className="text-[10px] text-cyan-500 font-normal not-italic border border-cyan-700 px-1 rounded bg-cyan-950">PRO MODE</span>
        </h1>
        
        <div className="flex gap-8">
          <div className="flex flex-col items-end">
             <span className="text-xs text-blue-400 font-bold tracking-wider">BLUE SQUAD</span>
             <div className="flex gap-1 mt-1">
               {units.filter(u => u.team === 'BLUE').map(u => (
                 <div key={u.id} className={`w-8 h-1.5 rounded-sm transition-all ${u.hp>0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-slate-800'}`}/>
               ))}
             </div>
          </div>
          
          <div className="flex flex-col items-start">
             <span className="text-xs text-red-400 font-bold tracking-wider">RED SQUAD</span>
             <div className="flex gap-1 mt-1">
               {units.filter(u => u.team === 'RED').map(u => (
                 <div key={u.id} className={`w-8 h-1.5 rounded-sm transition-all ${u.hp>0 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-800'}`}/>
               ))}
             </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-6 py-2 font-bold rounded shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
              isPlaying ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
            {isPlaying ? "PAUSE" : "ENGAGE"}
          </button>
          
          <button 
            onClick={resetGame}
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={16}/>
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-[#0d0d0d] flex items-center justify-center pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1a1a1a_0%,#000_100%)] pointer-events-none"/>
        <TacticalViewport units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} />
        
        <div className="absolute bottom-6 left-6 w-96 bg-black/80 backdrop-blur-md p-4 rounded-lg border border-white/10 pointer-events-none shadow-2xl">
           <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-3 border-b border-white/10 pb-2">
             <Radio size={12}/> COMBAT LOG (REALTIME)
           </div>
           <div className="space-y-1.5">
             {logs.map((log, i) => (
               <div key={i} className={`text-[11px] font-mono flex items-center gap-2 ${log.team === 'BLUE' ? 'text-blue-300' : 'text-red-300'}`}>
                 <span className={`w-1 h-1 rounded-full ${log.team === 'BLUE' ? 'bg-blue-500' : 'bg-red-500'}`}/>
                 {log.text}
               </div>
             ))}
           </div>
        </div>
      </div>
    </main>
  );
}