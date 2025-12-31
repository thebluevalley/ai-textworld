'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  Cpu, Zap, Radio, Rocket, Crosshair,  // Tech Icons
  Scroll, Sparkles, Flame, Moon, BookOpen, // Magic Icons
  Swords, AlertTriangle, Activity, Globe, History, TrendingUp, Users
} from 'lucide-react';

// === 初始状态 (对应 Tech vs Magic) ===
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
      // 这里的 API 调用逻辑保持不变，确保后端返回的是 Tech/Magic 数据
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

        // === 生成日志 (倒序插入) ===
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

        // 突破日志
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

  // 组件：数值药丸
  const StatPill = ({ val, type }: { val: number, type: 'POP' | 'RES' }) => {
      if (!val || val === 0) return null;
      const isPos = val > 0;
      return (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
              isPos ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
          }`}>
              {type === 'POP' ? <Users size={10}/> : (type === 'RES' ? <TrendingUp size={10}/> : '')}
              {isPos ? '+' : ''}{val}
          </span>
      );
  };

  // 组件：行动徽章
  const ActionBadge = ({ action, type }: { action: string, type: 'tech' | 'magic' }) => {
      return (
          <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${
              type === 'tech' 
              ? 'bg-cyan-50 text-cyan-700 border-cyan-200' 
              : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
          }`}>
              {action}
          </span>
      );
  };

  return (
    <main className="flex flex-col h-screen w-full bg-gray-50 text-slate-800 font-sans overflow-hidden">
      
      {/* 顶部：世界状态栏 */}
      <header className="bg-white border-b border-gray-200 p-4 h-16 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-100 rounded-lg"><Globe size={20} className="text-slate-600"/></div>
            <div>
                <h1 className="text-sm font-black text-slate-900 tracking-wide">CLASH OF REALMS</h1>
                <div className="text-[10px] text-slate-500 font-medium">Singularity vs Arcane</div>
            </div>
        </div>

        <div className="flex items-center gap-6 px-6 py-1.5 bg-gray-50 rounded-full border border-gray-100">
             <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                <Activity size={16} className="text-slate-400"/>
                {gameState.environment.type}
             </div>
             <div className="w-px h-4 bg-gray-300"></div>
             <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold uppercase">Mana/Energy Level</span>
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{width: `${gameState.environment.resourceLevel * 10}%`}}></div>
                </div>
             </div>
             <div className="w-px h-4 bg-gray-300"></div>
             <div className="font-mono text-xs font-bold text-slate-500">
                 EPOCH {gameState.tickCount}
             </div>
        </div>

        <div className="w-24 text-right">
            {netStatus === 'SIMULATING' && <span className="text-xs text-indigo-600 font-medium animate-pulse">推演中...</span>}
        </div>
      </header>

      {/* 主体内容区 */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 🔴 左侧：科技文明 (Tech - Cyan/Blue Theme) */}
        <section className="flex-1 p-6 flex flex-col gap-5 border-r border-gray-200 bg-white">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Cpu className="text-cyan-600"/> {gameState.speciesA.name}
                    </h2>
                    <div className="text-[10px] text-cyan-600 font-bold mt-1 tracking-widest uppercase">Type-I Civilization</div>
                </div>
                <ActionBadge action={gameState.speciesA.action} type="tech" />
            </div>

            {/* 科技数据面板 - 极简白卡片 */}
            <div className="space-y-4 bg-cyan-50/30 p-5 rounded-2xl border border-cyan-100">
                <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                        <span>CITIZENS</span>
                        <span className="font-mono">{gameState.speciesA.population.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesA.population / 2000)}%`}}></div></div>
                </div>
                <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                        <span>ENERGY</span>
                        <span className="font-mono flex items-center gap-1"><Zap size={10}/> {gameState.speciesA.food.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-amber-400 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesA.food / 2000)}%`}}></div></div>
                </div>
            </div>

            {/* 科技树 - 胶囊标签 */}
            <div className="flex-1 overflow-hidden">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                    <Rocket size={12}/> Tech Tree
                </h3>
                <div className="flex flex-wrap gap-2 content-start">
                    {gameState.speciesA.traits.map((t, i) => (
                        <span key={i} className="px-3 py-1 bg-white border border-cyan-200 text-cyan-700 text-xs rounded-full shadow-sm font-medium hover:border-cyan-400 transition-colors">
                            {t}
                        </span>
                    ))}
                </div>
            </div>
        </section>

        {/* 🟡 中间：历史时间轴 (Timeline) */}
        <section className="w-[40%] bg-gray-50 flex flex-col border-r border-gray-200">
            <div className="p-3 bg-white border-b border-gray-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center shadow-sm z-10">
                Timeline Feed (Newest First)
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                {logs.map((log, i) => (
                    <div key={i} className={`
                        p-4 rounded-xl border shadow-sm transition-all duration-300 bg-white
                        ${log.type === 'DISASTER' ? 'border-red-200 bg-red-50/50' : 'border-gray-100'}
                        ${(log.type === 'TECH' || (log.type === 'BATTLE' && log.changes?.species === 'A')) ? 'border-l-4 border-l-cyan-500' : ''}
                        ${(log.type === 'MAGIC' || (log.type === 'BATTLE' && log.changes?.species === 'B')) ? 'border-l-4 border-l-purple-500' : ''}
                    `}>
                        {/* 标签头 */}
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-1.5">
                                {log.type === 'DISASTER' && <AlertTriangle size={14} className="text-red-500"/>}
                                {log.type === 'TECH' && <Cpu size={14} className="text-cyan-600"/>}
                                {log.type === 'MAGIC' && <Sparkles size={14} className="text-purple-600"/>}
                                {log.type === 'BATTLE' && <Crosshair size={14} className="text-slate-600"/>}
                                {log.type === 'NARRATIVE' && <History size={14} className="text-slate-400"/>}
                                
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                    log.type === 'DISASTER' ? 'text-red-600' : 'text-slate-500'
                                }`}>
                                    {log.type} EVENT
                                </span>
                            </div>
                        </div>

                        {/* 正文 - 正常字体，非斜体 */}
                        <div className={`text-sm leading-relaxed ${
                            log.type === 'NARRATIVE' ? 'text-slate-600 font-medium' : 'text-slate-700'
                        }`}>
                            {log.text.replace('> ', '')}
                        </div>

                        {/* 数值变化 */}
                        {log.changes && (
                            <div className="mt-3 flex gap-2 justify-end border-t border-gray-50 pt-2">
                                <StatPill val={log.changes.popChange} type="POP"/>
                                <StatPill val={log.changes.foodChange} type="RES"/>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>


        {/* 🔵 右侧：魔法文明 (Magic - Purple/Gold Theme) */}
        <section className="flex-1 p-6 flex flex-col gap-5 bg-white text-right">
             <div className="flex justify-between items-start flex-row-reverse">
                <div>
                    <h2 className="text-2xl font-serif font-black text-slate-800 tracking-tight flex items-center justify-end gap-2">
                         {gameState.speciesB.name} <Moon className="text-purple-600"/>
                    </h2>
                    <div className="text-[10px] text-purple-600 font-bold mt-1 tracking-widest uppercase font-serif">High Arcane Council</div>
                </div>
                <ActionBadge action={gameState.speciesB.action} type="magic" />
            </div>

            {/* 魔法数据面板 */}
            <div className="space-y-4 bg-purple-50/30 p-5 rounded-2xl border border-purple-100">
                <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 flex-row-reverse">
                        <span>BELIEVERS</span>
                        <span className="font-serif">{gameState.speciesB.population.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden transform rotate-180"><div className="h-full bg-purple-500 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesB.population / 2000)}%`}}></div></div>
                </div>
                <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 flex-row-reverse">
                        <span>MANA</span>
                        <span className="font-serif flex items-center gap-1">{gameState.speciesB.food.toLocaleString()} <Sparkles size={10}/></span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden transform rotate-180"><div className="h-full bg-fuchsia-400 transition-all duration-700" style={{width: `${Math.min(100, gameState.speciesB.food / 2000)}%`}}></div></div>
                </div>
            </div>

            {/* 禁咒书 - 衬线体标签 */}
            <div className="flex-1 overflow-hidden">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-end gap-1">
                    Grimoire <BookOpen size={12}/>
                </h3>
                <div className="flex flex-wrap gap-2 content-start justify-end">
                    {gameState.speciesB.traits.map((t, i) => (
                        <span key={i} className="px-3 py-1 bg-white border border-purple-200 text-purple-800 text-xs rounded-full shadow-sm font-serif italic hover:border-purple-400 transition-colors">
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