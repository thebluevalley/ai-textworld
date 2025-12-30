'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Radio, Activity, ShieldAlert } from 'lucide-react';

const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

const INITIAL_UNITS = [
  { id: 'u1', team: 'A', x: 5, y: 5, targetX: 5, targetY: 5, hp: 100, role: 'SCOUT', color: 0x00ff00 },
  { id: 'u2', team: 'B', x: 15, y: 15, targetX: 15, targetY: 15, hp: 100, role: 'GUARD', color: 0xff0000 },
];

const API_INTERVAL = 2000; 
const MOVE_SPEED = 0.08;   
// 定义地图边界
const MAP_SIZE = 20;
const MAP_PADDING = 0.5; // 稍微留点边距，不要贴着墙走

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [aggression, setAggression] = useState(70);
  const [aiStatus, setAiStatus] = useState<'IDLE' | 'EXECUTING'>('IDLE');
  
  const targetsRef = useRef<Record<string, {x: number, y: number}>>({
    'u1': { x: 5, y: 5 },
    'u2': { x: 15, y: 15 }
  });

  // === 辅助函数：确保坐标在地图内 ===
  const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

  // === AI 循环 ===
  useEffect(() => {
    if (!isPlaying) return;

    const tick = async () => {
      try {
        const currentTargets = units.map(u => ({
          ...u,
          x: targetsRef.current[u.id]?.x || u.x,
          y: targetsRef.current[u.id]?.y || u.y
        }));

        const res = await fetch('/api/game-tick', {
          method: 'POST',
          body: JSON.stringify({ 
            units: currentTargets, 
            config: { aggression } 
          })
        });

        if (!res.ok) return; 

        const data = await res.json();
        
        if (data.actions && data.actions.length > 0) {
          setAiStatus('EXECUTING');
          setTimeout(() => setAiStatus('IDLE'), 500); 

          const newLogs = data.actions.map((a: any) => 
            `[${new Date().toLocaleTimeString().split(' ')[0]}] ${a.unitId}: ${a.thought}`
          );
          setLogs(prev => [...newLogs, ...prev].slice(0, 12));

          // === 核心修复：边界检查 ===
          data.actions.forEach((action: any) => {
            if (action.type === 'MOVE' && action.target) {
              // 强制将目标点限制在 [0.5, 19.5] 之间，确保单位永远在网格内
              const safeX = clamp(action.target.x, MAP_PADDING, MAP_SIZE - MAP_PADDING);
              const safeY = clamp(action.target.y, MAP_PADDING, MAP_SIZE - MAP_PADDING);

              targetsRef.current[action.unitId] = { 
                x: safeX, 
                y: safeY
              };
            }
          });
        }
      } catch (e) {
        console.error("Tick skipped", e);
      }
    };

    tick();
    const interval = setInterval(tick, API_INTERVAL); 
    return () => clearInterval(interval);
  }, [isPlaying, aggression]);

  // === 动画循环 ===
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setUnits(prevUnits => {
        return prevUnits.map(u => {
          const target = targetsRef.current[u.id];
          if (!target) return u;

          const dx = target.x - u.x;
          const dy = target.y - u.y;
          
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            return { ...u, x: target.x, y: target.y };
          }

          return {
            ...u,
            x: u.x + dx * MOVE_SPEED,
            y: u.y + dy * MOVE_SPEED
          };
        });
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  return (
    // 修改背景色为深灰色 bg-[#141414]
    <main className="h-screen w-full bg-[#141414] text-neutral-400 font-mono flex overflow-hidden select-none">
      
      {/* 左侧控制台 */}
      <div className="w-80 flex flex-col border-r border-neutral-800 bg-[#0a0a0a]/80 p-5 gap-6 z-10 backdrop-blur-md shadow-xl">
        <div>
          <h1 className="text-2xl text-white font-bold tracking-tighter flex items-center gap-2">
            <ShieldAlert size={24} className="text-emerald-500"/>
            ECHO_CHAMBER
          </h1>
          <div className="flex items-center justify-between mt-3 p-2 bg-neutral-900/50 rounded-md border border-neutral-800">
            <div className={`text-[10px] font-bold flex items-center gap-2 transition-colors ${
              aiStatus === 'EXECUTING' ? 'text-emerald-400' : 'text-neutral-500'
            }`}>
              <Activity size={14} className={aiStatus === 'EXECUTING' ? 'animate-pulse' : ''}/>
              {aiStatus === 'EXECUTING' ? 'NEURAL NET ACTIVE' : 'STANDBY'}
            </div>
            <div className="text-[10px] font-medium text-neutral-500">tick_rate: 2000ms</div>
          </div>
        </div>
        
        <div className="space-y-3 py-4 border-y border-neutral-800/50">
          <label className="text-xs font-bold text-neutral-400 flex justify-between items-center">
            <span>AGGRESSION BIAS</span>
            <span className={`font-mono ${aggression > 80 ? 'text-red-500' : aggression > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>{aggression}%</span>
          </label>
          <input 
            type="range" min="0" max="100" value={aggression} 
            onChange={(e) => setAggression(Number(e.target.value))}
            className="w-full h-2 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-200 hover:accent-white transition-all"
          />
        </div>

        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={`w-full py-4 flex items-center justify-center gap-3 font-bold transition-all text-sm tracking-[0.2em] rounded-sm ${
            isPlaying 
              ? 'bg-red-950/30 text-red-500 border border-red-900/50 hover:bg-red-900/40 hover:border-red-700' 
              : 'bg-emerald-950/30 text-emerald-500 border border-emerald-900/50 hover:bg-emerald-900/40 hover:border-emerald-700'
          }`}
        >
          {isPlaying ? <Pause size={18}/> : <Play size={18}/>}
          {isPlaying ? "HALT SIMULATION" : "INITIATE SEQUENCE"}
        </button>

        <div className="flex-1 overflow-hidden flex flex-col pt-2">
          <div className="text-xs font-bold text-neutral-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <Radio size={14}/> Tactical Feed
          </div>
          <div className="flex-1 overflow-y-auto text-[10px] space-y-2 pr-2 scrollbar-none font-mono leading-relaxed mask-image-gradient-b">
            {logs.map((log, i) => (
              <div key={i} className="border-l-[3px] border-neutral-800 pl-3 py-1 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 transition-all truncate">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧视口容器 */}
      <div className="flex-1 relative flex flex-col bg-[#141414]">
        <div className="h-10 border-b border-neutral-800 flex items-center px-6 justify-between text-[10px] font-medium text-neutral-600 bg-[#0a0a0a]">
           <span>SECTOR: PRIME_GRID (20x20)</span>
           <span>RENDER: 60 FPS (INTERPOLATED)</span>
        </div>
        
        <div className="flex-1 relative flex items-center justify-center p-8">
           <TacticalViewport units={units} />
        </div>
      </div>

    </main>
  );
}