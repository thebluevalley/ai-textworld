'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  Cpu, Zap, Radio, Rocket, Crosshair,  // Tech Icons
  Scroll, Sparkles, Flame, Moon, BookOpen, // Magic Icons
  Swords, Skull, AlertTriangle, Activity, History, Globe
} from 'lucide-react';

// === 初始状态 ===
const INITIAL_STATE = {
  tickCount: 0,
  environment: { 
    type: '混沌中立区', 
    resourceLevel: 10, 
    currentThreat: null as { name: string, type: string } | null
  },
  // 科技文明
  speciesA: {
    name: '赛博奇点联邦',
    population: 100000,
    food: 50000, // 能源
    traits: ['量子计算主机', '核聚变电池'],
    action: 'OBSERVING', 
    status: '高速发展'
  },
  // 魔法文明
  speciesB: {
    name: '秘法苍穹议会',
    population: 100000,
    food: 50000, // 魔力
    traits: ['元素共鸣', '法师塔网络'],
    action: 'OBSERVING',
    status: '魔力充盈'
  },
  eventLog: [
    { type: 'SYSTEM', text: '位面通道已开启。', changes: null },
    { type: 'SYSTEM', text: '两个截然不同的文明在同一星球相遇了。', changes: null }
  ] as LogEntry[]
};

type LogEntry = {
    type: 'NARRATIVE' | 'BATTLE' | 'TECH' | 'MAGIC' | 'SYSTEM' | 'DISASTER';
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

  const runGameLoop = async () => {
    setNetStatus('SIMULATING');

    try {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ gameState: { ...gameState, eventLog: logs.slice(0, 10).map(l => l.text) } })
      });

      if (res.ok) {
        const data = await res.json();
        const updates = data.stateUpdates || {};
        const upA = updates.speciesA || {};
        const upB = updates.speciesB || {};
        const globalEvent = data.global_event || { name: '和平', type: 'NONE' };
        
        // 计算新状态
        const updateCiv = (prevSpec: any, update: any, actionData: any) => {
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

        const newSpecA = updateCiv(gameState.speciesA, upA, data.redAction);
        const newSpecB = updateCiv(gameState.speciesB, upB, data.blueAction);

        // === 生成日志 ===
        const newEntries: LogEntry[] = [];
        
        if (globalEvent.type !== 'NONE') {
             newEntries.push({ type: 'DISASTER', text: `⚠️ [位面事件] ${globalEvent.name}: ${globalEvent.description}`, changes: null });
        }
        if (data.narrative) {
            newEntries.push({ type: 'NARRATIVE', text: data.narrative, changes: null });
        }
        
        // 动作日志
        if (data.redAction) {
             const type = data.redAction.action === 'ATTACK' ? 'BATTLE' : 'TECH';
             newEntries.push({ 
                type, text: `[科技] 执行战略: ${data.redAction.action} - ${data.redAction.detail}`,
                changes: { species: 'A', popChange: upA.popChange, foodChange: upA.foodChange }
            });
        }
        if (data.blueAction) {
            const type = data.blueAction.action === 'CAST' ? 'BATTLE' : 'MAGIC';
            newEntries.push({ 
               type, text: `[魔法] 施展法术: ${data.blueAction.action} - ${data.blueAction.detail}`,
               changes: { species: 'B', popChange: upB.popChange, foodChange: upB.foodChange }
           });
       }

        // 科技/魔法突破
        if (upA.newTrait) newEntries.push({ type: 'TECH', text: `💡 [科技突破] 研发成功: ${upA.newTrait}`, changes: null });
        if (upB.newTrait) newEntries.push({ type: 'MAGIC', text: `✨ [魔法领悟] 习得禁咒: ${upB.newTrait}`, changes: null });

        setLogs(prev => [...newEntries, ...prev]);

        if (newSpecA.population > 0 && newSpecB.population > 0) {
            setGameState(prev => ({
                ...prev,
                environment: {
                    type: data.new_environment?.type || prev.environment.type,
                    resourceLevel: data.new_resource_level || prev.environment.resourceLevel,
                    currentThreat: globalEvent
                },
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
          timerRef.current = setTimeout(runGameLoop, 8000); 
      }
    }
  };

  useEffect(() => {
    runGameLoop();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // 辅助组件：数值变化
  const StatPill = ({ val, type }: { val: number, type: 'POP' | 'RES' }) => {
      if (!val || val === 0) return null;
      const isPos = val > 0;
      return (
          <span className={`text-[10px] font-bold px-1 rounded ${isPos ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
              {isPos ? '+' : ''}{val}
          </span>
      );
  };

  return (
    <main className="flex h-screen w-full bg-gray-100 font-sans overflow-hidden">
      
      {/* 🔴 左侧：科技文明 (Tech/Cyber) */}
      <section className="w-1/3 flex flex-col bg-slate-900 text-cyan-50 border-r-4 border-slate-800 shadow-2xl z-10">
        {/* Header */}
        <div className="p-6 border-b border-cyan-900 bg-slate-950 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-20"><Cpu size={100} /></div>
            <h2 className="text-2xl font-mono font-bold text-cyan-400 tracking-tighter uppercase relative z-10 flex items-center gap-2">
                <Radio className="animate-pulse"/> {gameState.speciesA.name}
            </h2>
            <div className="text-[10px] text-cyan-700 font-mono mt-1 tracking-widest">SYSTEM: ONLINE // SINGULARITY_OS</div>
        </div>

        {/* Dashboard */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* Stats */}
            <div className="space-y-4">
                <div className="bg-slate-800/50 p-3 rounded border border-cyan-900/50">
                    <div className="flex justify-between text-xs font-mono text-cyan-600 mb-1">CITIZENS (人口)</div>
                    <div className="text-2xl font-mono text-white">{gameState.speciesA.population.toLocaleString()}</div>
                    <div className="h-1 bg-slate-700 mt-2 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{width: '60%'}}></div></div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded border border-cyan-900/50">
                    <div className="flex justify-between text-xs font-mono text-cyan-600 mb-1">ENERGY (能源)</div>
                    <div className="text-2xl font-mono text-amber-400 flex items-center gap-2"><Zap size={16}/> {gameState.speciesA.food.toLocaleString()}</div>
                    <div className="h-1 bg-slate-700 mt-2 rounded-full overflow-hidden"><div className="h-full bg-amber-500" style={{width: '60%'}}></div></div>
                </div>
            </div>

            {/* Tech Tree */}
            <div>
                <h3 className="text-xs font-mono text-slate-500 mb-3 flex items-center gap-2 border-b border-slate-800 pb-1">
                    <Rocket size={12}/> TECH_TREE_DATABASE
                </h3>
                <div className="flex flex-wrap gap-2">
                    {gameState.speciesA.traits.map((t, i) => (
                        <span key={i} className="px-2 py-1 bg-cyan-950 text-cyan-300 text-[10px] font-mono border border-cyan-800 rounded-sm">
                            [{t}]
                        </span>
                    ))}
                </div>
            </div>
        </div>
        
        {/* Status Footer */}
        <div className="p-4 bg-slate-950 border-t border-cyan-900 text-xs font-mono text-cyan-600 flex justify-between">
            <span>ACTION: {gameState.speciesA.action}</span>
            <span className="animate-pulse">_CURSOR_ACTIVE</span>
        </div>
      </section>


      {/* 🟡 中间：位面历史 (Neutral/History) */}
      <section className="flex-1 flex flex-col bg-gray-50 border-r border-gray-200">
        {/* Top Bar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700 font-bold">
                <Globe size={18} className="text-slate-400"/>
                <span>{gameState.environment.type}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timeline</span>
                <span className="text-xl font-serif font-bold text-slate-800">纪元 {gameState.tickCount}</span>
            </div>
            <div className="w-24 text-right">
                {netStatus === 'SIMULATING' && <Activity size={18} className="text-green-500 animate-pulse inline-block"/>}
            </div>
        </div>

        {/* History Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {logs.map((log, i) => (
                <div key={i} className={`
                    p-4 rounded-lg border shadow-sm transition-all duration-500
                    ${log.type === 'NARRATIVE' ? 'bg-white border-gray-200' : ''}
                    ${log.type === 'DISASTER' ? 'bg-red-50 border-red-200' : ''}
                    ${log.type === 'TECH' || (log.type === 'BATTLE' && log.changes?.species === 'A') ? 'bg-slate-900 border-cyan-900/50 text-cyan-50 ml-0 mr-12' : ''}
                    ${log.type === 'MAGIC' || (log.type === 'BATTLE' && log.changes?.species === 'B') ? 'bg-indigo-950 border-purple-900/50 text-purple-50 ml-12 mr-0' : ''}
                `}>
                    {/* Header/Icon */}
                    <div className="flex items-center gap-2 mb-1 opacity-70 text-xs uppercase tracking-wider font-bold">
                        {log.type === 'TECH' && <Cpu size={12}/>}
                        {log.type === 'MAGIC' && <Sparkles size={12}/>}
                        {log.type === 'BATTLE' && <Crosshair size={12}/>}
                        {log.type === 'DISASTER' && <AlertTriangle size={12}/>}
                        {log.type === 'NARRATIVE' && <History size={12}/>}
                        <span>{log.type} EVENT</span>
                    </div>

                    {/* Content */}
                    <div className={`text-sm leading-relaxed ${log.type === 'NARRATIVE' ? 'font-serif text-slate-600 italic' : ''}`}>
                        {log.text.replace('> ', '')}
                    </div>

                    {/* Stats */}
                    {log.changes && (
                        <div className="mt-2 flex gap-2 justify-end opacity-90">
                            <StatPill val={log.changes.popChange} type="POP"/>
                            <StatPill val={log.changes.foodChange} type="RES"/>
                        </div>
                    )}
                </div>
            ))}
        </div>
      </section>


      {/* 🔵 右侧：魔法文明 (Magic/Fantasy) */}
      <section className="w-1/3 flex flex-col bg-indigo-950 text-purple-100 border-l-4 border-indigo-900 shadow-2xl z-10">
        {/* Header */}
        <div className="p-6 border-b border-indigo-800 bg-indigo-950 relative overflow-hidden">
            <div className="absolute top-0 left-0 p-2 opacity-10"><Scroll size={120} /></div>
            <h2 className="text-2xl font-serif font-bold text-purple-300 tracking-wide text-right flex items-center justify-end gap-2 relative z-10">
                 {gameState.speciesB.name} <Moon className="text-yellow-200"/>
            </h2>
            <div className="text-[10px] text-purple-400 font-serif mt-1 tracking-widest text-right italic">THE GRAND ARCHIVE</div>
        </div>

        {/* Dashboard */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* Stats */}
            <div className="space-y-4">
                <div className="bg-indigo-900/40 p-3 rounded-xl border border-indigo-700/50">
                    <div className="flex justify-between text-xs font-serif text-purple-400 mb-1">BELIEVERS (信徒)</div>
                    <div className="text-2xl font-serif text-white text-right">{gameState.speciesB.population.toLocaleString()}</div>
                    <div className="h-1 bg-indigo-800 mt-2 rounded-full overflow-hidden"><div className="h-full bg-purple-500" style={{width: '60%'}}></div></div>
                </div>
                <div className="bg-indigo-900/40 p-3 rounded-xl border border-indigo-700/50">
                    <div className="flex justify-between text-xs font-serif text-purple-400 mb-1">MANA (魔力)</div>
                    <div className="text-2xl font-serif text-fuchsia-300 flex items-center justify-end gap-2">{gameState.speciesB.food.toLocaleString()} <Sparkles size={16}/></div>
                    <div className="h-1 bg-indigo-800 mt-2 rounded-full overflow-hidden"><div className="h-full bg-fuchsia-500" style={{width: '60%'}}></div></div>
                </div>
            </div>

            {/* Spell Book */}
            <div>
                <h3 className="text-xs font-serif text-indigo-400 mb-3 flex items-center justify-end gap-2 border-b border-indigo-800 pb-1">
                    GRIMOIRE OF FORBIDDEN ARTS <BookOpen size={12}/>
                </h3>
                <div className="flex flex-wrap gap-2 justify-end">
                    {gameState.speciesB.traits.map((t, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-900/60 text-purple-200 text-xs font-serif border border-indigo-700 rounded-full italic">
                            {t}
                        </span>
                    ))}
                </div>
            </div>
        </div>
        
        {/* Status Footer */}
        <div className="p-4 bg-indigo-950 border-t border-indigo-800 text-xs font-serif text-purple-500 flex justify-between">
            <span className="opacity-50">✨ ETERNAL WATCH</span>
            <span>RITUAL: {gameState.speciesB.action}</span>
        </div>
      </section>

    </main>
  );
}