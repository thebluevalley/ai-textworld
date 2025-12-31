import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { gameState } = await req.json();
  const { crew, facilityStatus, eventLog } = gameState;
  // 只看最近的几条日志，保持上下文紧凑
  const recentHistory = eventLog.slice(-4).join("\n"); 

  // === PHASE 1: 异常与反应 (并行思考) ===
  
  // 🔴 RED BRAIN: 系统熵增 (Anomaly Generator)
  // 不再生成怪物，而是生成技术故障、数据溢出、能源波动
  const redPrompt = `You are the SYSTEM ENTROPY AI of an advanced research facility.
  Current System Entropy: ${facilityStatus.entropy}%. (Higher means worse glitches).
  Current Power: ${facilityStatus.power}%.
  
  TASK: Generate technical anomalies, data fluctuations, or hardware stress based on entropy level.
  - Low Entropy: Minor sensor ghosts, slight temperature variance.
  - High Entropy: Power surges, containment field fluctuations, data corruption, server crashes.
  - **Do NOT generate monsters or horror elements.** Stick to hard sci-fi tech issues.
  
  OUTPUT (JSON): { "event": "Technical description of the anomaly." }`;

  // 🔵 BLUE BRAIN: 科研团队 (Research Team)
  // 角色是科学家和工程师，反应是分析、修理、感到压力
  const bluePrompt = `You manage the RESEARCH TEAM behavior.
  Team Status: ${JSON.stringify(crew.map((c:any) => ({n:c.name, role:c.role, focus:c.focus, stress:c.stress})))}.
  
  TASK: Generate team reactions to recent events.
  - They are professionals. They analyze problems, get frustrated with glitches, or focus intently on data.
  - High stress leads to mistakes or arguments about methodology.
  - Incapacitated crew cannot act.
  
  OUTPUT (JSON): { "actions": ["Dr. Aris recalibrates sensors", "Eng. Tyrell curses at the server rack"] }`;

  const [redRes, blueRes] = await Promise.all([
    AIDispatcher.chatCompletion({ role: 'RED', systemPrompt: redPrompt, userPrompt: `Recent logs:\n${recentHistory}` }),
    AIDispatcher.chatCompletion({ role: 'BLUE', systemPrompt: bluePrompt, userPrompt: `Recent logs:\n${recentHistory}` })
  ]);

  if (!redRes || !blueRes) return NextResponse.json({ error: "Brain Freeze" }, { status: 429 });

  // === PHASE 2: 中央调控 (Volcengine) ===
  
  // 🟢 GREEN BRAIN: 设施核心 (Facility Core)
  // 平衡科研进展与设施安全
  const greenPrompt = `You are the FACILITY CORE AI governing Project Genesis.
  
  INPUTS:
  - ANOMALY Detected (Red): ${redRes.event}
  - TEAM Activity (Blue): ${JSON.stringify(blueRes)}
  - FACILITY STATUS: Integrity ${facilityStatus.integrity}%, Power ${facilityStatus.power}%, Entropy ${facilityStatus.entropy}%.
  
  DIRECTIVES:
  1. **NARRATE:** Combine inputs into a detached, scientific log entry.
  2. **PROTOCOL:** Execute automated system responses to balance research vs. safety. (e.g., "Rerouting power to containment," "Purging corrupted data buffer").
  3. **UPDATE STATS:**
     - Technical issues increase 'entropy' and reduce 'integrity'/'power'.
     - Successful team actions might reduce 'entropy' or increase 'stress'.
     - High entropy causes crew stress.
  
  OUTPUT (JSON):
  {
    "narrative": "Log entry text.",
    "system_action": "Optional automated response text.",
    "stateUpdates": {
      "integrity": -2, "power": -1, "entropy": +3,
      "crewUpdates": [ { "name": "Dr. Aris", "stress": +5, "focus": -2 } ]
    }
  }`;

  const greenRes = await AIDispatcher.chatCompletion({ 
    role: 'GREEN', 
    systemPrompt: greenPrompt, 
    userPrompt: "Execute simulation tick." 
  });

  if (!greenRes) return NextResponse.json({ error: "Core Offline" }, { status: 429 });

  return NextResponse.json(greenRes);
}