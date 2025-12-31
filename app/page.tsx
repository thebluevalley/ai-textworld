'use client';
import { useState, useEffect, useRef } from 'react';
import { Dna, Activity,  Wind, Droplets, Skull, Zap,  Flame, Snowflake, Radiation, Bug, Layers, Fingerprint } from 'lucide-react';

// === 初始状态：原始汤 ===
const INITIAL_STATE = {
  tickCount: 0,
  environment: { 
    temperature: 20, 
    radiation: 10,
    waterLevel: 50 
  },
  species: {
    name: '原始始祖细胞 Alpha',
    era: '单细胞时代', 
    population: 5000,
    dnaPoints: 0,
    // 基因库：按分类存储
    genes: {
      MORPHOLOGY: ['细胞壁'],
      METABOLISM: ['渗透作用'],
      SENSORY: ['触觉受体'],
      COGNITION: ['基础本能']
    } as Record<string, string[]>,
    status: '稳定'
  },
  eventLog: [
    "系统: 基因组数据库已初始化。",
    "纪元 0: 生命在温暖的原始汤中诞生了。"
  ]
};

export default function Home() {
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [logs, setLogs] = useState<string[]>(INITIAL_STATE.eventLog);
  const [netStatus, setNetStatus] = useState<'IDLE' | 'EVOLVING'>('IDLE');
  const [playerIntervention, setPlayerIntervention] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);

  const runGameLoop = async () => {
    setNetStatus('EVOLVING');
    
    const currentIntervention = playerIntervention;
    if (currentIntervention) setPlayerIntervention(null); 

    try {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        body: JSON.stringify({ 
          gameState: { ...gameState, eventLog: logs },
          playerIntervention: currentIntervention 
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // 1. 处理环境变化
        const envUpdates = data.stateUpdates?.environmentChange || {};
        const newEnv = {
            temperature: Math.max(-50, Math.min(100, gameState.environment.temperature + (envUpdates.temperature || 0))),
            radiation: Math.max(0, gameState.environment.radiation + (envUpdates.radiation || 0)),
            waterLevel: Math.max(0, Math.min(100, gameState.environment.waterLevel + (envUpdates.waterLevel || 0))),
        };

        // 2. 处理基因录入
        const isSuccess = data.is_successful;
        const newGenes = { ...gameState.species.genes };
        const mutation = data.mutation_attempt;
        
        if (isSuccess && mutation) {
            const cat = mutation.category || 'MORPHOLOGY';
            if (!newGenes[cat]) newGenes[cat] = [];
            if (!newGenes[cat].includes(mutation.new_gene_name)) {
                newGenes[cat] = [...newGenes[cat], mutation.new_gene_name];
            }
        }

        // 3. 种群与状态
        const popChange = data.stateUpdates?.populationChange || 0;
        let newPop = Math.max(0, gameState.species.population + popChange);
        let newStatus = isSuccess ? '进化中' : '濒危';
        if (newPop < 500) newStatus = '极度濒危';
        if (newPop <= 0) { newPop = 0; newStatus = '已灭绝'; }

        // 4. 日志生成 (汉化版)
        const newEntries: string[] = [];
        
        if (currentIntervention) newEntries.push(`⚡️ 上帝干预: ${currentIntervention}`);
        
        if (data.narrative) newEntries.push(`> ${data.narrative}`);
        
        if (isSuccess) {
            newEntries.push(`✅ 基因融合成功: [${mutation?.new_gene_name || '未知突变'}] - ${data.evolutionary_verdict}`);
            if (data.new_species_name) newEntries.push(`🧬 物种更名: [${data.new_species_name}]`);
        } else {
            if (mutation) newEntries.push(`❌ 进化失败: [${mutation.new_gene_name}] - ${data.evolutionary_verdict}`);
            newEntries.push(`💀 种群损失: ${Math.abs(popChange)}`);
        }

        setLogs(prev => [...prev, ...newEntries]);
        
        if (newStatus !== '已灭绝') {
          setGameState(prev => ({
            ...prev,
            environment: newEnv,
            species: {
                ...prev.species,
                name: data.new_species_name || prev.species.name,
                population: newPop,
                genes: newGenes,
                dnaPoints: prev.species.dnaPoints + (isSuccess ? 10 : 0),
                era: data.stateUpdates?.era || prev.species.era,
                status: newStatus
            },
            tickCount: prev.tickCount + 1
          }));
        }
      }
    } catch (e) { console.error(e); } 
    finally {
      setNetStatus('IDLE');
      if (gameState.species.status !== '已灭绝') {
          timerRef.current = setTimeout(runGameLoop, 6000); 
      }
    }
  };

  useEffect(() => {
    runGameLoop();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const triggerGodMode = (type: string) => {
      setPlayerIntervention(type);
      if (timerRef.current) clearTimeout(timerRef.current);
      setLogs(prev => [...prev, `... 正在准备行星级事件: ${type} ...`]);
      setTimeout(runGameLoop, 1000);
  };

  // 汉化辅助函数：翻译基因类别
  const translateCategory = (cat: string) => {
      const map: any = {
          'MORPHOLOGY': '形态学',
          'METABOLISM': '新陈代谢',
          'SENSORY': '感官系统',
          'COGNITION': '认知能力'
      };
      return map[cat] || cat;
  };

  return (
    <main className="flex h-screen w-full bg-slate-950 text-emerald-100 font-mono overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-80 pointer-events-none"></div>

      {/* 左侧：基因库展示 */}
      <div className="w-1/3 border-r border-emerald-900/50 p-6 flex flex-col gap-6 bg-slate-900/80 backdrop-blur-md z-10 shadow-2xl">
        <div className="border-b border-emerald-800 pb-4">
          <div className="flex items-center gap-3 text-emerald-400 mb-1">
            <Fingerprint size={28} />
            <h1 className="text-xl font-bold tracking-widest">基因组数据库</h1>
          </div>
          <div className="text-xs text-emerald-600 font-bold uppercase tracking-widest">
             实验对象: {gameState.species.name}
          </div>
        </div>

        {/* 基因列表 */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {Object.entries(gameState.species.genes).map(([category, genes]) => (
                <div key={category} className="bg-slate-950/50 border border-emerald-900/30 rounded p-3">
                    <h3 className="text-[10px] font-bold text-emerald-500 mb-2 flex items-center gap-2">
                        {category === 'MORPHOLOGY' && <Layers size={12}/>}
                        {category === 'METABOLISM' && <Zap size={12}/>}
                        {category === 'SENSORY' && <Activity size={12}/>}
                        {category === 'COGNITION' && <Dna size={12}/>}
                        {translateCategory(category)}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {genes.map((gene, i) => (
                            <span key={i} className="px-2 py-1 bg-emerald-900/20 text-emerald-300 text-xs rounded border border-emerald-800/50">
                                {gene}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>

        {/* 环境仪表盘 */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-emerald-800 pt-4">
            <div className="p-2 bg-slate-900 rounded border border-emerald-900/50">
                <div className="text-emerald-500 mb-1 flex justify-center"><Flame size={14}/></div>
                <div>{gameState.environment.temperature.toFixed(0)}°C 温度</div>
            </div>
            <div className="p-2 bg-slate-900 rounded border border-emerald-900/50">
                <div className="text-emerald-500 mb-1 flex justify-center"><Radiation size={14}/></div>
                <div>{gameState.environment.radiation} mSv 辐射</div>
            </div>
            <div className="p-2 bg-slate-900 rounded border border-emerald-900/50">
                <div className="text-emerald-500 mb-1 flex justify-center"><Droplets size={14}/></div>
                <div>{gameState.environment.waterLevel}% 水位</div>
            </div>
        </div>
      </div>

      {/* 右侧：进化日志与上帝控制台 */}
      <div className="flex-1 flex flex-col h-full bg-slate-950 relative">
        {/* 日志区 */}
        <div className="flex-1 p-10 overflow-y-auto font-sans leading-relaxed custom-scrollbar" ref={scrollRef}>
            <div className="max-w-4xl mx-auto space-y-6 pb-40">
            {logs.map((log, i) => {
                const isSuccess = log.includes("基因融合成功");
                const isFail = log.includes("进化失败") || log.includes("种群损失");
                const isGod = log.includes("上帝干预");
                const isRename = log.includes("物种更名");
                const isNarrative = log.startsWith(">");
                
                return (
                <div key={i} className={`
                    ${isGod ? 'text-yellow-400 font-bold text-center border-y border-yellow-900 py-2 my-4 bg-yellow-900/10' : ''}
                    ${isSuccess ? 'text-emerald-400 border-l-2 border-emerald-500 pl-4' : ''}
                    ${isFail ? 'text-red-400 border-l-2 border-red-500 pl-4 opacity-80' : ''}
                    ${isRename ? 'text-cyan-300 font-bold text-lg mt-4' : ''}
                    ${isNarrative ? 'text-slate-300 italic text-lg' : ''}
                    ${!isSuccess && !isFail && !isGod && !isRename && !isNarrative ? 'text-slate-500 text-sm' : ''}
                    animate-in fade-in slide-in-from-bottom-2 duration-500
                `}>
                    {log}
                </div>
                );
            })}
            {gameState.species.status === '已灭绝' && (
                <div className="text-red-600 text-5xl font-black text-center mt-20 opacity-50">
                    物种灭绝
                </div>
            )}
            </div>
        </div>

        {/* 底部：上帝控制台 (God Controls) */}
        <div className="h-24 bg-slate-900 border-t border-emerald-900 p-4 z-20 flex items-center justify-center gap-4 shadow-2xl">
            <div className="text-xs text-emerald-700 font-bold mr-4 uppercase tracking-widest text-right">
                环境干预<br/>Override
            </div>
            
            <button onClick={() => triggerGodMode('冰河世纪')} className="group flex flex-col items-center gap-1 p-2 rounded hover:bg-cyan-900/30 transition-all border border-transparent hover:border-cyan-700">
                <Snowflake size={20} className="text-cyan-500 group-hover:scale-110 transition-transform"/>
                <span className="text-[10px] text-cyan-500 font-bold">寒冷</span>
            </button>
            
            <button onClick={() => triggerGodMode('全球变暖')} className="group flex flex-col items-center gap-1 p-2 rounded hover:bg-orange-900/30 transition-all border border-transparent hover:border-orange-700">
                <Flame size={20} className="text-orange-500 group-hover:scale-110 transition-transform"/>
                <span className="text-[10px] text-orange-500 font-bold">高温</span>
            </button>
            
            <button onClick={() => triggerGodMode('伽马射线暴')} className="group flex flex-col items-center gap-1 p-2 rounded hover:bg-green-900/30 transition-all border border-transparent hover:border-green-700">
                <Radiation size={20} className="text-green-500 group-hover:scale-110 transition-transform"/>
                <span className="text-[10px] text-green-500 font-bold">辐射</span>
            </button>
            
            <button onClick={() => triggerGodMode('超级病毒')} className="group flex flex-col items-center gap-1 p-2 rounded hover:bg-purple-900/30 transition-all border border-transparent hover:border-purple-700">
                <Bug size={20} className="text-purple-500 group-hover:scale-110 transition-transform"/>
                <span className="text-[10px] text-purple-500 font-bold">病毒</span>
            </button>

            <button onClick={() => triggerGodMode('陨石撞击')} className="group flex flex-col items-center gap-1 p-2 rounded hover:bg-red-900/30 transition-all border border-transparent hover:border-red-700 ml-4">
                <Skull size={20} className="text-red-500 group-hover:scale-110 transition-transform"/>
                <span className="text-[10px] text-red-500 font-bold">大灭绝</span>
            </button>
        </div>
      </div>

    </main>
  );
}