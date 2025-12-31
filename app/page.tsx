'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  Swords, Shield, Zap, Skull, Flame, Snowflake, Biohazard, Trophy, 
  Activity, Dna, Leaf, Heart, Search, CloudRain, Sun, Wind, ArrowUp, ArrowDown
} from 'lucide-react';

// === 初始状态 ===
const INITIAL_STATE = {
  tickCount: 0,
  // 环境
  environment: { 
    type: '丰饶平原', 
    resourceLevel: 8 
  },
  // 物种 A (红)
  speciesA: {
    name: '赤红行军蚁',
    population: 5000,
    food: 5000, 
    traits: ['群体协作'],
    action: 'OBSERVING', 
    status: 'STABLE'
  },
  // 物种 B (蓝)
  speciesB: {
    name: '蓝纹硬壳蟹',
    population: 5000,
    food: 5000,
    traits: ['几丁质甲壳'],
    action: 'OBSERVING',
    status: 'STABLE'
  },
  // 日志结构升级：不再是纯字符串，而是对象
  eventLog: [
    { type: 'SYSTEM', text: '系统: 生态监测链路已连接。', changes: null },
    { type: 'SYSTEM', text: '纪元 0: 投放初始物种样本，环境参数稳定。', changes: null }
  ] as LogEntry[]
};

// 定义日志类型
type LogEntry = {
    type: 'NARRATIVE' | 'BATTLE' | 'EVOLVE' | 'SYSTEM';
    text: string;
    changes?: {
        species: 'A' | 'B';
        popChange: number;
        foodChange: number;
    } | null;
};

export default function Home() {
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_STATE.eventLog);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'SIMULATING'>('IDLE');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 移除自动滚动 Ref，因为新消息在顶部

  const runGameLoop = async () => {
    setNetStatus('SIMULATING');

    try {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ gameState: { ...gameState, eventLog: logs.map(l => l.text) } }) // 只发文本给AI
      });

      if (res.ok) {
        const data = await res.json();
        const updates = data.stateUpdates || {};
        const upA = updates.speciesA || {};
        const upB = updates.speciesB || {};
        
        // 计算新状态
        const updateSpecies = (prevSpec: any, update: any, actionData: any) => {
            let newPop = Math.max(0, prevSpec.population + (update.popChange || 0));
            let newFood = Math.max(0, prevSpec.food + (update.foodChange || 0));
            let newTraits = [...prevSpec.traits];
            if (update.newTrait && !newTraits.includes(update.newTrait)) newTraits.push(update.newTrait);
            
            return {
                ...prevSpec,
                population: newPop,
                food: newFood,
                traits: newTraits,
                action: actionData?.action || 'IDLE'
            };
        };

        const newSpecA = updateSpecies(gameState.speciesA, upA, data.redAction);
        const newSpecB = updateSpecies(gameState.speciesB, upB, data.blueAction);

        // === 生成结构化日志 ===
        const newEntries: LogEntry[] = [];
        
        // 1. 叙事主日志
        if (data.narrative) {
            newEntries.push({ type: 'NARRATIVE', text: data.narrative, changes: null });
        }
        
        // 2. 关键数值变化日志 (A)
        if (upA.popChange !== 0 || upA.foodChange !== 0) {
            newEntries.push({ 
                type: data.redAction?.action === 'HUNT' ? 'BATTLE' : 'SYSTEM',
                text: `[红方] 执行了 ${data.redAction?.action} - ${data.redAction?.detail}`,
                changes: { species: 'A', popChange: upA.popChange, foodChange: upA.foodChange }
            });
        }
        
        // 3. 关键数值变化日志 (B)
        if (upB.popChange !== 0 || upB.foodChange !== 0) {
            newEntries.push({ 
                type: data.blueAction?.action === 'HUNT' ? 'BATTLE' : 'SYSTEM',
                text: `[蓝方] 执行了 ${data.blueAction?.action} - ${data.blueAction?.detail}`,
                changes: { species: 'B', popChange: upB.popChange, foodChange: upB.foodChange }
            });
        }

        // 4. 进化日志
        if (upA.newTrait) newEntries.push({ type: 'EVOLVE', text: `🧬 [红方] 突变出新特征: ${upA.newTrait}`, changes: null });
        if (upB.newTrait) newEntries.push({ type: 'EVOLVE', text: `🧬 [蓝方] 突变出新特征: ${upB.newTrait}`, changes: null });

        // ⚡️ 核心修改：新日志在最前 (Reverse Order)
        setLogs(prev => [...newEntries, ...prev]);

        if (newSpecA.population > 0 && newSpecB.population > 0) {
            setGameState(prev => ({
                ...prev,
                environment: data.new_environment || prev.environment,
                speciesA: newSpecA,
                speciesB: newSpecB,
                tickCount: prev.tickCount + 1
            }));
        }
      }
    } catch (e) { console.error(e); } 
    finally {
      setNetStatus('IDLE');
      if (gameState.speciesA.population > 0 && gameState.speciesB.population > 0) {
          timerRef.current = setTimeout(runGameLoop, 6000); 
      }
    }
  };

  useEffect(() => {
    runGameLoop();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // 辅助组件：行动徽章
  const ActionBadge = ({ action, color }: { action: string, color: string }) => {
      const labels: any = { 'FORAGE': '采集', 'HUNT': '捕猎', 'REPRODUCE': '繁衍', 'EVOLVE': '进化', 'IDLE': '观察' };
      const icons: any = { 'FORAGE': <Leaf size={12}/>, 'HUNT': <Swords size={12}/>, 'REPRODUCE': <Heart size={12}/>, 'EVOLVE': <Dna size={12}/>, 'IDLE': <Activity size={12}/> };
      return (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
              color === 'red' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'
          }`}>
              {icons[action] || icons['IDLE']} {labels[action] || action}
          </div>
      );
  };

  // 辅助组件：数值变化胶囊
  const StatChangePill = ({ val, type }: { val: number, type: 'POP' | 'FOOD' }) => {
      if (!val || val === 0) return null;
      const isPos = val > 0;
      return (
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
              isPos ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
              {type === 'POP' ? <Activity size={10}/> : <Zap size={10}/>}
              {isPos ? '+' : ''}{val}
          </div>
      );
  };

  return (
    <main className="flex flex-col h-screen w-full bg-gray-50 text-slate-800 font-sans overflow-hidden">
      
      {/* 顶部：全球环境监测站 */}
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm z-20 flex justify-between items-center h-16 shrink-0">
        <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-100 rounded-lg"><Activity size={20} className="text-slate-600"/></div>
            <div>
                <h1 className="text-base font-bold text-slate-900 leading-none">PROJECT: EVO-WARS</h1>
            </div>
        </div>
        <div className="flex items-center gap-6 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
             <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                {gameState.environment.type.includes('雨') ? <CloudRain size={16}/> : <Sun size={16}/>}
                {gameState.environment.type}
             </div>
             <div className="w-px h-4 bg-slate-300"></div>
             <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold uppercase">Resources</span>
                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{width: `${gameState.environment.resourceLevel * 10}%`}}></div>
                </div>
             </div>
             <div className="w-px h-4 bg-slate-300"></div>
             <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-500">
                 EPOCH {gameState.tickCount}
             </div>
        </div>
        <div className="w-24 flex justify-end">
            {netStatus === 'SIMULATING' && <span className="text-xs text-emerald-600 font-medium animate-pulse">计算中...</span>}
        </div>
      </header>

      {/* 主体内容区 */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 左侧：红方面板 */}
        <section className="flex-1 p-5 flex flex-col gap-4 border-r border-gray-200 bg-white">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-800">{gameState.speciesA.name}</h2>
                <ActionBadge action={gameState.speciesA.action} color="red" />
            </div>
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1"><span>POPULATION</span><span>{gameState.speciesA.population}</span></div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-red-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesA.population / 100)}%`}}></div></div>
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1"><span>FOOD</span><span>{gameState.speciesA.food}</span></div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-amber-400 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesA.food / 100)}%`}}></div></div>
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Traits</h3>
                <div className="flex flex-wrap gap-1.5 content-start">
                    {gameState.speciesA.traits.map((t, i) => (
                        <span key={i} className="px-2 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] rounded shadow-sm font-medium">{t}</span>
                    ))}
                </div>
            </div>
        </section>

        {/* 中间：科研日志 (反向流) */}
        <section className="w-[45%] bg-gray-50 flex flex-col border-r border-gray-200">
            <div className="p-2 border-b border-gray-200 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center shadow-sm z-10">
                Live Feed (Newest First)
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {logs.map((log, i) => (
                    <div key={i} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* 叙事卡片 */}
                        {log.type === 'NARRATIVE' && (
                            <div className="text-sm text-slate-700 leading-relaxed">
                                {log.text.replace('> ', '')}
                            </div>
                        )}
                        
                        {/* 数据变动卡片 */}
                        {(log.type === 'SYSTEM' || log.type === 'BATTLE') && (
                            <div className="flex justify-between items-start gap-4">
                                <div className="text-xs text-slate-500 font-medium pt-0.5">{log.text}</div>
                                {log.changes && (
                                    <div className="flex flex-col gap-1 shrink-0">
                                        <StatChangePill val={log.changes.popChange} type="POP"/>
                                        <StatChangePill val={log.changes.foodChange} type="FOOD"/>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 进化通知 */}
                        {log.type === 'EVOLVE' && (
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 p-2 rounded">
                                <Dna size={14}/>
                                {log.text}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>

        {/* 右侧：蓝方面板 */}
        <section className="flex-1 p-5 flex flex-col gap-4 bg-white">
             <div className="flex justify-between items-center flex-row-reverse">
                <h2 className="text-xl font-black text-slate-800">{gameState.speciesB.name}</h2>
                <ActionBadge action={gameState.speciesB.action} color="blue" />
            </div>
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1 flex-row-reverse"><span>POPULATION</span><span>{gameState.speciesB.population}</span></div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden transform rotate-180"><div className="h-full bg-blue-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesB.population / 100)}%`}}></div></div>
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1 flex-row-reverse"><span>FOOD</span><span>{gameState.speciesB.food}</span></div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden transform rotate-180"><div className="h-full bg-amber-400 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesB.food / 100)}%`}}></div></div>
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-right">Traits</h3>
                <div className="flex flex-wrap gap-1.5 content-start justify-end">
                    {gameState.speciesB.traits.map((t, i) => (
                        <span key={i} className="px-2 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] rounded shadow-sm font-medium">{t}</span>
                    ))}
                </div>
            </div>
        </section>

      </div>
    </main>
  );
}