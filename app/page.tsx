'use client';
import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Cpu, Brain, Users, Radio, Server, Zap, Database } from 'lucide-react';

// === 新设定：高科技研究设施 ===
const INITIAL_STATE = {
  tickCount: 0,
  // 设施状态
  facilityStatus: { 
    integrity: 100, // 结构完整性
    power: 98,      // 能源稳定性
    entropy: 5      // 系统熵值 (混乱度)
  },
  // 研究团队
  crew: [
    { name: 'Dr. Aris', role: 'Lead Scientist', status: 'ACTIVE', focus: 95, stress: 20, location: 'CORE LAB' },
    { name: 'Dr. Beryl', role: 'Quantum Phys', status: 'ACTIVE', focus: 90, stress: 15, location: 'DATA CTR' },
    { name: 'Eng. Tyrell', role: 'Sys Admin', status: 'ACTIVE', focus: 85, stress: 30, location: 'SERVER RM' },
    { name: 'Spec. Vance', role: 'Hardware Ops', status: 'ACTIVE', focus: 90, stress: 25, location: 'POWER GRID' },
    { name: 'Unit 734', role: 'Research Bot', status: 'ONLINE', focus: 100, stress: 0, location: 'HALLWAY' },
  ],
  eventLog: ["SYS: Project Genesis initialized.", "SYS: Tri-Core connection stable.", "SYS: Awaiting experimental data."]
};

export default function Home() {
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [logs, setLogs] = useState<string[]>(INITIAL_STATE.eventLog);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'PROCESSING'>('IDLE');
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);

  // === 全自动循环 (逻辑保持不变，只改变显示) ===
  const runGameLoop = async () => {
    setNetStatus('PROCESSING');

    try {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ gameState: { ...gameState, eventLog: logs } })
      });

      if (res.ok) {
        const data = await res.json();
        
        const updates = data.stateUpdates || {};
        const newCrew = gameState.crew.map(member => {
          const u = updates.crewUpdates?.find((x:any) => x.name === member.name);
          if (u) {
            // 更新专注度和压力值
            const newFocus = Math.max(0, Math.min(100, member.focus + (u.focus || 0)));
            const newStress = Math.max(0, Math.min(100, member.stress + (u.stress || 0)));
            // 如果压力过大，状态变为 INCAPACITATED (丧失工作能力)，而不是死亡
            let newStatus = u.status || member.status;
            if (newStress >= 100) newStatus = 'INCAPACITATED';
            if (newStress < 80 && newStatus === 'INCAPACITATED') newStatus = 'ACTIVE';

            return { ...member, ...u, focus: newFocus, stress: newStress, status: newStatus };
          }
          return member;
        });

        const newFacilityStatus = {
          integrity: Math.max(0, gameState.facilityStatus.integrity + (updates.integrity || 0)),
          power: Math.max(0, gameState.facilityStatus.power + (updates.power || 0)),
          // 熵值增加
          entropy: Math.max(0, Math.min(100, gameState.facilityStatus.entropy + (updates.entropy || 0))),
        };

        const newEntries = [];
        if (data.narrative) newEntries.push(`> ${data.narrative}`);
        if (data.system_action) newEntries.push(`:: CORE PROTOCOL :: ${data.system_action}`);

        setLogs(prev => [...prev, ...newEntries]);
        setGameState(prev => ({
          ...prev,
          crew: newCrew,
          facilityStatus: newFacilityStatus,
          tickCount: prev.tickCount + 1
        }));
      }
    } catch (e) { console.error(e); } 
    finally {
      setNetStatus('IDLE');
      timerRef.current = setTimeout(runGameLoop, 5000);
    }
  };

  useEffect(() => {
    runGameLoop();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // === 新的深灰色系 UI ===
  return (
    // 背景改为深岩灰 slate-900，文字改为冷白 slate-200
    <main className="flex h-screen w-full bg-slate-900 text-slate-200 font-mono overflow-hidden relative bg-[url('/subtle-grid.png')]">
      
      {/* 左侧数据面板 - 深蓝灰色块 */}
      <div className="w-1/3 border-r border-slate-700/50 p-6 flex flex-col gap-6 bg-slate-800/50 backdrop-blur-sm z-10 shadow-xl">
        <div className="flex flex-col gap-1 border-b border-slate-700 pb-4">
          <div className="flex items-center gap-2 text-blue-400">
            <Server size={24} />
            <h1 className="text-xl font-bold tracking-widest">PROJECT: GENESIS</h1>
          </div>
          {/* AI 状态指示灯 - 颜色调整为更现代的风格 */}
          <div className="flex gap-2 mt-2 text-[10px] font-semibold tracking-wider">
            <span className={`px-2 py-1 rounded-sm flex items-center gap-1 ${netStatus==='PROCESSING'?'bg-orange-900/80 text-orange-200 animate-pulse':'bg-slate-700 text-slate-400'}`}>
              <Activity size={10}/> ANOMALY (RED)
            </span>
            <span className={`px-2 py-1 rounded-sm flex items-center gap-1 ${netStatus==='PROCESSING'?'bg-blue-900/80 text-blue-200 animate-pulse':'bg-slate-700 text-slate-400'}`}>
              <Users size={10}/> RESEARCH (BLUE)
            </span>
            <span className={`px-2 py-1 rounded-sm flex items-center gap-1 ${netStatus==='PROCESSING'?'bg-emerald-900/80 text-emerald-200 animate-pulse':'bg-slate-700 text-slate-400'}`}>
              <Radio size={10}/> CORE (VOLC)
            </span>
          </div>
        </div>

        {/* 设施状态监控 - 使用蓝色和橙色 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-slate-400"><ShieldAlert size={14}/> STRUCTURE INTEGRITY</span>
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${gameState.facilityStatus.integrity}%`}}></div></div>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-slate-400"><Zap size={14}/> POWER GRID STABILITY</span>
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{width: `${gameState.facilityStatus.power}%`}}></div></div>
          </div>
          <div className="flex justify-between items-center text-orange-400 text-sm font-bold">
            <span className="flex items-center gap-2"><Database size={14}/> SYSTEM ENTROPY</span>
            <span>{gameState.facilityStatus.entropy.toFixed(1)}%</span>
          </div>
        </div>

        {/* 研究团队名单 - 更干净的卡片设计 */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {gameState.crew.map((c) => {
            const isStressed = c.stress > 70;
            const isDown = c.status !== 'ACTIVE' && c.status !== 'ONLINE';
            return (
            <div key={c.name} className={`p-3 rounded-md flex justify-between items-center border transition-all ${isDown ? 'border-orange-900/50 bg-orange-900/10 text-orange-300' : 'border-slate-700 bg-slate-800/80'}`}>
              <div>
                <div className="font-bold text-sm flex items-center gap-2">
                  {c.role.includes('Bot') ? <Cpu size={14}/> : <Users size={14}/>} {c.name}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{c.role} | <span className="text-blue-300">{c.location}</span></div>
              </div>
              <div className="text-right text-xs flex flex-col gap-1">
                <div className="text-blue-400">FOCUS: {c.focus}%</div>
                <div className={`${isStressed ? 'text-orange-400 font-bold' : 'text-slate-400'}`}>STRESS: {c.stress}%</div>
                {isDown && <div className="text-[10px] text-orange-500 font-bold mt-1">{c.status}</div>}
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* 右侧日志瀑布 - 更清晰的字体和颜色 */}
      <div className="flex-1 p-8 overflow-y-auto font-mono text-lg leading-relaxed bg-slate-900 custom-scrollbar" ref={scrollRef}>
        <div className="space-y-6 pb-32">
          {logs.map((log, i) => {
            // 系统提示用冷蓝色
            const isSystem = log.startsWith("::") || log.startsWith("SYS:");
            // 叙事文本用灰白色
            const isNarrative = log.startsWith(">");
            // 对话文本（如果有的话）用浅蓝色
            const isDialogue = log.includes("]:");
            return (
              <div key={i} className={`
                ${isSystem ? 'text-blue-400 font-bold border-l-2 border-blue-500 pl-4 text-base' : ''}
                ${isNarrative ? 'text-slate-300 italic' : ''}
                ${isDialogue ? 'text-cyan-300 pl-4' : ''}
                ${!isSystem && !isNarrative && !isDialogue ? 'text-slate-500 text-sm' : ''} // 默认灰色
                animate-in fade-in slide-in-from-bottom-1 duration-300
              `}>
                {log}
              </div>
            );
          })}
          {netStatus === 'PROCESSING' && <div className="text-blue-500/70 animate-pulse text-sm">> Analyzing experiment data...</div>}
        </div>
      </div>
    </main>
  );
}