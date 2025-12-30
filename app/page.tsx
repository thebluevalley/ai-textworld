'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, RefreshCw, Crosshair, Shield, Activity, Skull } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

// === 游戏配置 ===
const API_INTERVAL = 2500; // 稍微放慢一点点，给战斗动画留时间
const MOVE_SPEED = 0.05;   

// === 定义职业与属性 ===
const ROLES = {
  LEADER: { hp: 150, range: 4, icon: '★', damage: 20 },
  SNIPER: { hp: 80, range: 8, icon: '▲', damage: 40 },
  ASSAULT: { hp: 120, range: 3, icon: '■', damage: 15 },
  MEDIC: { hp: 100, range: 2, icon: '+', damage: 5 },
};

// === 初始化两个小队 ===
const INITIAL_UNITS = [
  // 蓝队 (Blue Squad)
  { id: 'b1', team: 'BLUE', role: 'LEADER', x: 2, y: 5, hp: 150, maxHp: 150, status: 'ALIVE' },
  { id: 'b2', team: 'BLUE', role: 'SNIPER', x: 1, y: 2, hp: 80, maxHp: 80, status: 'ALIVE' },
  { id: 'b3', team: 'BLUE', role: 'ASSAULT', x: 2, y: 8, hp: 120, maxHp: 120, status: 'ALIVE' },
  // 红队 (Red Squad)
  { id: 'r1', team: 'RED', role: 'LEADER', x: 18, y: 15, hp: 150, maxHp: 150, status: 'ALIVE' },
  { id: 'r2', team: 'RED', role: 'SNIPER', x: 19, y: 18, hp: 80, maxHp: 80, status: 'ALIVE' },
  { id: 'r3', team: 'RED', role: 'ASSAULT', x: 18, y: 12, hp: 120, maxHp: 120, status: 'ALIVE' },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [aiStatus, setAiStatus] = useState<'IDLE' | 'ANALYZING' | 'COMBAT'>('IDLE');
  
  // 存储攻击线效果: { from: {x,y}, to: {x,y}, color: number, timestamp: number }
  const [attacks, setAttacks] = useState<any[]>([]);

  const targetsRef = useRef<Record<string, {x: number, y: number}>>({});
  
  // 初始化 targets
  useEffect(() => {
    units.forEach(u => {
      targetsRef.current[u.id] = { x: u.x, y: u.y };
    });
  }, []);

  // === AI 核心循环 ===
  useEffect(() => {
    if (!isPlaying) return;

    const tick = async () => {
      // 检查是否有一方全灭
      const blueAlive = units.some(u => u.team === 'BLUE' && u.hp > 0);
      const redAlive = units.some(u => u.team === 'RED' && u.hp > 0);
      if (!blueAlive || !redAlive) {
        setIsPlaying(false);
        setLogs(prev => [{ text: `WARGAMES ENDED. ${blueAlive ? 'BLUE' : 'RED'} TEAM WINS.`, type: 'SYSTEM' }, ...prev]);
        return;
      }

      try {
        setAiStatus('ANALYZING');
        
        // 只发送活着的单位给 AI
        const activeUnits = units.map(u => ({
          ...u,
          x: targetsRef.current[u.id]?.x || u.x,
          y: targetsRef.current[u.id]?.y || u.y
        })).filter(u => u.status === 'ALIVE');

        const res = await fetch('/api/game-tick', {
          method: 'POST',
          body: JSON.stringify({ units: activeUnits })
        });

        if (!res.ok) return; 

        const data = await res.json();
        
        if (data.actions && data.actions.length > 0) {
          setAiStatus('COMBAT');
          setTimeout(() => setAiStatus('IDLE'), 1000);

          // 处理所有动作
          const currentTickAttacks: any[] = [];
          
          const newLogs = data.actions.map((a: any) => {
            // 1. 处理移动
            if (a.type === 'MOVE' && a.target) {
               targetsRef.current[a.unitId] = { 
                x: Math.max(0.5, Math.min(19.5, a.target.x)), 
                y: Math.max(0.5, Math.min(19.5, a.target.y))
              };
              return { text: `[MOVE] ${a.unitId}: ${a.thought}`, type: 'MOVE', team: a.team };
            }
            
            // 2. 处理攻击
            if (a.type === 'ATTACK' && a.targetUnitId) {
              const attacker = units.find(u => u.id === a.unitId);
              const target = units.find(u => u.id === a.targetUnitId);
              
              if (attacker && target && target.hp > 0) {
                // 记录攻击线效果
                currentTickAttacks.push({
                  from: { x: attacker.x, y: attacker.y },
                  to: { x: target.x, y: target.y },
                  color: attacker.team === 'BLUE' ? 0x00ffff : 0xff4400, // 蓝光 vs 红光
                  timestamp: Date.now()
                });

                // 扣血逻辑
                const dmg = a.damage || 15;
                setUnits(prev => prev.map(u => {
                  if (u.id === target.id) {
                    const newHp = Math.max(0, u.hp - dmg);
                    return { ...u, hp: newHp, status: newHp <= 0 ? 'DEAD' : 'ALIVE' };
                  }
                  return u;
                }));

                return { text: `[FIRE] ${a.unitId} hits ${target.id} for ${dmg} DMG!`, type: 'ATTACK', team: attacker.team };
              }
            }
            return null;
          }).filter(Boolean);

          setLogs(prev => [...newLogs, ...prev].slice(0, 15));
          setAttacks(currentTickAttacks);
        }
      } catch (e) {
        console.error("Tick skipped", e);
      }
    };

    tick();
    const interval = setInterval(tick, API_INTERVAL); 
    return () => clearInterval(interval);
  }, [isPlaying, units]); // 依赖 units 以便正确结算伤害

  // === 动画循环 ===
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setUnits(prevUnits => {
        return prevUnits.map(u => {
          // 死人不动
          if (u.status === 'DEAD') return u;

          const target = targetsRef.current[u.id];
          if (!target) return u;

          const dx = target.x - u.x;
          const dy = target.y - u.y;
          
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            return { ...u, x: target.x, y: target.y };
          }

          return { ...u, x: u.x + dx * MOVE_SPEED, y: u.y + dy * MOVE_SPEED };
        });
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  const resetGame = () => {
    setIsPlaying(false);
    setUnits(INITIAL_UNITS);
    setLogs([]);
    targetsRef.current = {};
    INITIAL_UNITS.forEach(u => targetsRef.current[u.id] = {x: u.x, y: u.y});
  };

  return (
    // 深蓝色全息背景
    <main className="h-screen w-full bg-[#0b1120] text-slate-300 font-mono flex overflow-hidden select-none">
      
      {/* 左侧 HUD */}
      <div className="w-80 flex flex-col border-r border-slate-700/50 bg-[#0f172a]/90 backdrop-blur-md z-10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-slate-700/50">
          <h1 className="text-xl font-bold tracking-widest text-cyan-400 flex items-center gap-2 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
            <Crosshair size={24}/>
            TACTICAL_OS
          </h1>
          <div className="flex justify-between mt-4">
            <div className="flex items-center gap-2 text-xs font-bold">
               <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_blue]"/> TEAM ALPHA
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
               <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]"/> TEAM BRAVO
            </div>
          </div>
        </div>

        {/* 状态面板 */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* 蓝队状态 */}
          <div className="space-y-1">
            {units.filter(u => u.team === 'BLUE').map(u => (
              <div key={u.id} className={`flex justify-between text-xs p-2 rounded border ${u.hp <= 0 ? 'border-red-900/30 bg-red-950/10 opacity-50' : 'border-blue-900/30 bg-blue-950/20'}`}>
                <span className="font-bold text-blue-400">{u.role} {u.id}</span>
                <span className={u.hp < 30 ? 'text-red-500' : 'text-slate-400'}>{u.hp}/{u.maxHp} HP</span>
              </div>
            ))}
          </div>
          <div className="h-px bg-slate-800 my-2"/>
          {/* 红队状态 */}
          <div className="space-y-1">
            {units.filter(u => u.team === 'RED').map(u => (
              <div key={u.id} className={`flex justify-between text-xs p-2 rounded border ${u.hp <= 0 ? 'border-red-900/30 bg-red-950/10 opacity-50' : 'border-red-900/30 bg-red-950/20'}`}>
                <span className="font-bold text-red-400">{u.role} {u.id}</span>
                <span className={u.hp < 30 ? 'text-red-500' : 'text-slate-400'}>{u.hp}/{u.maxHp} HP</span>
              </div>
            ))}
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="p-4 space-y-2 border-t border-slate-700/50">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-full py-3 flex items-center justify-center gap-2 font-bold text-sm tracking-widest rounded border transition-all ${
              isPlaying 
                ? 'bg-amber-900/20 border-amber-500/50 text-amber-500 hover:bg-amber-900/40' 
                : 'bg-cyan-900/20 border-cyan-500/50 text-cyan-500 hover:bg-cyan-900/40'
            }`}
          >
            {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
            {isPlaying ? "CEASE FIRE" : "ENGAGE"}
          </button>
          
          <button 
            onClick={resetGame}
            className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"
          >
            <RefreshCw size={12}/> RESET SIMULATION
          </button>
        </div>

        {/* 战斗日志 */}
        <div className="h-48 bg-black/40 p-2 font-mono text-[10px] overflow-y-auto border-t border-slate-800">
           {logs.map((log, i) => (
             <div key={i} className={`mb-1 px-1 border-l-2 ${
               log.type === 'ATTACK' ? 'border-amber-500 text-amber-200' : 
               log.team === 'BLUE' ? 'border-blue-500 text-blue-200' : 
               log.team === 'RED' ? 'border-red-500 text-red-200' : 'border-slate-500 text-slate-400'
             }`}>
               {log.text}
             </div>
           ))}
        </div>
      </div>

      {/* 右侧视口 */}
      <div className="flex-1 relative bg-gradient-to-br from-[#0b1120] to-[#1e293b] flex items-center justify-center">
        {/* 背景装饰网格效果 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,138,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,138,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"/>
        
        <div className="relative shadow-2xl shadow-blue-900/20 border border-slate-700/50 bg-[#0f172a]">
           <TacticalViewport units={units} attacks={attacks} />
        </div>
        
        <div className="absolute top-4 right-4 text-[10px] text-slate-500 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1"><Shield size={10}/> ARMOR INTEGRITY</div>
          <div className="flex items-center gap-1"><Activity size={10}/> BIOMETRICS</div>
        </div>
      </div>
    </main>
  );
}