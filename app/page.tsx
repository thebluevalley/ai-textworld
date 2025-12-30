'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Map as MapIcon, Wifi, AlertTriangle, MessageSquare } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const MOVE_SPEED = 0.006; 
const MAP_SIZE = 35;

// === 🏙️ 障碍物布局 ===
const OBSTACLES = [
  { x: 4, y: 4, w: 6, h: 4 }, { x: 12, y: 6, w: 4, h: 6 },
  { x: 25, y: 25, w: 6, h: 5 }, { x: 20, y: 22, w: 4, h: 6 },
  { x: 16, y: 16, w: 3, h: 3 },
  { x: 8, y: 28, w: 8, h: 1 }, { x: 22, y: 8, w: 1, h: 8 },
];

const INITIAL_UNITS = [
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 2, y: 2, hp: 1000, maxHp: 1000, status: 'ALIVE' },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 1, y: 1, hp: 600, maxHp: 600, status: 'ALIVE' },
  { id: 'b3', team: 'BLUE', role: 'MEDIC', x: 3, y: 1, hp: 800, maxHp: 800, status: 'ALIVE' },
  { id: 'r1', team: 'RED', role: 'LEADER', x: 32, y: 32, hp: 1000, maxHp: 1000, status: 'ALIVE' },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 33, y: 33, hp: 600, maxHp: 600, status: 'ALIVE' },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 31, y: 31, hp: 900, maxHp: 900, status: 'ALIVE' },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [attacks, setAttacks] = useState<any[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]); 
  const [thoughts, setThoughts] = useState<any[]>([]); // 🧠 新增：AI 思考气泡
  const [netStatus, setNetStatus] = useState<'IDLE' | 'SENDING' | 'COOLING'>('IDLE');
  
  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 物理检测优化：缩小一点障碍物判定，避免视线太容易被挡住
  const lineIntersectsRect = (p1: any, p2: any, rect: any) => {
    // 缩放障碍物判定框 (padding -0.2)，让视线更容易穿过墙角
    const rx = rect.x + 0.2; const ry = rect.y + 0.2;
    const rw = rect.w - 0.4; const rh = rect.h - 0.4;
    
    const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);
    if (rx > maxX || rx + rw < minX || ry > maxY || ry + rh < minY) return false;
    
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = p1.x + (p2.x - p1.x) * t;
      const py = p1.y + (p2.y - p1.y) * t;
      if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return true;
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

  const runGameLoop = async () => {
    if (!isPlaying) return;
    setNetStatus('SENDING');

    try {
      const activeUnits = units.filter(u => u.status === 'ALIVE').map(u => {
        const visibleEnemies = units
          .filter(other => other.team !== u.team && other.status === 'ALIVE')
          .filter(other => {
             const dist = Math.sqrt(Math.pow(u.x - other.x, 2) + Math.pow(u.y - other.y, 2));
             // ⚡️ 核心修复：如果距离小于 5，强制可见（听觉/近战感知），无视墙壁遮挡
             if (dist < 5) return true;
             // 否则检查视线
             return dist < 30 && checkLineOfSight(u, other);
          })
          .map(other => ({ id: other.id, pos: {x: other.x, y: other.y}, hp: other.hp, role: other.role }));
        return { ...u, visibleEnemies };
      });

      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ units: activeUnits, obstacles: OBSTACLES, mapSize: MAP_SIZE })
      });

      if (res.status === 429) {
        setNetStatus('COOLING');
        timerRef.current = setTimeout(runGameLoop, 10000);
        return;
      }

      if (res.ok) {
        setNetStatus('IDLE');
        const data = await res.json();
        if (data.actions) {
          const currentTickAttacks: any[] = [];
          const newTexts: any[] = [];
          const newLogs: any[] = [];
          const newThoughts: any[] = [];
          
          data.actions.forEach((a: any) => {
            const actor = units.find(u => u.id === a.unitId);
            
            // 🧠 处理思考气泡
            if (actor && a.thought) {
              newThoughts.push({
                x: actor.x, 
                y: actor.y, 
                text: a.thought, 
                team: actor.team,
                id: Math.random()
              });
            }

            if (a.type === 'MOVE' && a.target) {
              targetsRef.current[a.unitId] = { 
                x: Math.max(1, Math.min(MAP_SIZE-1, a.target.x)), 
                y: Math.max(1, Math.min(MAP_SIZE-1, a.target.y))
              };
              // 移动也记录少量日志
              newLogs.push({ text: `${a.unitId} moving > ${a.thought}`, team: actor?.team });
            }

            if (a.type === 'ATTACK' && a.targetUnitId) {
              const attacker = units.find(u => u.id === a.unitId);
              const target = units.find(u => u.id === a.targetUnitId);
              if (attacker && target && target.hp > 0) {
                // 前端不再做严格 LoS 拦截，相信 AI 的判断（因为我们已经预处理过可见性了）
                // 只要距离够就开火
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
                  newLogs.push({ text: `${attacker.id} FIRED > ${target.id}`, team: attacker.team });
                } else {
                  newTexts.push({ x: target.x, y: target.y, text: "MISS", color: "#fbbf24", id: Math.random() });
                }
              }
            }
          });
          setLogs(prev => [...newLogs, ...prev].slice(0, 15)); // 增加日志显示数量
          setAttacks(currentTickAttacks);
          setFloatingTexts(prev => [...prev, ...newTexts]);
          setThoughts(newThoughts); // 更新气泡
        }
        timerRef.current = setTimeout(runGameLoop, 2500);
      } else {
        timerRef.current = setTimeout(runGameLoop, 5000);
      }
    } catch (e) {
      console.error(e);
      timerRef.current = setTimeout(runGameLoop, 5000);
    }
  };

  useEffect(() => {
    if (isPlaying) { runGameLoop(); } 
    else { if (timerRef.current) clearTimeout(timerRef.current); setNetStatus('IDLE'); }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying]);

  // 动画循环 (保持不变)
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
        let newX = u.x + dx * MOVE_SPEED; let newY = u.y + dy * MOVE_SPEED;
        if (isColliding(newX, newY)) {
           if (!isColliding(newX, u.y)) newY = u.y; else if (!isColliding(u.x, newY)) newX = u.x; else return u;
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
          BATTLEFIELD <span className="text-[10px] bg-indigo-900 px-2 rounded">LIVE AI DECISIONS</span>
          {netStatus === 'SENDING' && <span className="text-[10px] bg-blue-900 text-blue-200 px-2 rounded animate-pulse flex items-center gap-1"><Wifi size={10}/> AI THINKING</span>}
          {netStatus === 'COOLING' && <span className="text-[10px] bg-amber-900 text-amber-200 px-2 rounded flex items-center gap-1"><AlertTriangle size={10}/> RATE LIMIT</span>}
        </h1>
        <button onClick={() => setIsPlaying(!isPlaying)} className="px-6 py-1.5 font-bold rounded bg-indigo-600 text-white hover:bg-indigo-500">
          {isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? "PAUSE" : "START OPS"}
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#020617] pt-14">
        <div className="border border-slate-800 shadow-2xl relative">
           {/* 传入 thoughts */}
           <TacticalViewport units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} thoughts={thoughts} mapSize={MAP_SIZE} />
        </div>
        <div className="absolute bottom-4 left-4 w-96 bg-slate-900/90 p-3 rounded border border-slate-700 pointer-events-none">
           <div className="text-[10px] text-slate-400 mb-2 flex gap-2"><MessageSquare size={12}/> AI DECISION LOG</div>
           <div className="space-y-1 max-h-32 overflow-y-auto">
             {logs.map((log, i) => (
               <div key={i} className={`text-[10px] font-mono ${log.team === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>
                 {log.text}
               </div>
             ))}
           </div>
        </div>
      </div>
    </main>
  );
}