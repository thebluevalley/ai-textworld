import { NextResponse } from 'next/server';
import { AIDispatcher } from '@/utils/ai-dispatcher';

export async function POST(req: Request) {
  const { units, config } = await req.json();

  // 1. 构建 Prompt (针对 2秒 快速模式优化)
  const systemPrompt = `You are a real-time tactical AI.
  Output strict JSON only.
  Language: Simplified Chinese (简体中文).
  
  Schema: { "actions": [{ "unitId": string, "type": "MOVE"|"ATTACK", "target": { "x": number, "y": number }, "thought": "Brief tactical reason (<10 chars)" }] }
  
  Rules:
  1. Map size: 20x20.
  2. Aggression: ${config.aggression}%.
  3. TIME SCALING: This is a FAST tick (2 seconds).
  4. Micro-management: Move units small distances (1-2 steps) but frequently to dodge or flank. 
  5. If close to enemy, prefer flanking positions over direct charge.
  6. 'thought' must be in Chinese.
  `;

  // 简化用户输入以节省 Token
  const userPrompt = JSON.stringify({
    units: units.map((u: any) => ({ id: u.id, x: Math.round(u.x), y: Math.round(u.y), hp: u.hp, role: u.role })),
    timestamp: Date.now()
  });

  // 2. 调用 AI (使用 reflex 模式以求速度)
  // AIDispatcher 内部会处理 6个 Key 的轮询
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