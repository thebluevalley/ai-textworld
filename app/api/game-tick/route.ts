import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { gameState } = await req.json();

  // === 1. 构建记忆上下文 (Context Construction) ===
  const { crew, shipStatus, eventLog } = gameState;

  // 提取最近的 5 条历史，防止 Token 溢出，同时保持连贯性
  const recentHistory = eventLog.slice(-5).join("\n");

  // 构建存活名单，辅助 AI 决策
  const livingCrew = crew.filter((c:any) => c.status !== 'DEAD').map((c:any) => c.name).join(", ");

  const systemPrompt = `You are the AI DIRECTOR of a sci-fi horror story called "PROTOCOL: OVERSEER".
  
  **CURRENT STATE (ABSOLUTE TRUTH):**
  - **Living Crew:** ${livingCrew}
  - **Ship Integrity:** ${shipStatus.hull}%
  - **Oxygen Level:** ${shipStatus.oxygen}%
  - **Danger Level:** ${shipStatus.danger} (0=Safe, 100=Doom)
  
  **RECENT HISTORY (MEMORY):**
  ${recentHistory}
  
  **INSTRUCTIONS:**
  1. **CONTINUITY CHECK:** You MUST respect the "Status" of crew. DEAD characters CANNOT speak or act.
  2. **NARRATIVE:** Progress the story by 1 minute. Generate suspense, conflict, or horror.
  3. **RANDOM EVENTS:** Randomly trigger malfunctions or alien symptoms based on Danger Level.
  4. **DECISION NODE:** If a major crisis occurs (Fire, Alien Attack, Betrayal), STOP and ask the Player (Ship AI) for input.
  
  **OUTPUT FORMAT (JSON ONLY):**
  {
    "thought": "Analyze history and state. Check for inconsistencies. Decide next plot point.",
    "narrative": "Descriptive text of what happens visually/atmospherically.",
    "dialogues": [
      { "name": "Miller", "text": "Did you hear that?" },
      { "name": "Isaac", "text": "It's coming from the vents!" }
    ],
    "stateUpdates": { // Only include changes
      "danger": 5, 
      "oxygen": -1,
      "crewUpdates": [
        { "name": "Isaac", "sanity": -10, "status": "PANICKED" } // Optional status change
      ]
    },
    "decision": { // Optional: Only if player input is needed
      "required": true,
      "title": "VENTILATION ERROR",
      "description": "Something is moving in the vents. Sensors detect organic mass.",
      "options": [
        { "id": "A", "text": "Flush vents with Plasma (Damage Ship, Kill Creature)" },
        { "id": "B", "text": "Seal vents (Save Ship, Creature grows stronger)" }
      ]
    }
  }
  `;

  // 这里的 userPrompt 主要是触发器，实际内容都在 systemPrompt 的 state 里
  const userPrompt = JSON.stringify({
    tick: "Proceed with the next minute of the simulation.",
    current_crew_status: crew // 再强调一次状态
  });

  const result = await AIDispatcher.chatCompletion({
    team: 'RED', // 使用 Red Key 作为导演
    systemPrompt,
    userPrompt
  });

  if (result && result.error === 429) {
    return NextResponse.json({ error: "Thinking..." }, { status: 429 });
  }

  return NextResponse.json(result || {});
}