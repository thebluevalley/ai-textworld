'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Map as MapIcon, Wifi, AlertTriangle, Shield, Skull } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const MOVE_SPEED = 0.008; 
const MAP_SIZE = 30;

// === 🏟️ TACTICAL ARENA ===
const OBSTACLES = [
  { x: 14, y: 10, w: 2, h: 10 }, // Center vertical
  { x: 10, y: 14, w: 10, h: 2 }, // Center horizontal
  { x: 5, y: 5, w: 5, h: 5 },    // Top-left bunker
  { x: 20, y: 20, w: 5, h: 5 },  // Bottom-right bunker
  { x: 2, y: 15, w: 4, h: 1 },   // Flanking wall
  { x: 24, y: 15, w: 4, h: 1 },  // Flanking wall
];

const INITIAL_UNITS = [
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 4, y: 12, hp: 1000, maxHp: 1000, status: 'ALIVE' },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 2, y: 2, hp: 600, maxHp: 600, status: 'ALIVE' },
  { id: 'b3', team: 'BLUE', role: 'ASSAULT', x: 11, y: 4, hp: 900, maxHp: 900, status: 'ALIVE' },
  { id: 'r1', team: 'RED', role: 'LEADER', x: 26, y: 18, hp: 1000, maxHp: 1000, status: 'ALIVE' },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 28, y: 28, hp: 600, maxHp: 600, status: 'ALIVE' },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 19, y: 26, hp: 900, maxHp: 900, status: 'ALIVE' },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [attacks, setAttacks] = useState<any[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]); 
  const [thoughts, setThoughts] = useState<any[]>([]);
  const [moveLines, setMoveLines] = useState<any[]>([]);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'SENDING' | 'COOLING'>('IDLE');
  
  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // === PHYSICS & TACTICS HELPERS ===
  const lineIntersectsRect = (p1: any, p2: any, rect: any) => {
    const rx = rect.x + 0.1; const ry = rect.y + 0.1; const rw = rect.w - 0.2; const rh = rect.h - 0.2;
    const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);
    if (rx > maxX || rx + rw < minX || ry > maxY || ry + rh < minY) return false;
    const steps = 10;
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

  // Check if unit is near cover (bonus defense)
  const isNearCover = (u: any) => {
    for (const obs of OBSTACLES) {
      // Check if within 1.5 tiles of an obstacle
      const distX = Math.max(0, Math.abs(u.x - (obs.x + obs.w/2)) - obs.w/2);
      const distY = Math.max(0, Math.abs(u.y - (obs.y + obs.h/2)) - obs.h/2);
      if (distX < 1.5 && distY < 1.5) return true;
    }
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
             if (dist < 8) return true; 
             return dist < 35 && checkLineOfSight(u, other);
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
          const newMoveLines: any[] = [];
          
          data.actions.forEach((a: any) => {
            const actor = units.find(u => u.id === a.unitId);
            if (!actor || actor.status === 'DEAD') return;

            if (a.thought) newThoughts.push({ x: actor.x, y: actor.y, text: a.thought, team: actor.team, id: Math.random() });

            if (a.type === 'ATTACK' && a.targetUnitId) {
              const target = units.find(u => u.id === a.targetUnitId);
              if (target && target.hp > 0) {
                // Calculate Hit Chance & Damage
                let hitChance = 0.85;
                let damageMultiplier = 1.0;
                
                // Cover Bonus
                if (isNearCover(target)) {
                   damageMultiplier = 0.5; // 50% damage reduction in cover
                   hitChance = 0.7; // Harder to hit
                }

                const isHit = Math.random() < hitChance;
                currentTickAttacks.push({
                  from: { x: actor.x, y: actor.y },
                  to: { x: target.x, y: target.y },
                  color: actor.team === 'BLUE' ? 0x60a5fa : 0xf87171,
                  isMiss: !isHit,
                  timestamp: Date.now()
                });

                if (isHit) {
                  let dmg = Math.floor((a.damage || 40) * damageMultiplier);
                  let hitText = `-${dmg}`;
                  
                  if (damageMultiplier < 1.0) {
                     hitText = `🛡️-${dmg}`; // Show shield icon for cover hits
                  }

                  newTexts.push({ x: target.x, y: target.y, text: hitText, color: damageMultiplier < 1 ? "#93c5fd" : "#fff", id: Math.random() });
                  setUnits(prev => prev.map(u => {
                    if (u.id === target.id) {
                      const newHp = Math.max(0, u.hp - dmg);
                      return { ...u, hp: newHp, status: newHp <= 0 ? 'DEAD' : 'ALIVE' };
                    }
                    return u;
                  }));
                  newLogs.push({ text: `${actor.id} hit ${target.id} (${damageMultiplier < 1 ? 'Cover' : 'Open'})`, team: actor.team });
                } else {
                  newTexts.push({ x: target.x, y: target.y, text: "MISS", color: "#fbbf24", id: Math.random() });
                }
              }
            }
            else if (a.type === 'MOVE' && a.target) {
              const tx = Math.max(1, Math.min(MAP_SIZE-1, a.target.x));
              const ty = Math.max(1, Math.min(MAP_SIZE-1, a.target.y));
              targetsRef.current[a.unitId] = { x: tx, y: ty };
              newMoveLines.push({ from: {x: actor.x, y: actor.y}, to: {x: tx, y: ty}, color: actor.team === 'BLUE' ? 0x60a5fa : 0xf87171 });
            }
          });
          setLogs(prev => [...newLogs, ...prev].slice(0, 10));
          setAttacks(currentTickAttacks);
          setFloatingTexts(prev => [...prev, ...newTexts]);
          setThoughts(newThoughts);
          setMoveLines(newMoveLines);
        }
        timerRef.current = setTimeout(runGameLoop, 2000);
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
          <Shield className="text-emerald-500" />
          SMART WARGAME <span className="text-[10px] bg-emerald-900 px-2 rounded">COVER SYSTEM ACTIVE</span>
          {netStatus === 'SENDING' && <span className="text-[10px] bg-blue-900 text-blue-200 px-2 rounded animate-pulse flex items-center gap-1"><Wifi size={10}/> AI THINKING</span>}
        </h1>
        <button onClick={() => setIsPlaying(!isPlaying)} className="px-6 py-1.5 font-bold rounded bg-indigo-600 text-white hover:bg-indigo-500">
          {isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? "PAUSE" : "START BATTLE"}
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#020617] pt-14">
        <div className="border border-slate-800 shadow-2xl relative">
           <TacticalViewport 
             units={units} attacks={attacks} obstacles={OBSTACLES} floatingTexts={floatingTexts} 
             thoughts={thoughts} moveLines={moveLines} mapSize={MAP_SIZE} 
           />
        </div>
        <div className="absolute bottom-4 left-4 w-96 bg-slate-900/90 p-3 rounded border border-slate-700 pointer-events-none">
           <div className="space-y-1 max-h-32 overflow-y-auto">
             {logs.map((log, i) => (
               <div key={i} className={`text-[10px] font-mono ${log.team === 'BLUE' ? 'text-blue-400' : 'text-red-400'}`}>{log.text}</div>
             ))}
           </div>
        </div>
      </div>
    </main>
  );
}