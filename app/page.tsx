'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Map as MapIcon, Wifi, AlertTriangle, Shield, Crosshair, Trophy, Skull, Users, HeartPulse, Cpu, Activity } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const BASE_SPEED = 0.008; 
const MAP_SIZE = 30;

// ... WEAPON_STATS, OBSTACLES, INITIAL_UNITS 保持不变 (请保留 Turn 18 的代码) ...
// 为了篇幅，这里假设你保留了上面的常量定义，只放组件主体修改

// 🔴 请把上面的常量复制过来 🔴
const WEAPON_STATS: any = {
  SNIPER:  { range: 30, damage: 120, cooldown: 3500, accuracy: 0.95, suppression: 80 }, 
  ASSAULT: { range: 10, damage: 20,  cooldown: 500,  accuracy: 0.75, suppression: 15 }, 
  LEADER:  { range: 15, damage: 35,  cooldown: 1000, accuracy: 0.85, suppression: 30 },
  MEDIC:   { range: 8,  damage: 15,  cooldown: 800,  accuracy: 0.70, suppression: 10 },
  HEAVY:   { range: 20, damage: 25,  cooldown: 300,  accuracy: 0.50, suppression: 60 },
};

const OBSTACLES = [
  { x: 14, y: 10, w: 2, h: 10 }, { x: 10, y: 14, w: 10, h: 2 },
  { x: 5, y: 5, w: 6, h: 6 },    { x: 19, y: 19, w: 6, h: 6 },
  { x: 2, y: 18, w: 5, h: 1 },   { x: 23, y: 11, w: 5, h: 1 },
];

const INITIAL_UNITS = [
  // BLUE
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 4, y: 12, hp: 1000, maxHp: 1000, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 2, y: 2, hp: 600, maxHp: 600, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  { id: 'b3', team: 'BLUE', role: 'MEDIC', x: 3, y: 4, hp: 800, maxHp: 800, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  { id: 'b4', team: 'BLUE', role: 'ASSAULT', x: 11, y: 4, hp: 900, maxHp: 900, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  { id: 'b5', team: 'BLUE', role: 'HEAVY', x: 5, y: 10, hp: 1200, maxHp: 1200, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  // RED
  { id: 'r1', team: 'RED', role: 'LEADER', x: 26, y: 18, hp: 1000, maxHp: 1000, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 28, y: 28, hp: 600, maxHp: 600, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  { id: 'r3', team: 'RED', role: 'MEDIC', x: 26, y: 26, hp: 800, maxHp: 800, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  { id: 'r4', team: 'RED', role: 'ASSAULT', x: 19, y: 26, hp: 900, maxHp: 900, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
  { id: 'r5', team: 'RED', role: 'HEAVY', x: 24, y: 20, hp: 1200, maxHp: 1200, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0, tactic: 'MOVE', lastMoveTime: 0 },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [attacks, setAttacks] = useState<any[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]); 
  const [thoughts, setThoughts] = useState<any[]>([]);
  const [moveLines, setMoveLines] = useState<any[]>([]);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'SENDING' | 'COOLING'>('IDLE');
  const [spottedUnits, setSpottedUnits] = useState<Set<string>>(new Set());
  
  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  const unitsRef = useRef(units); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { unitsRef.current = units; }, [units]);
  useEffect(() => { units.forEach(u => targetsRef.current[u.id] = { x: u.x, y: u.y }); }, []);

  // ... (保留 lineIntersectsRect, checkLineOfSight, isColliding 物理函数) ...
  const lineIntersectsRect = (p1: any, p2: any, rect: any) => {
    const rx = rect.x + 0.05; const ry = rect.y + 0.05; const rw = rect.w - 0.1; const rh = rect.h - 0.1;
    const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);
    if (rx > maxX || rx + rw < minX || ry > maxY || ry + rh < minY) return false;
    const steps = 15;
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

  // ... (保留 reflexInterval 战斗算法) ...
  useEffect(() => {
    if (!isPlaying) return;
    const reflexInterval = setInterval(() => {
      const currentUnits = unitsRef.current;
      const now = Date.now();
      const newAttacks: any[] = [];
      const newTexts: any[] = [];
      let hasUpdates = false;
      const nextUnits = currentUnits.map(u => ({ ...u }));
      const currentlySpotted = new Set<string>();

      nextUnits.forEach(attacker => {
        if (attacker.status === 'DEAD') return;
        let canSeeAnyone = false;
        const baseStats = WEAPON_STATS[attacker.role] || WEAPON_STATS['ASSAULT'];
        let currentCooldown = baseStats.cooldown;
        let currentAccuracy = baseStats.accuracy;
        let suppressionPower = baseStats.suppression;

        if (attacker.tactic === 'RUSH') return; 
        if (attacker.tactic === 'SUPPRESS') { currentCooldown *= 0.4; currentAccuracy *= 0.4; suppressionPower *= 1.5; }
        const isSuppressed = (attacker.suppression || 0) > 50;
        if (isSuppressed) { currentCooldown *= 1.5; currentAccuracy *= 0.5; }

        let bestTarget: any = null;
        let minDist = Infinity;

        nextUnits.forEach(target => {
          if (target.team === attacker.team || target.status === 'DEAD') return;
          const dist = Math.sqrt(Math.pow(attacker.x - target.x, 2) + Math.pow(attacker.y - target.y, 2));
          if (dist < 35 && checkLineOfSight(attacker, target)) {
             currentlySpotted.add(target.id);
             canSeeAnyone = true;
             if (now - (attacker.lastShot || 0) >= currentCooldown) {
               if (dist <= baseStats.range) { if (dist < minDist) { minDist = dist; bestTarget = target; } }
             }
          }
        });

        if (attacker.tactic === 'SUPPRESS' && !canSeeAnyone) { attacker.tactic = 'MOVE'; }

        if (bestTarget) {
          attacker.lastShot = now;
          hasUpdates = true;
          const isHit = Math.random() < currentAccuracy;
          newAttacks.push({
            from: { x: attacker.x, y: attacker.y },
            to: { x: bestTarget.x, y: bestTarget.y },
            color: attacker.team === 'BLUE' ? 0x60a5fa : 0xf87171,
            isMiss: !isHit,
            timestamp: now,
            isSuppressionFire: isSuppressed || attacker.tactic === 'SUPPRESS' 
          });
          bestTarget.suppression = Math.min(100, (bestTarget.suppression || 0) + suppressionPower);
          if (isHit) {
            let dmg = baseStats.damage;
            if (Math.random() > 0.9) dmg = Math.floor(dmg * 2.0); 
            bestTarget.hp = Math.max(0, bestTarget.hp - dmg);
            if (bestTarget.hp === 0 && bestTarget.status !== 'DEAD') {
               bestTarget.status = 'DEAD';
               attacker.kills = (attacker.kills || 0) + 1;
               newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: "KIA", color: "#ff0000", life: 90, id: Math.random() });
            } else {
               newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: `-${dmg}`, color: "#fff", life: 60, id: Math.random() });
            }
          } else {
            if (attacker.tactic === 'SUPPRESS' && Math.random()>0.7) {
                newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: "SUPPRESSED", color: "#fbbf24", life: 40, id: Math.random() });
            }
          }
        }
      });
      nextUnits.forEach(u => { if (u.suppression > 0) u.suppression = Math.max(0, u.suppression - 2); });
      setSpottedUnits(currentlySpotted);
      if (hasUpdates || nextUnits.some(u => u.suppression > 0)) { setUnits(nextUnits); }
      if (newAttacks.length > 0) setAttacks(prev => [...newAttacks, ...prev].slice(0, 30));
      if (newTexts.length > 0) setFloatingTexts(prev => [...prev, ...newTexts]);
    }, 200);
    return () => clearInterval(reflexInterval);
  }, [isPlaying]);

  // === AI 循环 ===
  const runAiLoop = async () => {
    if (!isPlaying) return;
    setNetStatus('SENDING');
    const now = Date.now();
    const activeUnits = units.filter(u => u.status === 'ALIVE').map(u => ({
        id: u.id, team: u.team, role: u.role, pos: {x: u.x, y: u.y}, hp: u.hp, suppression: u.suppression, visibleEnemies: [] // 视野在后端计算
    }));
    
    // 补充视野数据：前端计算并传给后端
    activeUnits.forEach(u => {
       const visible = units.filter(t => t.team !== u.team && t.status === 'ALIVE').filter(t => {
          const dist = Math.sqrt(Math.pow(u.pos.x - t.x, 2) + Math.pow(u.pos.y - t.y, 2));
          return dist < 35 && checkLineOfSight({x:u.pos.x, y:u.pos.y}, t);
       }).map(t => ({id: t.id, pos: {x: t.x, y: t.y}, hp: t.hp, role: t.role}));
       u.visibleEnemies = visible;
    });

    try {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ units: activeUnits, obstacles: OBSTACLES, mapSize: MAP_SIZE })
      });
      if (res.status === 429) { setNetStatus('COOLING'); timerRef.current = setTimeout(runAiLoop, 10000); return; }
      if (res.ok) {
        setNetStatus('IDLE');
        const data = await res.json();
        if (data.actions) {
          const newThoughts: any[] = [];
          const newMoveLines: any[] = [];
          data.actions.forEach((a: any) => {
            const actor = units.find(u => u.id === a.unitId);
            if (!actor || actor.status === 'DEAD') return;
            setUnits(prev => prev.map(u => u.id === a.unitId ? { ...u, tactic: a.tactic, lastMoveTime: now } : u));
            if (a.thought) newThoughts.push({ x: actor.x, y: actor.y, text: a.thought, team: actor.team, id: Math.random() });
            if (a.type === 'MOVE' && a.target) {
              const tx = Math.max(1, Math.min(MAP_SIZE-1, a.target.x));
              const ty = Math.max(1, Math.min(MAP_SIZE-1, a.target.y));
              targetsRef.current[a.unitId] = { x: tx, y: ty };
              newMoveLines.push({ from: {x: actor.x, y: actor.y}, to: {x: tx, y: ty}, color: actor.team === 'BLUE' ? 0x60a5fa : 0xf87171, tactic: a.tactic });
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

  // ... (保留 animate 循环) ...
  useEffect(() => {
    let frame: number;
    const animate = () => {
      setUnits(prev => prev.map(u => {
        if (u.status === 'DEAD') return u;
        const target = targetsRef.current[u.id];
        let tx = target ? target.x : MAP_SIZE/2;
        let ty = target ? target.y : MAP_SIZE/2;
        if (!target) {
           const distToCenter = Math.sqrt(Math.pow(u.x - 15, 2) + Math.pow(u.y - 15, 2));
           if (distToCenter > 10) { tx = 15; ty = 15; } else { tx = u.x; ty = u.y; }
        } else { tx = target.x; ty = target.y; }
        const dx = tx - u.x; const dy = ty - u.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return { ...u, x: tx, y: ty };
        let speed = BASE_SPEED;
        if (u.tactic === 'RUSH') speed *= 1.8;
        if (u.tactic === 'SUPPRESS') speed = 0; 
        if ((u.suppression || 0) > 50) speed *= 0.5;
        if (!target) speed *= 0.1;
        let newX = u.x + dx * speed; let newY = u.y + dy * speed;
        if (isColliding(newX, newY)) {
           if (!isColliding(newX, u.y)) newY = u.y; else if (!isColliding(u.x, newY)) newX = u.x; else return u;
        }
        return { ...u, x: newX, y: newY };
      }));
      setFloatingTexts(prev => prev.map(t => ({ ...t, life: t.life - 1 })).filter(t => t.life > 0));
      frame = requestAnimationFrame(animate);
    };
    if (isPlaying) frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  return (
    <main className="flex h-screen w-full bg-[#020617] text-slate-300 font-sans overflow-hidden">
      <div className="flex-1 relative flex flex-col">
        <div className="h-14 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between px-6 z-20">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="text-purple-500" />
            DUAL CORE AI <span className="text-[10px] bg-purple-900 px-2 rounded">PVP MODE</span>
            {netStatus === 'SENDING' && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-[10px] bg-blue-900 text-blue-200 px-2 rounded animate-pulse flex items-center gap-1"><Activity size={10}/> BLUE</span>
                <span className="text-[10px] bg-red-900 text-red-200 px-2 rounded animate-pulse flex items-center gap-1"><Activity size={10}/> RED</span>
              </div>
            )}
          </h1>
          <button onClick={() => setIsPlaying(!isPlaying)} className="px-6 py-1.5 font-bold rounded bg-indigo-600 text-white hover:bg-indigo-500">
            {isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? "PAUSE" : "START"}
          </button>
        </div>
        <div className="flex-1 bg-[#020617] relative flex items-center justify-center p-4">
           <div className="border border-slate-800 shadow-2xl relative">
             <TacticalViewport units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} thoughts={thoughts} moveLines={moveLines} spottedUnits={spottedUnits} mapSize={MAP_SIZE} />
           </div>
        </div>
      </div>
      <div className="w-80 bg-[#0f172a] border-l border-slate-800 flex flex-col z-30">
        {/* ... (侧边栏代码保持不变) ... */}
        {/* 为节省篇幅，请保留 Turn 18 的侧边栏 UI 代码 */}
        <div className="flex-1 p-4 border-b border-slate-800 overflow-y-auto">
           <div className="flex justify-between items-center text-blue-400 font-bold mb-3 pb-1 border-b border-blue-900/50">
             <span className="flex items-center gap-2"><Users size={16}/> BLUE TEAM</span>
             <span className="text-xs text-blue-600">ALPHA</span>
           </div>
           <div className="space-y-3">
             {units.filter(u => u.team === 'BLUE').map(u => (
               <div key={u.id} className={`bg-slate-900 p-2.5 rounded border relative ${u.status==='DEAD' ? 'border-red-900 opacity-50 grayscale' : 'border-slate-700'}`}>
                 <div className="flex justify-between text-xs text-slate-300 mb-1 font-bold">
                   <span>{u.role} <span className="text-slate-500 text-[10px]">#{u.id}</span></span>
                   <span className="text-amber-400 flex items-center gap-1"><Trophy size={10}/> {u.kills}</span>
                 </div>
                 <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-1">
                   <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(u.hp/u.maxHp)*100}%` }}/>
                 </div>
                 <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden flex justify-between items-center">
                    <div className="h-full bg-yellow-500 transition-all" style={{ width: `${u.suppression}%` }}/>
                 </div>
                 <div className="mt-1 flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 bg-slate-800 px-1 rounded">{u.tactic || 'IDLE'}</span>
                    {u.hp < 350 && u.status !== 'DEAD' && <HeartPulse size={12} className="text-red-500 animate-pulse"/>}
                 </div>
               </div>
             ))}
           </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
           <div className="flex justify-between items-center text-red-400 font-bold mb-3 pb-1 border-b border-red-900/50">
             <span className="flex items-center gap-2"><Users size={16}/> RED TEAM</span>
             <span className="text-xs text-red-600">BRAVO</span>
           </div>
           <div className="space-y-3">
             {units.filter(u => u.team === 'RED').map(u => (
               <div key={u.id} className={`bg-slate-900 p-2.5 rounded border relative ${u.status==='DEAD' ? 'border-red-900 opacity-50 grayscale' : 'border-slate-700'}`}>
                 <div className="flex justify-between text-xs text-slate-300 mb-1 font-bold">
                   <span>{u.role} <span className="text-slate-500 text-[10px]">#{u.id}</span></span>
                   <span className="text-amber-400 flex items-center gap-1"><Trophy size={10}/> {u.kills}</span>
                 </div>
                 <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-1">
                   <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(u.hp/u.maxHp)*100}%` }}/>
                 </div>
                 <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 transition-all" style={{ width: `${u.suppression}%` }}/>
                 </div>
                 <div className="mt-1 flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 bg-slate-800 px-1 rounded">{u.tactic || 'IDLE'}</span>
                    {u.hp < 350 && u.status !== 'DEAD' && <HeartPulse size={12} className="text-red-500 animate-pulse"/>}
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </main>
  );
}