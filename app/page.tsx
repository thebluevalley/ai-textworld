'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, RefreshCw, Zap, Radio, ShieldCheck } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

// === 🐢 绝对安全模式 ===
const TICK_RATE = 6000; // 6秒一回合 (极慢，保证不封号)
const MOVE_SPEED = 0.01; // 极慢的平滑移动

const OBSTACLES = [
  { x: 5, y: 8, w: 2, h: 4 }, 
  { x: 13, y: 8, w: 2, h: 4 }, 
  { x: 8, y: 4, w: 4, h: 1 }, 
  { x: 8, y: 15, w: 4, h: 1 }, 
  { x: 9, y: 9, w: 2, h: 2 }, 
];

const INITIAL_UNITS = [
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 3, y: 6, hp: 500, maxHp: 500, status: 'ALIVE' },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 2, y: 3, hp: 300, maxHp: 300, status: 'ALIVE' },
  { id: 'b3', team: 'BLUE', role: 'MEDIC', x: 3, y: 9, hp: 400, maxHp: 400, status: 'ALIVE' },
  { id: 'r1', team: 'RED', role: 'LEADER', x: 16, y: 13, hp: 500, maxHp: 500, status: 'ALIVE' },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 17, y: 16, hp: 300, maxHp: 300, status: 'ALIVE' },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 16, y: 10, hp: 450, maxHp: 450, status: 'ALIVE' },
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

  // === AI 循环 ===
  useEffect(() => {
    if (!isPlaying) return;

    const tick = async () => {
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

        if (!res.ok) {
           console.warn("API Skip:", res.status);
           return; 
        }

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
                return { text: `${a.unitId} hits ${target.id} [${dmg}]`, type: 'ATTACK', team: attacker.team };
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
    const interval = setInterval(tick, TICK_RATE);
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
    <main className="h-screen w-full bg-[#000000] text-slate-300 font-sans flex overflow-hidden">
      
      {/* 顶部栏 */}
      <div className="absolute top-0 left-0 w-full h-14 bg-[#111] border-b border-[#333] z-20 flex items-center justify-between px-6">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="text-green-500" />
          SAFE MODE TACTICS
        </h1>
        
        <div className="flex gap-4">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-6 py-1.5 font-bold rounded flex items-center gap-2 ${
              isPlaying ? 'bg-red-900 text-white' : 'bg-green-700 text-white'
            }`}
          >
            {isPlaying ? <Pause size={14}/> : <Play size={14}/>}
            {isPlaying ? "PAUSE" : "START (6s TICK)"}
          </button>
          
          <button onClick={resetGame} className="p-1.5 rounded bg-gray-800 hover:bg-gray-700">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-[#050505] pt-14">
        {/* 强制给画布容器一个明显的边框，防止你找不到它 */}
        <div className="border-2 border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
           <TacticalViewport units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} />
        </div>
        
        <div className="absolute bottom-4 left-4 w-80 bg-black/90 p-3 rounded border border-white/20 pointer-events-none">
           <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-2">
             <Radio size={10}/> LOGS
           </div>
           <div className="space-y-1">
             {logs.map((log, i) => (
               <div key={i} className={`text-[10px] ${log.team === 'BLUE' ? 'text-blue-300' : 'text-red-300'}`}>
                 {log.text}
               </div>
             ))}
           </div>
        </div>
      </div>
    </main>
  );
}