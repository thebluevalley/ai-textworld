'use client';
import { useState, useEffect, useRef } from 'react';
import { Swords, Shield, Zap, Skull, Flame, Snowflake, Biohazard, Trophy, Activity, Dna } from 'lucide-react';

const INITIAL_STATE = {
  tickCount: 0,
  // 环境
  environment: { 
    type: '原始海洋', 
    severity: 1 
  },
  // 物种 A (玩家/红脑)
  speciesA: {
    name: '深红掠食者',
    population: 10000,
    traits: ['尖刺外壳'],
    status: '备战'
  },
  // 物种 B (对手/蓝脑)
  speciesB: {
    name: '蔚蓝守护者',
    population: 10000,
    traits: ['快速游动'],
    status: '备战'
  },
  eventLog: [
    "系统: 演化战场初始化完成。",
    "纪元 0: 两个原始物种同时觉醒了。"
  ]
};

export default function Home() {
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [logs, setLogs] = useState<string[]>(INITIAL_STATE.eventLog);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'BATTLE'>('IDLE');
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);

  const runGameLoop = async () => {
    setNetStatus('BATTLE');

    try {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ gameState: { ...gameState, eventLog: logs } })
      });

      if (res.ok) {
        const data = await res.json();
        const updates = data.stateUpdates || {};
        
        // 更新种群 (血量)
        let popA = Math.max(0, gameState.speciesA.population + (updates.popA_change || 0));
        let popB = Math.max(0, gameState.speciesB.population + (updates.popB_change || 0));
        
        // 更新特征库
        const newTraitsA = [...gameState.speciesA.traits];
        const newTraitsB = [...gameState.speciesB.traits];
        if (updates.newTraitA && !newTraitsA.includes(updates.newTraitA)) newTraitsA.push(updates.newTraitA);
        if (updates.newTraitB && !newTraitsB.includes(updates.newTraitB)) newTraitsB.push(updates.newTraitB);

        // 判定胜负
        let statusA = '存活';
        let statusB = '存活';
        if (popA <= 0) statusA = '灭绝';
        if (popB <= 0) statusB = '灭绝';

        // 日志生成
        const newEntries: string[] = [];
        newEntries.push(`⚔️ 第 ${gameState.tickCount + 1} 回合: ${data.battle_result.winner === 'DRAW' ? '平局' : data.battle_result.winner === 'A' ? '红方胜' : '蓝方胜'}`);
        newEntries.push(`🔴 红方进化: [${updates.newTraitA}]`);
        newEntries.push(`🔵 蓝方进化: [${updates.newTraitB}]`);
        if (data.narrative) newEntries.push(`> ${data.narrative}`);
        
        setLogs(prev => [...prev, ...newEntries]);

        if (statusA !== '灭绝' && statusB !== '灭绝') {
            setGameState(prev => ({
                ...prev,
                environment: data.new_environment || prev.environment,
                speciesA: { ...prev.speciesA, population: popA, traits: newTraitsA, status: statusA },
                speciesB: { ...prev.speciesB, population: popB, traits: newTraitsB, status: statusB },
                tickCount: prev.tickCount + 1
            }));
        } else {
            setLogs(prev => [...prev, `🏆 游戏结束! 胜利者: ${popA > 0 ? '深红掠食者' : '蔚蓝守护者'}`]);
        }
      }
    } catch (e) { console.error(e); } 
    finally {
      setNetStatus('IDLE');
      if (gameState.speciesA.population > 0 && gameState.speciesB.population > 0) {
          timerRef.current = setTimeout(runGameLoop, 8000); // 8秒一回合，给足阅读时间
      }
    }
  };

  useEffect(() => {
    runGameLoop();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <main className="flex h-screen w-full bg-slate-950 font-mono overflow-hidden relative">
      {/* 背景特效 */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,0,0,0.05)_50%,rgba(0,0,255,0.05)_50%)] pointer-events-none"></div>

      {/* 🔴 左侧：红方 (物种 A) */}
      <div className="w-1/3 border-r-4 border-red-900/30 p-6 flex flex-col bg-red-950/10">
        <div className="mb-6 border-b border-red-800 pb-4">
            <h2 className="text-3xl font-black text-red-500 tracking-tighter flex items-center gap-2">
                <Swords size={32}/> 深红军团
            </h2>
            <div className="text-xs text-red-700 font-bold mt-1">AI-MODEL: RED BRAIN</div>
        </div>
        
        {/* 血条 A */}
        <div className="mb-8">
            <div className="flex justify-between text-red-400 font-bold mb-2">
                <span>POPULATION</span>
                <span>{gameState.speciesA.population}</span>
            </div>
            <div className="h-4 bg-red-900/50 rounded-full overflow-hidden border border-red-800">
                <div className="h-full bg-red-600 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesA.population / 200)}%`}}></div>
            </div>
        </div>

        {/* 特征墙 A */}
        <div className="flex-1 overflow-hidden">
            <h3 className="text-sm text-red-400 mb-3 font-bold flex gap-2"><Dna size={16}/> 进化特征</h3>
            <div className="flex flex-wrap gap-2 content-start">
                {gameState.speciesA.traits.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-red-900/40 border border-red-600/50 text-red-300 text-xs rounded-sm">
                        {t}
                    </span>
                ))}
            </div>
        </div>
      </div>

      {/* 🟢 中间：环境与日志 (裁判) */}
      <div className="w-1/3 flex flex-col border-r-4 border-blue-900/30 bg-slate-900 z-10 shadow-2xl">
        {/* 顶部环境卡片 */}
        <div className="h-40 bg-slate-950 border-b border-slate-800 p-6 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-2">Current Environment</div>
            <div className="text-2xl text-yellow-400 font-bold flex items-center gap-3">
                {gameState.environment.type.includes('冰') ? <Snowflake/> : 
                 gameState.environment.type.includes('火') ? <Flame/> : 
                 gameState.environment.type.includes('毒') ? <Biohazard/> : <Zap/>}
                {gameState.environment.type}
            </div>
            <div className="text-xs text-slate-600 mt-2">强度等级: {gameState.environment.severity}</div>
            {netStatus === 'BATTLE' && <div className="mt-2 text-xs text-green-500 animate-pulse">正在推演战局...</div>}
        </div>

        {/* 滚动日志 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-900" ref={scrollRef}>
            {logs.map((log, i) => {
                const isRedWin = log.includes("红方胜");
                const isBlueWin = log.includes("蓝方胜");
                const isNarrative = log.startsWith(">");
                const isRedMove = log.includes("红方进化");
                const isBlueMove = log.includes("蓝方进化");
                
                return (
                    <div key={i} className={`
                        text-sm leading-relaxed border-l-2 pl-3 py-1
                        ${isRedWin ? 'border-red-500 text-red-200 bg-red-900/10' : ''}
                        ${isBlueWin ? 'border-blue-500 text-blue-200 bg-blue-900/10' : ''}
                        ${isNarrative ? 'border-yellow-600 text-yellow-100/80 italic' : ''}
                        ${isRedMove ? 'border-red-800 text-red-400 text-xs' : ''}
                        ${isBlueMove ? 'border-blue-800 text-blue-400 text-xs' : ''}
                        ${!isRedWin && !isBlueWin && !isNarrative && !isRedMove && !isBlueMove ? 'border-slate-700 text-slate-500' : ''}
                    `}>
                        {log}
                    </div>
                );
            })}
        </div>
      </div>

      {/* 🔵 右侧：蓝方 (物种 B) */}
      <div className="w-1/3 p-6 flex flex-col bg-blue-950/10 text-right">
        <div className="mb-6 border-b border-blue-800 pb-4">
            <h2 className="text-3xl font-black text-blue-500 tracking-tighter flex items-center justify-end gap-2">
                蔚蓝神族 <Shield size={32}/>
            </h2>
            <div className="text-xs text-blue-700 font-bold mt-1">AI-MODEL: BLUE BRAIN</div>
        </div>
        
        {/* 血条 B */}
        <div className="mb-8">
            <div className="flex justify-between text-blue-400 font-bold mb-2 flex-row-reverse">
                <span>POPULATION</span>
                <span>{gameState.speciesB.population}</span>
            </div>
            <div className="h-4 bg-blue-900/50 rounded-full overflow-hidden border border-blue-800 transform rotate-180">
                <div className="h-full bg-blue-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesB.population / 200)}%`}}></div>
            </div>
        </div>

        {/* 特征墙 B */}
        <div className="flex-1 overflow-hidden">
            <h3 className="text-sm text-blue-400 mb-3 font-bold flex gap-2 justify-end">进化特征 <Dna size={16}/></h3>
            <div className="flex flex-wrap gap-2 content-start justify-end">
                {gameState.speciesB.traits.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-900/40 border border-blue-600/50 text-blue-300 text-xs rounded-sm">
                        {t}
                    </span>
                ))}
            </div>
        </div>
      </div>

      {/* 胜利结算弹窗 */}
      {(gameState.speciesA.population <= 0 || gameState.speciesB.population <= 0) && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-900 border-2 border-yellow-500 p-10 text-center rounded-xl shadow-2xl">
                <Trophy size={64} className="text-yellow-500 mx-auto mb-4"/>
                <h1 className="text-4xl font-bold text-white mb-2">演化战争结束</h1>
                <div className="text-2xl mb-8">
                    获胜者: <span className={gameState.speciesA.population > 0 ? "text-red-500" : "text-blue-500"}>
                        {gameState.speciesA.population > 0 ? "深红军团" : "蔚蓝神族"}
                    </span>
                </div>
                <button onClick={() => window.location.reload()} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded">
                    重新开始新的纪元
                </button>
            </div>
        </div>
      )}

    </main>
  );
}