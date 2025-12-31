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
          timerRef.current = setTimeout(runGameLoop, 8000); 
      }
    }
  };

  useEffect(() => {
    runGameLoop();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    // 浅色背景，深色文字，移除所有深色纹理层
    <main className="flex h-screen w-full bg-gray-50 text-gray-800 font-mono overflow-hidden relative">
      
      {/* 🔴 左侧：红方 (物种 A) - 浅红配色 */}
      <div className="w-1/3 border-r border-gray-200 p-6 flex flex-col bg-white">
        <div className="mb-6 border-b border-gray-100 pb-4">
            <h2 className="text-3xl font-black text-red-700 tracking-tighter flex items-center gap-2">
                <Swords size={32} className="text-red-600"/> 深红军团
            </h2>
            <div className="text-xs text-gray-500 font-bold mt-1">AI-MODEL: RED BRAIN</div>
        </div>
        
        {/* 血条 A - 柔和红色 */}
        <div className="mb-8 p-4 bg-red-50/50 rounded-xl">
            <div className="flex justify-between text-red-700 font-bold mb-2 text-sm">
                <span>种群数量</span>
                <span>{gameState.speciesA.population}</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesA.population / 200)}%`}}></div>
            </div>
        </div>

        {/* 特征墙 A - 浅色标签 */}
        <div className="flex-1 overflow-hidden">
            <h3 className="text-sm text-gray-600 mb-3 font-bold flex gap-2 items-center"><Dna size={16}/> 进化特征</h3>
            <div className="flex flex-wrap gap-2 content-start">
                {gameState.speciesA.traits.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-md font-medium">
                        {t}
                    </span>
                ))}
            </div>
        </div>
      </div>

      {/* 🟢 中间：环境与日志 (裁判) - 纯白背景 */}
      <div className="w-1/3 flex flex-col border-r border-gray-200 bg-white z-10 shadow-sm">
        {/* 顶部环境卡片 - 极浅灰背景 */}
        <div className="h-40 bg-gray-50 border-b border-gray-200 p-6 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-bold">Current Environment</div>
            <div className="text-2xl text-gray-800 font-black flex items-center gap-3">
                <span className="text-yellow-500">
                {gameState.environment.type.includes('冰') ? <Snowflake/> : 
                 gameState.environment.type.includes('火') ? <Flame/> : 
                 gameState.environment.type.includes('毒') ? <Biohazard/> : <Zap/>}
                 </span>
                {gameState.environment.type}
            </div>
            <div className="text-xs text-gray-500 mt-2 bg-white px-3 py-1 rounded-full border">强度等级: {gameState.environment.severity}</div>
            {netStatus === 'BATTLE' && <div className="mt-2 text-xs text-green-600 animate-pulse font-bold">正在推演战局...</div>}
        </div>

        {/* 滚动日志 - 浅色条目 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-white" ref={scrollRef}>
            {logs.map((log, i) => {
                const isRedWin = log.includes("红方胜");
                const isBlueWin = log.includes("蓝方胜");
                const isNarrative = log.startsWith(">");
                const isRedMove = log.includes("红方进化");
                const isBlueMove = log.includes("蓝方进化");
                
                return (
                    <div key={i} className={`
                        text-sm leading-relaxed border-l-4 pl-3 py-2 rounded-r-md font-medium
                        ${isRedWin ? 'border-red-500 text-red-800 bg-red-50' : ''}
                        ${isBlueWin ? 'border-blue-500 text-blue-800 bg-blue-50' : ''}
                        ${isNarrative ? 'border-gray-400 text-gray-600 italic bg-gray-50 font-normal' : ''}
                        ${isRedMove ? 'border-red-300 text-red-600 text-xs bg-white' : ''}
                        ${isBlueMove ? 'border-blue-300 text-blue-600 text-xs bg-white' : ''}
                        ${!isRedWin && !isBlueWin && !isNarrative && !isRedMove && !isBlueMove ? 'border-gray-300 text-gray-500 text-xs bg-white' : ''}
                    `}>
                        {log}
                    </div>
                );
            })}
        </div>
      </div>

      {/* 🔵 右侧：蓝方 (物种 B) - 浅蓝配色 */}
      <div className="w-1/3 p-6 flex flex-col bg-white text-right">
        <div className="mb-6 border-b border-gray-100 pb-4">
            <h2 className="text-3xl font-black text-blue-700 tracking-tighter flex items-center justify-end gap-2">
                蔚蓝神族 <Shield size={32} className="text-blue-600"/>
            </h2>
            <div className="text-xs text-gray-500 font-bold mt-1">AI-MODEL: BLUE BRAIN</div>
        </div>
        
        {/* 血条 B - 柔和蓝色 */}
        <div className="mb-8 p-4 bg-blue-50/50 rounded-xl">
            <div className="flex justify-between text-blue-700 font-bold mb-2 text-sm flex-row-reverse">
                <span>种群数量</span>
                <span>{gameState.speciesB.population}</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden transform rotate-180">
                <div className="h-full bg-blue-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesB.population / 200)}%`}}></div>
            </div>
        </div>

        {/* 特征墙 B - 浅色标签 */}
        <div className="flex-1 overflow-hidden">
            <h3 className="text-sm text-gray-600 mb-3 font-bold flex gap-2 justify-end items-center">进化特征 <Dna size={16}/></h3>
            <div className="flex flex-wrap gap-2 content-start justify-end">
                {gameState.speciesB.traits.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">
                        {t}
                    </span>
                ))}
            </div>
        </div>
      </div>

      {/* 胜利结算弹窗 - 浅色风格 */}
      {(gameState.speciesA.population <= 0 || gameState.speciesB.population <= 0) && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white border border-gray-200 p-12 text-center rounded-2xl shadow-xl">
                <Trophy size={64} className="text-yellow-500 mx-auto mb-6"/>
                <h1 className="text-4xl font-black text-gray-900 mb-4">演化战争结束</h1>
                <div className="text-2xl mb-10 text-gray-700 font-bold">
                    获胜者: <span className={gameState.speciesA.population > 0 ? "text-red-600" : "text-blue-600"}>
                        {gameState.speciesA.population > 0 ? "深红军团" : "蔚蓝神族"}
                    </span>
                </div>
                <button onClick={() => window.location.reload()} className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-full transition-colors shadow-md">
                    开启新的纪元
                </button>
            </div>
        </div>
      )}

    </main>
  );
}