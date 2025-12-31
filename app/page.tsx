'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  Swords, Shield, Zap, Skull, Flame, Snowflake, Biohazard, Trophy, 
  Activity, Dna, Leaf, Heart, Search, CloudRain, Sun, Wind
} from 'lucide-react';

// === 初始状态 ===
const INITIAL_STATE = {
  tickCount: 0,
  // 环境
  environment: { 
    type: '丰饶平原', 
    resourceLevel: 8 // 1-10, 决定采集效率
  },
  // 物种 A (红)
  speciesA: {
    name: '赤红行军蚁',
    population: 5000,
    food: 5000, // 新增：食物/能量资源
    traits: ['群体协作'],
    action: 'OBSERVING', // 当前动作
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
  eventLog: [
    "系统: 生态监测链路已连接。",
    "纪元 0: 投放初始物种样本，环境参数稳定。"
  ]
};

export default function Home() {
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [logs, setLogs] = useState<string[]>(INITIAL_STATE.eventLog);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'SIMULATING'>('IDLE');
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);

  const runGameLoop = async () => {
    setNetStatus('SIMULATING');

    try {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ gameState: { ...gameState, eventLog: logs } })
      });

      if (res.ok) {
        const data = await res.json();
        const updates = data.stateUpdates || {};
        const upA = updates.speciesA || {};
        const upB = updates.speciesB || {};
        
        // 计算新状态 (增加上下限限制)
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

        // 日志生成
        const newEntries: string[] = [];
        if (data.narrative) newEntries.push(`> ${data.narrative}`);
        
        // 关键事件高亮
        if (data.redAction?.action === 'HUNT') newEntries.push(`⚔️ [红方] 发起了捕猎攻势!`);
        if (data.blueAction?.action === 'HUNT') newEntries.push(`⚔️ [蓝方] 发起了捕猎攻势!`);
        if (data.redAction?.action === 'EVOLVE') newEntries.push(`🧬 [红方] 突变: ${upA.newTrait}`);
        if (data.blueAction?.action === 'EVOLVE') newEntries.push(`🧬 [蓝方] 突变: ${upB.newTrait}`);

        setLogs(prev => [...prev, ...newEntries]);

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
      const icons: any = {
          'FORAGE': <Leaf size={14} />,
          'HUNT': <Swords size={14} />,
          'REPRODUCE': <Heart size={14} />,
          'EVOLVE': <Dna size={14} />,
          'IDLE': <Activity size={14} />
      };
      const labels: any = {
          'FORAGE': '采集资源',
          'HUNT': '捕猎进攻',
          'REPRODUCE': '繁衍扩张',
          'EVOLVE': '基因突变',
          'IDLE': '观察中'
      };
      
      return (
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
              color === 'red' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'
          }`}>
              {icons[action] || icons['IDLE']}
              {labels[action] || action}
          </div>
      );
  };

  return (
    <main className="flex flex-col h-screen w-full bg-gray-50 text-slate-800 font-sans overflow-hidden">
      
      {/* 顶部：全球环境监测站 */}
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm z-20 flex justify-between items-center h-20">
        <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-100 rounded-lg">
                <Activity size={24} className="text-slate-600"/>
            </div>
            <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">PROJECT: EVO-WARS</h1>
                <div className="text-xs text-slate-500 font-medium">Ecological Simulation System v2.0</div>
            </div>
        </div>

        {/* 环境状态卡片 */}
        <div className="flex items-center gap-6 bg-slate-50 px-6 py-2 rounded-full border border-slate-100">
             <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Environment</span>
                <div className="flex items-center gap-2 font-bold text-slate-700">
                    {gameState.environment.type.includes('雨') ? <CloudRain size={16}/> : <Sun size={16}/>}
                    {gameState.environment.type}
                </div>
             </div>
             <div className="w-px h-8 bg-slate-200"></div>
             <div className="flex flex-col items-center w-24">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resources</span>
                <div className="w-full h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-green-500 transition-all duration-500" style={{width: `${gameState.environment.resourceLevel * 10}%`}}></div>
                </div>
             </div>
             <div className="w-px h-8 bg-slate-200"></div>
             <div className="flex flex-col items-center">
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Epoch</span>
                 <span className="font-mono font-bold text-slate-700">{gameState.tickCount}</span>
             </div>
        </div>

        <div className="w-32 flex justify-end">
            {netStatus === 'SIMULATING' && (
                <span className="flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full animate-pulse">
                    <Activity size={12}/> 计算中...
                </span>
            )}
        </div>
      </header>

      {/* 主体内容区 */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 左侧：红方面板 */}
        <section className="flex-1 p-6 flex flex-col gap-4 border-r border-gray-200 bg-white">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">{gameState.speciesA.name}</h2>
                    <div className="text-xs text-red-500 font-bold mt-1">RED SPECIES</div>
                </div>
                <ActionBadge action={gameState.speciesA.action} color="red" />
            </div>

            {/* 数据仪表 */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                        <span>POPULATION (种群)</span>
                        <span>{gameState.speciesA.population}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesA.population / 100)}%`}}></div>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                        <span>RESERVES (食物/能量)</span>
                        <span>{gameState.speciesA.food}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesA.food / 100)}%`}}></div>
                    </div>
                </div>
            </div>

            {/* 特征列表 */}
            <div className="flex-1 overflow-hidden">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Evolutionary Traits</h3>
                <div className="flex flex-wrap gap-2 content-start">
                    {gameState.speciesA.traits.map((t, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs rounded-lg shadow-sm font-medium">
                            {t}
                        </span>
                    ))}
                </div>
            </div>
        </section>

        {/* 中间：科研日志 */}
        <section className="w-[40%] bg-gray-50 flex flex-col border-r border-gray-200">
            <div className="p-3 border-b border-gray-200 bg-white text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
                Observation Log
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar" ref={scrollRef}>
                {logs.map((log, i) => {
                    const isNarrative = log.startsWith(">");
                    const isBattle = log.includes("捕猎");
                    const isEvolve = log.includes("突变");
                    
                    return (
                        <div key={i} className={`
                            text-sm py-2 px-3 rounded border
                            ${isBattle ? 'bg-red-50 border-red-100 text-red-800' : ''}
                            ${isEvolve ? 'bg-indigo-50 border-indigo-100 text-indigo-800' : ''}
                            ${isNarrative ? 'bg-white border-slate-200 text-slate-600 italic shadow-sm' : ''}
                            ${!isBattle && !isEvolve && !isNarrative ? 'bg-transparent border-transparent text-slate-400 text-xs' : ''}
                        `}>
                            {log}
                        </div>
                    );
                })}
            </div>
        </section>

        {/* 右侧：蓝方面板 */}
        <section className="flex-1 p-6 flex flex-col gap-4 bg-white">
             <div className="flex justify-between items-start flex-row-reverse">
                <div className="text-right">
                    <h2 className="text-2xl font-black text-slate-800">{gameState.speciesB.name}</h2>
                    <div className="text-xs text-blue-500 font-bold mt-1">BLUE SPECIES</div>
                </div>
                <ActionBadge action={gameState.speciesB.action} color="blue" />
            </div>

            {/* 数据仪表 */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 flex-row-reverse">
                        <span>POPULATION (种群)</span>
                        <span>{gameState.speciesB.population}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden transform rotate-180">
                        <div className="h-full bg-blue-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesB.population / 100)}%`}}></div>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 flex-row-reverse">
                        <span>RESERVES (食物/能量)</span>
                        <span>{gameState.speciesB.food}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden transform rotate-180">
                        <div className="h-full bg-amber-400 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesB.food / 100)}%`}}></div>
                    </div>
                </div>
            </div>

            {/* 特征列表 */}
            <div className="flex-1 overflow-hidden">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-right">Evolutionary Traits</h3>
                <div className="flex flex-wrap gap-2 content-start justify-end">
                    {gameState.speciesB.traits.map((t, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs rounded-lg shadow-sm font-medium">
                            {t}
                        </span>
                    ))}
                </div>
            </div>
        </section>

      </div>
    </main>
  );
}