'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Map as MapIcon, Wifi, AlertTriangle, Cpu, Crosshair, Trophy, Skull } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const MOVE_SPEED = 0.008; 
const MAP_SIZE = 30;

// === ⚔️ 武器参数 ===
const WEAPON_STATS: any = {
  SNIPER:  { range: 25, damage: 120, cooldown: 3000, accuracy: 0.95 },
  ASSAULT: { range: 8,  damage: 25,  cooldown: 800,  accuracy: 0.80 },
  LEADER:  { range: 12, damage: 40,  cooldown: 1200, accuracy: 0.85 },
  MEDIC:   { range: 6,  damage: 15,  cooldown: 1000, accuracy: 0.70 },
};

const OBSTACLES = [
  { x: 14, y: 10, w: 2, h: 10 }, { x: 10, y: 14, w: 10, h: 2 },
  { x: 5, y: 5, w: 5, h: 5 }, { x: 20, y: 20, w: 5, h: 5 },
  { x: 2, y: 15, w: 4, h: 1 }, { x: 24, y: 15, w: 4, h: 1 },
];

// 增加 kills 字段
const INITIAL_UNITS = [
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 4, y: 12, hp: 1000, maxHp: 1000, status: 'ALIVE', lastShot: 0, kills: 0 },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 2, y: 2, hp: 600, maxHp: 600, status: 'ALIVE', lastShot: 0, kills: 0 },
  { id: 'b3', team: 'BLUE', role: 'ASSAULT', x: 11, y: 4, hp: 900, maxHp: 900, status: 'ALIVE', lastShot: 0, kills: 0 },
  { id: 'r1', team: 'RED', role: 'LEADER', x: 26, y: 18, hp: 1000, maxHp: 1000, status: 'ALIVE', lastShot: 0, kills: 0 },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 28, y: 28, hp: 600, maxHp: 600, status: 'ALIVE', lastShot: 0, kills: 0 },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 19, y: 26, hp: 900, maxHp: 900, status: 'ALIVE', lastShot: 0, kills: 0 },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [attacks, setAttacks] = useState<any[]>([]);
  // 飘字现在包含生命周期 { life: 60 }
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]); 
  const [thoughts, setThoughts] = useState<any[]>([]);
  const [moveLines, setMoveLines] = useState<any[]>([]);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'SENDING' | 'COOLING'>('IDLE');
  
  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  const unitsRef = useRef(units); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { unitsRef.current = units; }, [units]);
  useEffect(() => { units.forEach(u => targetsRef.current[u.id] = { x: u.x, y: u.y }); }, []);

  // 物理检测函数 (保持不变)
  const lineIntersectsRect = (p1: any, p2: any, rect: any) => {
    const rx = rect.x + 0.1; const ry = rect.y + 0.1; const rw = rect.w - 0.2; const rh = rect.h - 0.2;
    const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);
    if (rx > maxX || rx + rw < minX || ry > maxY || ry + rh < minY) return false;
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; const px = p1.x + (p2.x - p1.x) * t; const py = p1.y + (p2.y - p1.y) * t;
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

  // === ⚡️ 反射循环 (包含击杀统计) ===
  useEffect(() => {
    if (!isPlaying) return;

    const reflexInterval = setInterval(() => {
      const currentUnits = unitsRef.current;
      const now = Date.now();
      const newAttacks: any[] = [];
      const newTexts: any[] = [];
      let hasUpdates = false;

      const nextUnits = currentUnits.map(u => ({ ...u }));

      nextUnits.forEach(attacker => {
        if (attacker.status === 'DEAD') return;
        const stats = WEAPON_STATS[attacker.role] || WEAPON_STATS['ASSAULT'];
        if (now - (attacker.lastShot || 0) < stats.cooldown) return;

        let bestTarget: any = null;
        let minDist = Infinity;

        nextUnits.forEach(target => {
          if (target.team === attacker.team || target.status === 'DEAD') return;
          const dist = Math.sqrt(Math.pow(attacker.x - target.x, 2) + Math.pow(attacker.y - target.y, 2));
          if (dist <= stats.range) {
            if (dist < 4 || checkLineOfSight(attacker, target)) {
              if (dist < minDist) { minDist = dist; bestTarget = target; }
            }
          }
        });

        if (bestTarget) {
          attacker.lastShot = now;
          hasUpdates = true;
          const isHit = Math.random() < stats.accuracy;
          
          newAttacks.push({
            from: { x: attacker.x, y: attacker.y },
            to: { x: bestTarget.x, y: bestTarget.y },
            color: attacker.team === 'BLUE' ? 0x60a5fa : 0xf87171,
            isMiss: !isHit,
            timestamp: now
          });

          if (isHit) {
            let dmg = stats.damage;
            if (Math.random() > 0.85) dmg = Math.floor(dmg * 1.5);
            
            // 扣血
            bestTarget.hp = Math.max(0, bestTarget.hp - dmg);
            
            // 击杀判定
            if (bestTarget.hp === 0 && bestTarget.status !== 'DEAD') {
               bestTarget.status = 'DEAD';
               attacker.kills = (attacker.kills || 0) + 1; // 击杀数+1
               newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: "KIA", color: "#ff0000", life: 90, id: Math.random() });
            } else {
               // 普通伤害飘字，life=60帧 (约1秒)
               newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: `-${dmg}`, color: "#fff", life: 60, id: Math.random() });
            }
          } else {
            newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: "MISS", color: "#fbbf24", life: 40, id: Math.random() });
          }
        }
      });

      if (hasUpdates) {
        setUnits(nextUnits);
        if (newAttacks.length > 0) setAttacks(prev => [...newAttacks, ...prev].slice(0, 20));
        if (newTexts.length > 0) setFloatingTexts(prev => [...prev, ...newTexts]);
      }
    }, 200);

    return () => clearInterval(reflexInterval);
  }, [isPlaying]);

  // === 🧠 大模型战术层 ===
  const runAiLoop = async () => {
    if (!isPlaying) return;
    setNetStatus('SENDING');
    try {
      const activeUnits = units.filter(u => u.status === 'ALIVE').map(u => ({
         id: u.id, team: u.team, role: u.role, pos: {x: u.x, y: u.y}, hp: u.hp
      }));
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ units: activeUnits, obstacles: OBSTACLES, mapSize: MAP_SIZE })
      });
      if (res.status === 429) {
        setNetStatus('COOLING'); timerRef.current = setTimeout(runAiLoop, 10000); return;
      }
      if (res.ok) {
        setNetStatus('IDLE');
        const data = await res.json();
        if (data.actions) {
          const newThoughts: any[] = [];
          const newMoveLines: any[] = [];
          data.actions.forEach((a: any) => {
            const actor = units.find(u => u.id === a.unitId);
            if (!actor || actor.status === 'DEAD') return;
            if (a.thought) newThoughts.push({ x: actor.x, y: actor.y, text: a.thought, team: actor.team, id: Math.random() });
            if (a.type === 'MOVE' && a.target) {
              const tx = Math.max(1, Math.min(MAP_SIZE-1, a.target.x));
              const ty = Math.max(1, Math.min(MAP_SIZE-1, a.target.y));
              targetsRef.current[a.unitId] = { x: tx, y: ty };
              newMoveLines.push({ from: {x: actor.x, y: actor.y}, to: {x: tx, y: ty}, color: actor.team === 'BLUE' ? 0x60a5fa : 0xf87171 });
            }
          });
          setThoughts(newThoughts);
          setMoveLines(newMoveLines);
        }
        timerRef.current = setTimeout(runAiLoop, 3000);
      } else { timerRef.current = setTimeout(runAiLoop, 5000); }
    } catch (e) { console.error(e); timerRef.current = setTimeout(runAiLoop, 5000); }
  };

  useEffect(() => {
    if (isPlaying) { runAiLoop(); } else { if (timerRef.current) clearTimeout(timerRef.current); setNetStatus('IDLE'); }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying]);

  // === 🎥 动画与生命周期循环 ===
  useEffect(() => {
    let frame: number;
    const animate = () => {
      // 1. 物理移动
      setUnits(prev => prev.map(u => {
        if (u.status === 'DEAD') return u;
        const target = targetsRef.current[u.id];
        if (!target) return u;
        const dx = target.x - u.x; const dy = target.y - u.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return { ...u, x: target.x, y: target.y };
        let newX = u.x + dx * MOVE_SPEED; let newY = u.y + dy * MOVE_SPEED;
        if (isColliding(newX, newY)) {
           if (!isColliding(newX, u.y)) newY = u.y; else if (!isColliding(u.x, newY)) newX = u.x; else return u;
        }
        return { ...u, x: newX, y: newY };
      }));

      // 2. 飘字生命周期管理 (每一帧减少 life，小于0移除)
      setFloatingTexts(prev => prev.map(t => ({ ...t, life: t.life - 1 })).filter(t => t.life > 0));

      frame = requestAnimationFrame(animate);
    };
    if (isPlaying) frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  return (
    <main className="h-screen w-full bg-[#020617] text-slate-300 font-sans flex overflow-hidden">
      {/* 顶部栏 */}
      <div className="absolute top-0 left-0 w-full h-14 bg-[#0f172a] border-b border-slate-800 z-20 flex items-center justify-between px-6">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Cpu className="text-cyan-500" />
          WARGAME: LIVE DATA
          {netStatus === 'SENDING' && <span className="text-[10px] bg-blue-900 text-blue-200 px-2 rounded animate-pulse flex items-center gap-1"><Wifi size={10}/> SYNCING</span>}
        </h1>
        <button onClick={() => setIsPlaying(!isPlaying)} className="px-6 py-1.5 font-bold rounded bg-indigo-600 text-white hover:bg-indigo-500">
          {isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? "PAUSE" : "START"}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-[#020617] pt-14 pb-32">
        <div className="border border-slate-800 shadow-2xl relative">
           <TacticalViewport units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} thoughts={thoughts} moveLines={moveLines} mapSize={MAP_SIZE} />
        </div>
      </div>

      {/* === 📊 底部数据仪表盘 === */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-[#0f172a]/95 border-t border-slate-800 flex divide-x divide-slate-800 z-30">
        
        {/* 蓝队数据 */}
        <div className="flex-1 p-4 flex flex-col gap-2">
           <div className="flex justify-between items-center text-blue-400 font-bold mb-1 border-b border-blue-900/50 pb-1">
             <span>BLUE TEAM</span>
             <span className="text-xs text-blue-600">ALPHA SQUAD</span>
           </div>
           <div className="grid grid-cols-3 gap-2">
             {units.filter(u => u.team === 'BLUE').map(u => (
               <div key={u.id} className={`bg-slate-900 p-2 rounded border ${u.status==='DEAD' ? 'border-red-900 opacity-50' : 'border-slate-700'}`}>
                 <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                   <span>{u.role}</span>
                   <span className="text-amber-400 flex items-center gap-1"><Trophy size={8}/> {u.kills}</span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(u.hp/u.maxHp)*100}%` }}/>
                 </div>
                 <div className="text-[10px] text-right mt-1 font-mono text-slate-500">{u.hp} HP</div>
               </div>
             ))}
           </div>
        </div>

        {/* 红队数据 */}
        <div className="flex-1 p-4 flex flex-col gap-2">
           <div className="flex justify-between items-center text-red-400 font-bold mb-1 border-b border-red-900/50 pb-1">
             <span>RED TEAM</span>
             <span className="text-xs text-red-600">BRAVO SQUAD</span>
           </div>
           <div className="grid grid-cols-3 gap-2">
             {units.filter(u => u.team === 'RED').map(u => (
               <div key={u.id} className={`bg-slate-900 p-2 rounded border ${u.status==='DEAD' ? 'border-red-900 opacity-50' : 'border-slate-700'}`}>
                 <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                   <span>{u.role}</span>
                   <span className="text-amber-400 flex items-center gap-1"><Trophy size={8}/> {u.kills}</span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(u.hp/u.maxHp)*100}%` }}/>
                 </div>
                 <div className="text-[10px] text-right mt-1 font-mono text-slate-500">{u.hp} HP</div>
               </div>
             ))}
           </div>
        </div>

      </div>
    </main>
  );
}