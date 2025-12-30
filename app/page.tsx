'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, Radio, Activity } from 'lucide-react';

// 动态导入 PixiJS 组件，禁用 SSR
const TacticalViewport = dynamic(() => import('./components/TacticalViewport'), { ssr: false });

// 初始数据
const INITIAL_UNITS = [
  { id: 'u1', team: 'A', x: 5, y: 5, targetX: 5, targetY: 5, hp: 100, role: '猎手', color: 0x00ff00 },
  { id: 'u2', team: 'B', x: 15, y: 15, targetX: 15, targetY: 15, hp: 100, role: '守卫', color: 0xff0000 },
];

// === 核心配置区 ===
const API_INTERVAL = 2000; // 2秒心跳 (利用多Key轮询实现高频)
const MOVE_SPEED = 0.08;   // 移动平滑系数 (数值越大移动越快，0.08 适合 2秒的节奏)

export default function Home() {
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [aggression, setAggression] = useState(70);
  const [aiStatus, setAiStatus] = useState<'IDLE' | 'THINKING' | 'EXECUTING'>('IDLE');
  
  // 使用 Ref 存储最新的目标点，供动画循环读取，避免闭包陷阱
  const targetsRef = useRef<Record<string, {x: number, y: number}>>({
    'u1': { x: 5, y: 5 },
    'u2': { x: 15, y: 15 }
  });

  // === 1. AI 大脑循环 (高频：2秒一次) ===
  useEffect(() => {
    if (!isPlaying) return;

    const tick = async () => {
      try {
        // 只有在发送请求的那一瞬间显示 THINKING，避免一直闪烁
        // setAiStatus('THINKING'); 

        // 构建请求数据：告诉 AI 单位的"目标位置"，而不是"当前动画位置"
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

        if (!res.ok) return; // 如果所有 Key 都在冷却，静默跳过

        const data = await res.json();
        
        if (data.actions && data.actions.length > 0) {
          setAiStatus('EXECUTING');
          setTimeout(() => setAiStatus('IDLE'), 500); // 0.5秒后恢复空闲状态

          // 更新日志 (只保留最近 10 条，防止高频刷新导致 DOM 压力)
          const newLogs = data.actions.map((a: any) => 
            `[${new Date().toLocaleTimeString()}] ${a.unitId}: ${a.thought}`
          );
          setLogs(prev => [...newLogs, ...prev].slice(0, 10));

          // 更新目标点 Ref
          data.actions.forEach((action: any) => {
            if (action.type === 'MOVE' && action.target) {
              targetsRef.current[action.unitId] = { 
                x: action.target.x, 
                y: action.target.y 
              };
            }
          });
        }
      } catch (e) {
        console.error("Tick skipped", e);
      }
    };

    // 立即执行一次
    tick();
    // 开启循环
    const interval = setInterval(tick, API_INTERVAL); 
    return () => clearInterval(interval);
  }, [isPlaying, aggression]);

  // === 2. 前端动画循环 (60 FPS) ===
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      setUnits(prevUnits => {
        return prevUnits.map(u => {
          const target = targetsRef.current[u.id];
          if (!target) return u;

          const dx = target.x - u.x;
          const dy = target.y - u.y;
          
          // 如果距离极小，吸附
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            return { ...u, x: target.x, y: target.y };
          }

          // 线性插值移动
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
    <main className="h-screen w-full bg-neutral-950 text-neutral-400 font-mono flex overflow-hidden">
      
      {/* 左侧控制台 */}
      <div className="w-72 flex flex-col border-r border-neutral-800 bg-black/50 p-4 gap-6 z-10 backdrop-blur-sm">
        <div>
          <h1 className="text-xl text-white font-bold tracking-tighter">ECHO_CHAMBER</h1>
          <div className="flex items-center justify-between mt-2">
            <div className={`text-[10px] font-bold flex items-center gap-2 px-2 py-1 rounded transition-colors ${
              aiStatus === 'EXECUTING' ? 'bg-emerald-900/50 text-emerald-500' : 'bg-neutral-800 text-neutral-500'
            }`}>
              <Activity size={10} className={aiStatus === 'EXECUTING' ? 'animate-pulse' : ''}/>
              {aiStatus === 'EXECUTING' ? 'AI ACTIVE' : 'STANDBY'}
            </div>
            <div className="text-[10px] text-neutral-600">2s / TICK (FAST)</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-500 flex justify-between">
            <span>战术激进指数</span>
            <span className="text-white">{aggression}%</span>
          </label>
          <input 
            type="range" min="0" max="100" value={aggression} 
            onChange={(e) => setAggression(Number(e.target.value))}
            className="w-full h-1 bg-neutral-800 appearance-none rounded cursor-pointer accent-emerald-500"
          />
        </div>

        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={`w-full py-4 flex items-center justify-center gap-2 font-bold transition-all text-sm tracking-widest ${
            isPlaying 
              ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/50 hover:bg-emerald-500/20'
          }`}
        >
          {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
          {isPlaying ? "HALT SEQUENCE" : "INITIATE SIM"}
        </button>

        <div className="flex-1 overflow-hidden flex flex-col border-t border-neutral-800 pt-4">
          <div className="text-xs font-bold text-neutral-500 mb-3 flex items-center gap-2">
            <Radio size={12}/> TACTICAL LOG
          </div>
          <div className="flex-1 overflow-y-auto text-[10px] space-y-3 pr-2 scrollbar-none font-mono leading-relaxed">
            {logs.map((log, i) => (
              <div key={i} className="border-l-2 border-neutral-800 pl-3 py-1 opacity-70 hover:opacity-100 hover:border-emerald-500 transition-all cursor-crosshair">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧视口 */}
      <div className="flex-1 relative bg-[#0a0a0a] flex flex-col">
        <div className="h-8 border-b border-neutral-800 flex items-center px-4 justify-between text-[10px] text-neutral-600">
           <span>SECTOR_GRID: 20x20</span>
           <span>RENDER: 60 FPS</span>
           <span>LATENCY: 2000ms</span>
        </div>
        
        <div className="flex-1 relative">
           <TacticalViewport units={units} />
        </div>
      </div>

    </main>
  );
}