'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, RefreshCw, Map as MapIcon, Wifi, AlertTriangle } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const MOVE_SPEED = 0.005; 
const MAP_SIZE = 50;

// === 🏙️ 障碍物 ===
const OBSTACLES = [
  { x: 5, y: 5, w: 8, h: 5 }, { x: 15, y: 8, w: 5, h: 8 },
  { x: 35, y: 35, w: 10, h: 5 }, { x: 30, y: 30, w: 5, h: 8 },
  { x: 20, y: 20, w: 2, h: 2 }, { x: 28, y: 20, w: 2, h: 2 },
  { x: 20, y: 28, w: 2, h: 2 }, { x: 28, y: 28, w: 2, h: 2 },
  { x: 10, y: 40, w: 15, h: 1 }, { x: 25, y: 10, w: 15, h: 1 },
];

const INITIAL_UNITS = [
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 2, y: 2, hp: 1000, maxHp: 1000, status: 'ALIVE' },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 1, y: 1, hp: 600, maxHp: 600, status: 'ALIVE' },
  { id: 'b3', team: 'BLUE', role: 'MEDIC', x: 3, y: 1, hp: 800, maxHp: 800, status: 'ALIVE' },
  { id: 'r1', team: 'RED', role: 'LEADER', x: 48, y: 48, hp: 1000, maxHp: 1000, status: 'ALIVE' },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 49, y: 49, hp: 600, maxHp: 600, status: 'ALIVE' },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 47, y: 47, hp: 900, maxHp: 900, status: 'ALIVE' },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [attacks, setAttacks] = useState<any[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]); 
  
  // === 🚦 网络状态流控 ===
  const [netStatus, setNetStatus] = useState<'IDLE' | 'SENDING' | 'COOLING'>('IDLE');
  
  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null); // 用于存定时器以便清除

  // 物理引擎函数保持不变...
  const lineIntersectsRect = (p1: any, p2: any, rect: any) => {
    const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);
    if (rect.x > maxX || rect.x + rect.w < minX || rect.y > maxY || rect.y + rect.h < minY) return false;
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = p1.x + (p2.x - p1.x) * t;
      const py = p1.y + (p2.y - p1.y) * t;
      if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) return true;
    }
    return false;
  };
  const checkLineOfSight = (u1: any, u2: any) => {
    for (const obs of OBSTACLES) if (lineIntersectsRect(u1, u2, obs)) return false;
    return true;
  };
  const isColliding = (x: number, y: number) => {
    for (const obs of OBSTACLES) if (x > obs.x - 0.1 && x < obs.x + obs.w + 0.1 && y > obs.y - 0.1 && y < obs.y + obs.h + 0.1) return true;
    return false;
  };

  useEffect(() => {
    units.forEach(u => targetsRef.current[u.id] = { x: u.x, y: u.y });
  }, []);

  // === 🧠 核心重构：递归式 AI 循环 ===
  const runGameLoop = async () => {
    if (!isPlaying) return;
    
    setNetStatus('SENDING'); // 状态：发送中

    try {
      const activeUnits = units.filter(u => u.status === 'ALIVE').map(u => {
        const visibleEnemies = units
          .filter(other => other.team !== u.team && other.status === 'ALIVE')
          .filter(other => {
             const dist = Math.sqrt(Math.pow(u.x - other.x, 2) + Math.pow(u.y - other.y, 2));
             return dist < 35 && checkLineOfSight(u, other);
          })
          .map(other => ({ id: other.id, pos: {x: other.x, y: other.y}, hp: other.hp, role: other.role }));
        return { ...u, visibleEnemies };
      });

      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ units: activeUnits, obstacles: OBSTACLES, mapSize: MAP_SIZE })
      });

      // === 🛡️ 429 处理 ===
      if (res.status === 429) {
        console.warn("Rate Limit! Cooling down for 10s...");
        setNetStatus('COOLING'); // 状态：冷却中
        // 如果被限流，等 10秒 再试
        timerRef.current = setTimeout(runGameLoop, 10000);
        return;
      }

      if (res.ok) {
        setNetStatus('IDLE');
        const data = await res.json();
        if (data.actions) {
          // ... 处理逻辑 (保持不变) ...
          const currentTickAttacks: any[] = [];
          const newTexts: any[] = [];
          const newLogs: any[] = [];
          
          data.actions.forEach((a: any) => {
            if (a.type === 'MOVE' && a.target) {
              targetsRef.current[a.unitId] = { 
                x: Math.max(1, Math.min(MAP_SIZE-1, a.target.x)), 
                y: Math.max(1, Math.min(MAP_SIZE-1, a.target.y))
              };
            }
            if (a.type === 'ATTACK' && a.targetUnitId) {
              const attacker = units.find(u => u.id === a.unitId);
              const target = units.find(u => u.id === a.targetUnitId);
              if (attacker && target && target.hp > 0) {
                const hasLoS = checkLineOfSight(attacker, target);
                if (!hasLoS) {
                  newTexts.push({ x: attacker.x, y: attacker.y, text: "BLOCKED", color: "#888", id: Math.random() });
                  return;
                }
                const isHit = Math.random() > 0.2;
                currentTickAttacks.push({
                  from: { x: attacker.x, y: attacker.y },
                  to: { x: target.x, y: target.y },
                  color: attacker.team === 'BLUE' ? 0x60a5fa : 0xf87171,
                  isMiss: !isHit,
                  timestamp: Date.now()
                });
                if (isHit) {
                  const dmg = a.damage || 30;
                  newTexts.push({ x: target.x, y: target.y, text: `-${dmg}`, color: "#fff", id: Math.random() });
                  setUnits(prev => prev.map(u => {
                    if (u.id === target.id) {
                      const newHp = Math.max(0, u.hp - dmg);
                      return { ...u, hp: newHp, status: newHp <= 0 ? 'DEAD' : 'ALIVE' };
                    }
                    return u;
                  }));
                  newLogs.push({ text: `${attacker.id} hit ${target.id}`, team: attacker.team });
                } else {
                  newTexts.push({ x: target.x, y: target.y, text: "MISS", color: "#fbbf24", id: Math.random() });
                }
              }
            }
          });
          setLogs(prev => [...newLogs, ...prev].slice(0, 10));
          setAttacks(currentTickAttacks);
          setFloatingTexts(prev => [...prev, ...newTexts]);
        }
        
        // 成功后，等 2秒 再发下一次 (正常的 2秒间隔)
        timerRef.current = setTimeout(runGameLoop, 2000);
      } else {
        // 其他错误，等 5秒 重试
        timerRef.current = setTimeout(runGameLoop, 5000);
      }
    } catch (e) {
      console.error(e);
      timerRef.current = setTimeout(runGameLoop, 5000);
    }
  };

  // 监听 isPlaying 变化来启动/停止循环
  useEffect(() => {
    if (isPlaying) {
      runGameLoop();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setNetStatus('IDLE');
    }
    // Cleanup
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying]);


  // === 🎥 动画循环 ===
  useEffect(() => {
    let frame: number;
    const animate = () => {
      setUnits(prev => prev.map(u => {
        if (u.status === 'DEAD') return u;
        const target = targetsRef.current[u.id];
        if (!target) return u;
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return { ...u, x: target.x, y: target.y };
        
        let newX = u.x + dx * MOVE_SPEED;
        let newY = u.y + dy * MOVE_SPEED;
        
        if (isColliding(newX, newY)) {
           if (!isColliding(newX, u.y)) newY = u.y;
           else if (!isColliding(u.x, newY)) newX = u.x;
           else return u;
        }
        return { ...u, x: newX, y: newY };
      }));
      frame = requestAnimationFrame(animate);
    };
    if (isPlaying) frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  return (
    <main className="h-screen w-full bg-[#020617] text-slate-300 font-sans flex overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-14 bg-[#0f172a] border-b border-slate-800 z-20 flex items-center justify-between px-6">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <MapIcon className="text-indigo-500" />
          GRAND BATTLEFIELD
          
          {/* 状态指示器 */}
          {netStatus === 'SENDING' && <span className="text-[10px] bg-blue-900 text-blue-200 px-2 rounded animate-pulse flex items-center gap-1"><Wifi size={10}/> SYNCING</span>}
          {netStatus === 'COOLING' && <span className="text-[10px] bg-amber-900 text-amber-200 px-2 rounded flex items-center gap-1"><AlertTriangle size={10}/> RATE LIMIT (WAITing 10s)</span>}
        
        </h1>
        <button onClick={() => setIsPlaying(!isPlaying)} className="px-6 py-1.5 font-bold rounded bg-indigo-600 text-white hover:bg-indigo-500">
          {isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? "PAUSE" : "START OPS"}
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#020617] pt-14">
        <div className="border border-slate-800 shadow-2xl relative">
           <TacticalViewport units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} mapSize={MAP_SIZE} />
        </div>
        <div className="absolute bottom-4 left-4 w-80 bg-slate-900/90 p-3 rounded border border-slate-700 pointer-events-none">
           <div className="space-y-1">
             {logs.map((log, i) => (
               <div key={i} className={`text-[10px] ${log.team === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>{log.text}</div>
             ))}
           </div>
        </div>
      </div>
    </main>
  );
}