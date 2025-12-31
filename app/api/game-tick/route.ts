import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { gameState, playerIntervention } = await req.json();
  const { species, environment, eventLog } = gameState;
  const recentHistory = eventLog.slice(-6).join("\n"); 

  // === PHASE 1: 并行处理 (负载均衡生效时刻) ===
  // Red 和 Blue 会自动分配到不同的 Silicon Key，或者轮询同一个
  
  const redPrompt = `You are the PLANETARY ENVIRONMENT.
  Era: ${species.era}. Stats: Temp ${environment.temperature}°C, Rads ${environment.radiation}mSv, Water ${environment.waterLevel}%.
  INTERVENTION: "${playerIntervention || 'None'}"
  
  TASK: Generate evolutionary pressure.
  - If Intervention: Execute it drastically.
  - If None: Generate a natural threat (Predator, Climate, Disease).
  
  OUTPUT (JSON): { "event": "Description", "type": "THREAT_TYPE", "severity": 1-10 }`;

  const bluePrompt = `You are the GENETIC ARCHITECT.
  Species: ${species.name}. Genes: ${JSON.stringify(species.genes)}.
  
  TASK: Propose a specific mutation to survive the current Era and Environment.
  - Be creative: Bioluminescence, Hive Mind, Silicon Skin, etc.
  
  OUTPUT (JSON): { "new_gene_name": "Name", "category": "MORPHOLOGY/METABOLISM/SENSORY/COGNITION", "function": "Utility" }`;

  // 并发请求：调度器会自动分配 Key
  const [redRes, blueRes] = await Promise.all([
    AIDispatcher.chatCompletion({ role: 'RED', systemPrompt: redPrompt, userPrompt: `Log:\n${recentHistory}` }),
    AIDispatcher.chatCompletion({ role: 'BLUE', systemPrompt: bluePrompt, userPrompt: `Log:\n${recentHistory}` })
  ]);

  if (!redRes || !blueRes) return NextResponse.json({ error: "Evolution Stalled" }, { status: 429 });

  // === PHASE 2: 深度裁决 (火山引擎 Doubao-pro) ===
  // 豆包 Pro 模型擅长长文本和逻辑判断，非常适合做最终决策
  
  const greenPrompt = `You are NATURAL SELECTION (The Judge).
  
  [SCENARIO]
  Threat: ${redRes.event} (Sev: ${redRes.severity})
  Mutation: ${blueRes.new_gene_name} (${blueRes.function})
  Current Species: ${species.name} (${species.era})
  
  [LOGIC]
  1. COMPATIBILITY: Does the mutation logically counter the threat?
  2. VIABILITY: Is the mutation too expensive or unrealistic?
  
  [OUTPUT JSON]
  {
    "narrative": " Epic description of the struggle.",
    "is_successful": true/false,
    "evolutionary_verdict": "Why it lived or died.",
    "new_species_name": "Evolved name or null",
    "stateUpdates": {
      "populationChange": integer,
      "environmentChange": {"temperature": float, "radiation": float}
    }
  }`;

  const greenRes = await AIDispatcher.chatCompletion({ 
    role: 'GREEN', 
    systemPrompt: greenPrompt, 
    userPrompt: "Judge the survival." 
  });

  if (!greenRes) return NextResponse.json({ error: "Selection Offline" }, { status: 429 });

  return NextResponse.json({
    ...greenRes,
    mutation_attempt: blueRes
  });
}