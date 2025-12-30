'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Map as MapIcon, Wifi, AlertTriangle, Shield, Crosshair, Trophy, Skull, Users, HeartPulse } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const BASE_SPEED = 0.008; 
const MAP_SIZE = 30;

// === ⚔️ 扩充武器库 ===
const WEAPON_STATS: any = {
  SNIPER:  { range: 30, damage: 120, cooldown: 3500, accuracy: 0.95, suppression: 80 }, 
  ASSAULT: { range: 10, damage: 20,  cooldown: 500,  accuracy: 0.75, suppression: 15 }, 
  LEADER:  { range: 15, damage: 35,  cooldown: 1000, accuracy: 0.85, suppression: 30 },
  MEDIC:   { range: 8,  damage: 15,  cooldown: 800,  accuracy: 0.70, suppression: 10 },
  HEAVY:   { range: 18, damage: 25,  cooldown: 300,  accuracy: 0.50, suppression: 60 }, // 新职业：机枪手，射速极快，压制力强，精度低
};

// 障碍物 (稍微调整以适应 10 人乱战)
const OBSTACLES = [
  { x: 14, y: 10, w: 2, h: 10 }, { x: 10, y: 14, w: 10, h: 2 },
  { x: 5, y: 5, w: 6, h: 6 },    { x: 19, y: 19, w: 6, h: 6 },
  { x: 2, y: 18, w: 5, h: 1 },   { x: 23, y: 11, w: 5, h: 1 },
];

// === 👥 扩编至 5v5 ===
const INITIAL_UNITS = [
  // BLUE
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 4, y: 12, hp: 1000, maxHp: 1000, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 2, y: 2, hp: 600, maxHp: 600, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  { id: 'b3', team: 'BLUE', role: 'MEDIC', x: 3, y: 4, hp: 800, maxHp: 800, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  { id: 'b4', team: 'BLUE', role: 'ASSAULT', x: 11, y: 4, hp: 900, maxHp: 900, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  { id: 'b5', team: 'BLUE', role: 'HEAVY', x: 5, y: 10, hp: 1200, maxHp: 1200, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  // RED
  { id: 'r1', team: 'RED', role: 'LEADER', x: 26, y: 18, hp: 1000, maxHp: 1000, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 28, y: 28, hp: 600, maxHp: 600, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  { id: 'r3', team: 'RED', role: 'MEDIC', x: 26, y: 26, hp: 800, maxHp: 800, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  { id: 'r4', team: 'RED', role: 'ASSAULT', x: 19, y: 26, hp: 900, maxHp: 900, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
  { id: 'r5', team: 'RED', role: 'HEAVY', x: 24, y: 20, hp: 1200, maxHp: 1200, status: 'ALIVE', lastShot: 0, kills: 0, suppression: 0 },
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

  // 物理检测函数
  const lineIntersectsRect = (p1: any, p2: any, rect: any) => {
    // 更加严格的判定，防止擦边穿墙
    const rx = rect.x + 0.05; const ry = rect.y + 0.05; 
    const rw = rect.w - 0.1; const rh = rect.h - 0.1;
    const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);
    if (rx > maxX || rx + rw < minX || ry > maxY || ry + rh < minY) return false;
    const steps = 15; // 增加采样点，确保不穿墙
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

  // === ⚡️ 战斗反射循环 (严禁穿墙) ===
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
        
        const isSuppressed = (attacker.suppression || 0) > 50;
        const stats = WEAPON_STATS[attacker.role] || WEAPON_STATS['ASSAULT'];
        const effectiveCooldown = isSuppressed ? stats.cooldown * 1.5 : stats.cooldown;

        let bestTarget: any = null;
        let minDist = Infinity;

        nextUnits.forEach(target => {
          if (target.team === attacker.team || target.status === 'DEAD') return;
          const dist = Math.sqrt(Math.pow(attacker.x - target.x, 2) + Math.pow(attacker.y - target.y, 2));
          
          // 只有完全无遮挡才算“发现”和“可射击”
          // 移除了 dist < 4 的近战透视外挂
          if (dist < 35 && checkLineOfSight(attacker, target)) {
             currentlySpotted.add(target.id);
             
             if (now - (attacker.lastShot || 0) >= effectiveCooldown) {
               if (dist <= stats.range) {
                 if (dist < minDist) { minDist = dist; bestTarget = target; }
               }
             }
          }
        });

        if (bestTarget) {
          attacker.lastShot = now;
          hasUpdates = true;
          
          const accuracy = isSuppressed ? stats.accuracy * 0.5 : stats.accuracy;
          const isHit = Math.random() < accuracy;
          
          newAttacks.push({
            from: { x: attacker.x, y: attacker.y },
            to: { x: bestTarget.x, y: bestTarget.y },
            color: attacker.team === 'BLUE' ? 0x60a5fa : 0xf87171,
            isMiss: !isHit,
            timestamp: now,
            isSuppressionFire: isSuppressed 
          });

          bestTarget.suppression = Math.min(100, (bestTarget.suppression || 0) + (stats.suppression || 10));

          if (isHit) {
            let dmg = stats.damage;
            if (Math.random() > 0.85) dmg = Math.floor(dmg * 1.5);
            bestTarget.hp = Math.max(0, bestTarget.hp - dmg);
            if (bestTarget.hp === 0 && bestTarget.status !== 'DEAD') {
               bestTarget.status = 'DEAD';
               attacker.kills = (attacker.kills || 0) + 1;
               newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: "KIA", color: "#ff0000", life: 90, id: Math.random() });
            } else {
               newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: `-${dmg}`, color: "#fff", life: 60, id: Math.random() });
            }
          } else {
            if (isSuppressed) newTexts.push({ x: attacker.x, y: attacker.y, text: "PINNED!", color: "#f59e0b", life: 40, id: Math.random() });
          }
        }
      });

      nextUnits.forEach(u => {
        if (u.suppression > 0) u.suppression = Math.max(0, u.suppression - 2); 
      });

      setSpottedUnits(currentlySpotted);

      if (hasUpdates || nextUnits.some(u => u.suppression > 0)) {
        setUnits(nextUnits);
      }
      if (newAttacks.length > 0) setAttacks(prev => [...newAttacks, ...prev].slice(0, 20));
      if (newTexts.length > 0) setFloatingTexts(prev => [...prev, ...newTexts]);

    }, 200);

    return () => clearInterval(reflexInterval);
  }, [isPlaying]);

  // AI 循环 (保持不变)
  const runAiLoop = async () => {
    if (!isPlaying) return;
    setNetStatus('SENDING');
    try {
      const activeUnits = units.filter(u => u.status === 'ALIVE').map(u => ({
          id: u.id, team: u.team, role: u.role, pos: {x: u.x, y: u.y}, hp: u.hp, suppression: u.suppression
      }));
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

  // 动画循环
  useEffect(() => {
    let frame: number;
    const animate = () => {
      setUnits(prev => prev.map(u => {
        if (u.status === 'DEAD') return u;
        const target = targetsRef.current[u.id];
        if (!target) return u;
        const dx = target.x - u.x; const dy = target.y - u.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return { ...u, x: target.x, y: target.y };
        
        const isSuppressed = (u.suppression || 0) > 50;
        const speed = isSuppressed ? BASE_SPEED * 0.5 : BASE_SPEED;

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

  // === 🖥️ 布局重构 ===
  return (
    <main className="flex h-screen w-full bg-[#020617] text-slate-300 font-sans overflow-hidden">
      
      {/* === 左侧：游戏视口 === */}
      <div className="flex-1 relative flex flex-col">
        {/* 顶部工具栏 */}
        <div className="h-14 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between px-6 z-20">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="text-emerald-500" />
            TACTICAL OPS <span className="text-[10px] bg-emerald-900 px-2 rounded">5v5 SQUAD</span>
            {netStatus === 'SENDING' && <span className="text-[10px] bg-blue-900 text-blue-200 px-2 rounded animate-pulse flex items-center gap-1"><Wifi size={10}/> AI</span>}
          </h1>
          <button onClick={() => setIsPlaying(!isPlaying)} className="px-6 py-1.5 font-bold rounded bg-indigo-600 text-white hover:bg-indigo-500">
            {isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? "PAUSE" : "START"}
          </button>
        </div>

        {/* 游戏画布 */}
        <div className="flex-1 bg-[#020617] relative flex items-center justify-center p-4">
           <div className="border border-slate-800 shadow-2xl relative">
             <TacticalViewport 
               units={units} attacks={attacks} obstacles={OBSTACLES} 
               floatingTexts={floatingTexts} thoughts={thoughts} 
               moveLines={moveLines} spottedUnits={spottedUnits} 
               mapSize={MAP_SIZE} 
             />
           </div>
        </div>
      </div>

      {/* === 右侧：战术数据面板 (Sidebar) === */}
      <div className="w-80 bg-[#0f172a] border-l border-slate-800 flex flex-col z-30">
        
        {/* 蓝队列表 */}
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
                 {/* HP Bar */}
                 <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-1">
                   <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(u.hp/u.maxHp)*100}%` }}/>
                 </div>
                 {/* Suppression Bar */}
                 <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden flex justify-between items-center">
                    <div className="h-full bg-yellow-500 transition-all" style={{ width: `${u.suppression}%` }}/>
                 </div>
                 {u.hp < 350 && u.status !== 'DEAD' && (
                   <div className="absolute right-2 top-8 text-red-500 animate-pulse"><HeartPulse size={14}/></div>
                 )}
               </div>
             ))}
           </div>
        </div>

        {/* 红队列表 */}
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
                 {u.hp < 350 && u.status !== 'DEAD' && (
                   <div className="absolute right-2 top-8 text-red-500 animate-pulse"><HeartPulse size={14}/></div>
                 )}
               </div>
             ))}
           </div>
        </div>

      </div>
    </main>
  );
}