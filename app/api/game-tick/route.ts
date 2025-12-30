import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, config } = await req.json();

  // 1. 构建极简的 Prompt，节省 Token
  const systemPrompt = `You are a tactical engine. 
  Output strict JSON. No markdown. 
  Schema: { "actions": [{ "unitId": string, "type": "MOVE"|"ATTACK", "target": { "x": number, "y": number }, "thought": string }] }
  Rules:
  1. Aggression level: ${config.aggression}%
  2. Map size: 20x20.
  3. Only active units can move.`;

  const userPrompt = JSON.stringify({
    units: units.map((u: any) => ({ id: u.id, x: u.x, y: u.y, hp: u.hp, role: u.role })),
    timestamp: Date.now()
  });

  // 2. 调用 AI (使用 reflex 模式以求速度)
  const result = await AIDispatcher.chatCompletion({
    mode: 'reflex',
    systemPrompt,
    userPrompt
  });

  // 3. 兜底处理
  if (!result || !result.actions) {
    return NextResponse.json({ actions: [] });
  }

  return NextResponse.json(result);
}