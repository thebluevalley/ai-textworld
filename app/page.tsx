'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Map as MapIcon, Wifi, AlertTriangle, Cpu, Crosshair } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const MOVE_SPEED = 0.008; 
const MAP_SIZE = 30;

// === ⚔️ 武器参数 (算法层) ===
const WEAPON_STATS: any = {
  SNIPER:  { range: 25, damage: 120, cooldown: 3000, accuracy: 0.95 }, // 攻速慢，伤害极高
  ASSAULT: { range: 8,  damage: 25,  cooldown: 800,  accuracy: 0.80 }, // 攻速快，突突突
  LEADER:  { range: 12, damage: 40,  cooldown: 1200, accuracy: 0.85 },
  MEDIC:   { range: 6,  damage: 15,  cooldown: 1000, accuracy: 0.70 },
};

const OBSTACLES = [
  { x: 14, y: 10, w: 2, h: 10 }, { x: 10, y: 14, w: 10, h: 2 },
  { x: 5, y: 5, w: 5, h: 5 }, { x: 20, y: 20, w: 5, h: 5 },
  { x: 2, y: 15, w: 4, h: 1 }, { x: 24, y: 15, w: 4, h: 1 },
];

const INITIAL_UNITS = [
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 4, y: 12, hp: 1000, maxHp: 1000, status: 'ALIVE', lastShot: 0 },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 2, y: 2, hp: 600, maxHp: 600, status: 'ALIVE', lastShot: 0 },
  { id: 'b3', team: 'BLUE', role: 'ASSAULT', x: 11, y: 4, hp: 900, maxHp: 900, status: 'ALIVE', lastShot: 0 },
  { id: 'r1', team: 'RED', role: 'LEADER', x: 26, y: 18, hp: 1000, maxHp: 1000, status: 'ALIVE', lastShot: 0 },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 28, y: 28, hp: 600, maxHp: 600, status: 'ALIVE', lastShot: 0 },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 19, y: 26, hp: 900, maxHp: 900, status: 'ALIVE', lastShot: 0 },
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
  const unitsRef = useRef(units); // 用于反射循环的最新状态引用
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 同步 Ref
  useEffect(() => { unitsRef.current = units; }, [units]);
  useEffect(() => {
    units.forEach(u => targetsRef.current[u.id] = { x: u.x, y: u.y });
  }, []);

  // === 📐 物理引擎 ===
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

  // === ⚡️ 算法反射层 (Reflex Engine) ===
  // 这是一个高频循环，处理“看见就打”的低级智能
  useEffect(() => {
    if (!isPlaying) return;

    const reflexInterval = setInterval(() => {
      const currentUnits = unitsRef.current; // 使用 Ref 获取最新状态，避免闭包陷阱
      const now = Date.now();
      const newAttacks: any[] = [];
      const newTexts: any[] = [];
      let hasUpdates = false;

      // 创建一个副本进行修改
      const nextUnits = currentUnits.map(u => ({ ...u }));

      nextUnits.forEach(attacker => {
        if (attacker.status === 'DEAD') return;

        const stats = WEAPON_STATS[attacker.role] || WEAPON_STATS['ASSAULT'];

        // 检查冷却
        if (now - (attacker.lastShot || 0) < stats.cooldown) return;

        // 寻找目标 (最近的、可见的敌人)
        let bestTarget: any = null;
        let minDist = Infinity;

        nextUnits.forEach(target => {
          if (target.team === attacker.team || target.status === 'DEAD') return;

          const dist = Math.sqrt(Math.pow(attacker.x - target.x, 2) + Math.pow(attacker.y - target.y, 2));
          
          if (dist <= stats.range) {
            // 距离判定通过，检查视线 (距离极近则无视墙体)
            if (dist < 4 || checkLineOfSight(attacker, target)) {
              if (dist < minDist) {
                minDist = dist;
                bestTarget = target;
              }
            }
          }
        });

        // 如果找到目标，自动开火
        if (bestTarget) {
          attacker.lastShot = now; // 重置冷却
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
            // 暴击逻辑
            if (Math.random() > 0.85) { dmg = Math.floor(dmg * 1.5); }
            
            bestTarget.hp = Math.max(0, bestTarget.hp - dmg);
            if (bestTarget.hp === 0) bestTarget.status = 'DEAD';
            
            newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: `-${dmg}`, color: "#fff", id: Math.random() });
          } else {
            newTexts.push({ x: bestTarget.x, y: bestTarget.y, text: "MISS", color: "#fbbf24", id: Math.random() });
          }
        }
      });

      if (hasUpdates) {
        setUnits(nextUnits);
        if (newAttacks.length > 0) setAttacks(prev => [...newAttacks, ...prev].slice(0, 20)); // 保留最近20次
        if (newTexts.length > 0) setFloatingTexts(prev => [...prev, ...newTexts]);
      }

    }, 200); // ⚡️ 每 200ms 运行一次反射循环 (5 FPS)

    return () => clearInterval(reflexInterval);
  }, [isPlaying]);


  // === 🧠 大模型战术层 (Cortex Engine) ===
  const runAiLoop = async () => {
    if (!isPlaying) return;
    setNetStatus('SENDING');

    try {
      // 只需要发送位置和状态，不需要发 visibleEnemies 了，因为 AI 专注走位
      const activeUnits = units.filter(u => u.status === 'ALIVE').map(u => ({
         id: u.id, team: u.team, role: u.role, pos: {x: u.x, y: u.y}, hp: u.hp
      }));

      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ units: activeUnits, obstacles: OBSTACLES, mapSize: MAP_SIZE })
      });

      if (res.status === 429) {
        setNetStatus('COOLING');
        timerRef.current = setTimeout(runAiLoop, 10000);
        return;
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

            // AI 现在主要负责 MOVE 和 战术思考
            if (a.thought) newThoughts.push({ x: actor.x, y: actor.y, text: a.thought, team: actor.team, id: Math.random() });

            if (a.type === 'MOVE' && a.target) {
              const tx = Math.max(1, Math.min(MAP_SIZE-1, a.target.x));
              const ty = Math.max(1, Math.min(MAP_SIZE-1, a.target.y));
              targetsRef.current[a.unitId] = { x: tx, y: ty };
              newMoveLines.push({ from: {x: actor.x, y: actor.y}, to: {x: tx, y: ty}, color: actor.team === 'BLUE' ? 0x60a5fa : 0xf87171 });
            }
            // 注意：我们忽略 AI 的 ATTACK 指令，因为反射层已经处理了
          });
          setThoughts(newThoughts);
          setMoveLines(newMoveLines);
        }
        timerRef.current = setTimeout(runAiLoop, 3000); // AI 思考频率可以慢一点
      } else {
        timerRef.current = setTimeout(runAiLoop, 5000);
      }
    } catch (e) {
      console.error(e);
      timerRef.current = setTimeout(runAiLoop, 5000);
    }
  };

  useEffect(() => {
    if (isPlaying) { runAiLoop(); } 
    else { if (timerRef.current) clearTimeout(timerRef.current); setNetStatus('IDLE'); }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying]);

  // 物理移动循环 (保持不变)
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
          <Cpu className="text-cyan-500" />
          HYBRID ENGINE <span className="text-[10px] bg-cyan-900 px-2 rounded">REFLEX+CORTEX</span>
          {netStatus === 'SENDING' && <span className="text-[10px] bg-blue-900 text-blue-200 px-2 rounded animate-pulse flex items-center gap-1"><Wifi size={10}/> AI STRATEGY</span>}
        </h1>
        <button onClick={() => setIsPlaying(!isPlaying)} className="px-6 py-1.5 font-bold rounded bg-indigo-600 text-white hover:bg-indigo-500">
          {isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? "PAUSE" : "START SIM"}
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
           <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Crosshair size={10}/> AUTO-ENGAGE LOG</div>
           <div className="space-y-0.5 max-h-32 overflow-y-auto">
             {floatingTexts.slice(-5).map((t, i) => (
               <div key={i} className="text-[10px] text-slate-400">HIT at {Math.round(t.x)},{Math.round(t.y)}: {t.text}</div>
             ))}
           </div>
        </div>
      </div>
    </main>
  );
}