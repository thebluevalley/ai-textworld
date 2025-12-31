'use client';
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Terminal, Activity, AlertTriangle, ShieldAlert, Cpu, HeartPulse, Brain, Skull, Users } from 'lucide-react';

// === 初始游戏状态 ===
const INITIAL_STATE = {
  tickCount: 0,
  isPlaying: false,
  isWaitingForDecision: false, // 决策锁
  
  // 飞船状态
  shipStatus: {
    hull: 100,
    oxygen: 98,
    danger: 10, // 危机值
  },

  // 船员名单 (带有人设)
  crew: [
    { name: 'Capt. Miller', role: 'Commander', status: 'ALIVE', hp: 100, sanity: 90, location: 'BRIDGE', traits: 'Stoic, Decisive' },
    { name: 'Dr. Chen', role: 'Scientist', status: 'ALIVE', hp: 80, sanity: 95, location: 'LAB', traits: 'Curious, Cold' },
    { name: 'Eng. Isaac', role: 'Engineer', status: 'ALIVE', hp: 90, sanity: 60, location: 'ENGINE', traits: 'Anxious, Skilled' },
    { name: 'Sgt. Vance', role: 'Security', status: 'ALIVE', hp: 120, sanity: 80, location: 'ARMORY', traits: 'Aggressive, Loyal' },
    { name: 'Unit 734', role: 'Android', status: 'ALIVE', hp: 200, sanity: 100, location: 'HALLWAY', traits: 'Robotic, Obedient' },
  ],

  // 历史日志 (记忆核心)
  eventLog: [
    "SYSTEM: Protocol Zero Initiated.",
    "SYSTEM: Day 42. Deep space silence.",
    "SYSTEM: Bio-scan active. All crew signs normal."
  ] as string[],

  // 当前待处理的决策
  currentDecision: null as any
};

export default function Home() {
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [logs, setLogs] = useState<string[]>(INITIAL_STATE.eventLog);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'THINKING'>('IDLE');
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 自动滚动日志
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // === 核心循环：叙事生成 ===
  const runGameLoop = async () => {
    if (!gameState.isPlaying || gameState.isWaitingForDecision) return;
    
    setNetStatus('THINKING');

    try {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ gameState: { ...gameState, eventLog: logs } }) // 把记忆发给 AI
      });

      if (res.status === 429) {
        timerRef.current = setTimeout(runGameLoop, 5000);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        
        // 1. 处理状态更新 (State Updates)
        const updates = data.stateUpdates || {};
        const newCrew = gameState.crew.map(member => {
          const memberUpdate = updates.crewUpdates?.find((u:any) => u.name === member.name);
          if (memberUpdate) {
            // 合并属性，处理死亡逻辑
            const newHp = memberUpdate.hp !== undefined ? member.hp + memberUpdate.hp : member.hp;
            const newSanity = memberUpdate.sanity !== undefined ? member.sanity + memberUpdate.sanity : member.sanity;
            const newStatus = newHp <= 0 ? 'DEAD' : (memberUpdate.status || member.status);
            return { ...member, ...memberUpdate, hp: newHp, sanity: newSanity, status: newStatus };
          }
          return member;
        });

        const newShipStatus = {
          hull: Math.max(0, gameState.shipStatus.hull + (updates.hull || 0)),
          oxygen: Math.max(0, gameState.shipStatus.oxygen + (updates.oxygen || 0)),
          danger: Math.max(0, Math.min(100, gameState.shipStatus.danger + (updates.danger || 0))),
        };

        // 2. 处理日志和对话
        const newLogEntries: string[] = [];
        if (data.narrative) newLogEntries.push(`> ${data.narrative}`);
        if (data.dialogues) {
          data.dialogues.forEach((d:any) => newLogEntries.push(`[${d.name}]: "${d.text}"`));
        }

        // 3. 检查是否需要玩家决策
        const decision = data.decision;
        const isDecisionRequired = decision && decision.required;

        setLogs(prev => [...prev, ...newLogEntries]);
        setGameState(prev => ({
          ...prev,
          crew: newCrew,
          shipStatus: newShipStatus,
          isWaitingForDecision: isDecisionRequired,
          currentDecision: decision,
          tickCount: prev.tickCount + 1
        }));

        setNetStatus('IDLE');

        // 如果不需要决策，继续循环；如果需要，暂停等待
        if (!isDecisionRequired) {
          timerRef.current = setTimeout(runGameLoop, 6000); // 6秒一回合，阅读时间
        }
      }
    } catch (e) {
      console.error(e);
      timerRef.current = setTimeout(runGameLoop, 5000);
    }
  };

  // 玩家做出选择
  const handleChoice = (option: any) => {
    // 将玩家的选择写入日志，作为新的“记忆”
    const choiceLog = `:: OVERSEER COMMAND :: ${option.text}`;
    setLogs(prev => [...prev, choiceLog]);
    
    // 恢复运行
    setGameState(prev => ({
      ...prev,
      isWaitingForDecision: false,
      currentDecision: null
    }));
    
    // 立即触发下一轮，让 AI 反应玩家的决定
    setTimeout(runGameLoop, 500); 
  };

  useEffect(() => {
    if (gameState.isPlaying && !gameState.isWaitingForDecision) {
      runGameLoop();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [gameState.isPlaying, gameState.isWaitingForDecision]);

  // === UI 渲染 ===
  return (
    <main className="flex h-screen w-full bg-black text-green-500 font-mono overflow-hidden relative">
      
      {/* 扫描线特效层 */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />

      {/* 左侧：数据监视器 */}
      <div className="w-1/3 border-r border-green-900 p-6 flex flex-col gap-6 bg-black/90 z-10">
        <div className="flex items-center gap-2 border-b border-green-800 pb-4">
          <Terminal size={24} />
          <h1 className="text-xl font-bold tracking-widest">PROTOCOL: OVERSEER</h1>
          {netStatus === 'THINKING' && <span className="animate-pulse text-xs bg-green-900 px-2 py-0.5 rounded">PROCESSING</span>}
        </div>

        {/* 飞船状态 */}
        <div className="space-y-4">
          <h2 className="text-sm text-green-700 font-bold mb-2">SHIP INTEGRITY</h2>
          <div className="flex justify-between items-center">
            <span>HULL</span>
            <div className="w-48 h-3 bg-green-900/30 border border-green-800">
              <div className="h-full bg-green-600" style={{width: `${gameState.shipStatus.hull}%`}}></div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>O2 LEVEL</span>
            <div className="w-48 h-3 bg-green-900/30 border border-green-800">
              <div className="h-full bg-cyan-600" style={{width: `${gameState.shipStatus.oxygen}%`}}></div>
            </div>
          </div>
          <div className="flex justify-between items-center text-red-500">
            <span className="flex items-center gap-2"><AlertTriangle size={14}/> THREAT</span>
            <div className="w-48 h-3 bg-red-900/30 border border-red-800">
              <div className="h-full bg-red-600" style={{width: `${gameState.shipStatus.danger}%`}}></div>
            </div>
          </div>
        </div>

        {/* 船员状态卡片 */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          <h2 className="text-sm text-green-700 font-bold mb-2">CREW VITALS</h2>
          {gameState.crew.map((c) => (
            <div key={c.name} className={`border p-3 flex flex-col gap-1 transition-all ${c.status === 'DEAD' ? 'border-red-900 opacity-50 grayscale' : 'border-green-800 bg-green-900/10'}`}>
              <div className="flex justify-between items-center">
                <span className="font-bold flex items-center gap-2">
                  {c.status === 'DEAD' ? <Skull size={14}/> : <Users size={14}/>} {c.name}
                </span>
                <span className="text-xs bg-green-900 px-1">{c.role}</span>
              </div>
              <div className="flex justify-between text-xs text-green-600 mt-1">
                <span className="flex items-center gap-1"><HeartPulse size={10}/> HP: {c.hp}</span>
                <span className="flex items-center gap-1"><Brain size={10}/> SAN: {c.sanity}</span>
              </div>
              <div className="text-[10px] text-green-700 mt-1">LOC: {c.location} | {c.status}</div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setGameState(prev => ({...prev, isPlaying: !prev.isPlaying}))}
          className="w-full border border-green-500 py-3 hover:bg-green-500 hover:text-black transition-colors font-bold flex items-center justify-center gap-2"
        >
          {gameState.isPlaying ? <Pause size={16}/> : <Play size={16}/>} 
          {gameState.isPlaying ? "PAUSE SIMULATION" : "INITIATE PROTOCOL"}
        </button>
      </div>

      {/* 右侧：剧情日志 (瀑布流) */}
      <div className="flex-1 p-8 overflow-y-auto font-mono text-lg leading-relaxed relative bg-black" ref={scrollRef}>
        <div className="space-y-4 pb-32">
          {logs.map((log, i) => {
            const isSystem = log.startsWith("SYSTEM") || log.startsWith("::");
            const isDialogue = log.startsWith("[");
            const isNarrative = log.startsWith(">");
            
            return (
              <div key={i} className={`
                ${isSystem ? 'text-green-300 opacity-60 text-sm' : ''}
                ${isDialogue ? 'text-cyan-400 pl-4 border-l-2 border-cyan-800' : ''}
                ${isNarrative ? 'text-green-100 italic' : ''}
                transition-opacity duration-500 animate-in fade-in slide-in-from-bottom-2
              `}>
                {log}
              </div>
            );
          })}
          {netStatus === 'THINKING' && (
            <div className="text-green-800 animate-pulse">&gt; Generating narrative data stream...</div>
          )}
        </div>
      </div>

      {/* ⚠️ 决策弹窗 (Overlay) */}
      {gameState.isWaitingForDecision && gameState.currentDecision && (
        <div className="absolute inset-0 bg-black/80 z-40 flex items-center justify-center p-20 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="border-2 border-red-600 bg-black max-w-2xl w-full p-8 shadow-[0_0_50px_rgba(220,38,38,0.3)]">
            <div className="flex items-center gap-3 text-red-500 mb-4 border-b border-red-900 pb-4">
              <ShieldAlert size={32} className="animate-pulse"/>
              <h2 className="text-2xl font-bold tracking-tighter">CRITICAL DECISION REQUIRED</h2>
            </div>
            <h3 className="text-xl text-white mb-2">{gameState.currentDecision.title}</h3>
            <p className="text-red-300 mb-8 text-lg">{gameState.currentDecision.description}</p>
            
            <div className="grid gap-4">
              {gameState.currentDecision.options.map((opt: any) => (
                <button 
                  key={opt.id}
                  onClick={() => handleChoice(opt)}
                  className="text-left border border-red-800 p-4 hover:bg-red-900/50 hover:border-red-500 hover:text-white transition-all group"
                >
                  <span className="font-bold text-red-500 group-hover:text-white mr-3">[{opt.id}]</span>
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}