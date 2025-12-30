'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Database } from 'lucide-react';

// 动态导入 PixiJS 组件
const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

// 初始数据
const INITIAL_UNITS = [
  { id: 'u1', team: 'A', x: 5, y: 5, hp: 100, role: 'scout' },
  { id: 'u2', team: 'B', x: 15, y: 15, hp: 100, role: 'guard' },
];

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false); // 默认暂停，让用户点击开始
  const [logs, setLogs] = useState<string[]>([]);
  const [aggression, setAggression] = useState(50);
  const [lastSync, setLastSync] = useState<string>('Offline');

  // === 核心游戏循环 ===
  useEffect(() => {
    if (!isPlaying) return;

    const tick = async () => {
      try {
        const res = await fetch('/api/game-tick', {
          method: 'POST',
          body: JSON.stringify({ units, config: { aggression } })
        });
        const data = await res.json();
        
        if (data.actions && data.actions.length > 0) {
          // 更新日志
          const newLogs = data.actions.map((a: any) => 
            `[${new Date().toISOString().slice(14,23)}] UNIT_${a.unitId}: ${a.type} -> (${a.target.x}, ${a.target.y}) > ${a.thought}`
          );
          setLogs(prev => [...newLogs, ...prev].slice(0, 50));

          // 更新单位位置 (简单实现)
          setUnits(prev => prev.map(u => {
            const action = data.actions.find((a: any) => a.unitId === u.id);
            if (action && action.type === 'MOVE') {
              return { ...u, x: action.target.x, y: action.target.y };
            }
            return u;
          }));
          
          setLastSync(new Date().toLocaleTimeString());
        }
      } catch (e) {
        console.error("Tick failed", e);
      }
    };

    const interval = setInterval(tick, 3000); // 每3秒一回合
    return () => clearInterval(interval);
  }, [isPlaying, units, aggression]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-400 font-mono p-6 flex gap-6">
      
      {/* LEFT: Neural Dashboard */}
      <div className="w-80 flex flex-col gap-6 border-r border-neutral-800 pr-6">
        <h1 className="text-2xl text-white tracking-widest font-bold">ECHO_CHAMBER</h1>
        
        <div className="space-y-4 p-4 border border-neutral-800 bg-neutral-900/50">
          <div className="flex justify-between text-xs uppercase text-neutral-500">
            <span>System Status</span>
            <span className={isPlaying ? "text-emerald-500" : "text-amber-500"}>
              {isPlaying ? "ONLINE" : "STANDBY"}
            </span>
          </div>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-full flex items-center justify-center gap-2 bg-neutral-100 text-black py-2 hover:bg-neutral-300 transition"
          >
            {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
            {isPlaying ? "HALT SEQUENCE" : "INITIATE"}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase">Aggression Bias: {aggression}%</label>
          <input 
            type="range" 
            min="0" max="100" 
            value={aggression} 
            onChange={(e) => setAggression(Number(e.target.value))}
            className="w-full h-1 bg-neutral-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white"
          />
        </div>

        <div className="mt-auto text-xs text-neutral-600 flex items-center gap-2">
           <Database size={12} /> SYNC: {lastSync}
        </div>
      </div>

      {/* CENTER: Viewport */}
      <div className="flex-1 border border-neutral-800 relative bg-black overflow-hidden flex items-center justify-center">
        <div className="absolute top-4 left-4 text-xs text-neutral-600">SECTOR_VIEW: 20x20</div>
        <TacticalViewport units={units} />
      </div>

      {/* BOTTOM: Stream (Visual Only here, in reality placed below or side) */}
      <div className="w-64 border-l border-neutral-800 pl-6 flex flex-col overflow-hidden">
        <div className="text-xs uppercase mb-4 text-neutral-500">Neural Stream</div>
        <div className="flex-1 overflow-y-auto space-y-2 mask-linear">
          {logs.map((log, i) => (
            <div key={i} className="text-[10px] leading-tight border-l-2 border-neutral-800 pl-2 text-neutral-500 hover:text-emerald-500 transition-colors cursor-default">
              {log}
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}