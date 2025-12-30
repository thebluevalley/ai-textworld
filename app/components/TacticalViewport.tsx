'use client';
import { Stage, Graphics, Container } from '@pixi/react';
import { useEffect, useState } from 'react';

// 简单的绘制函数
const Unit = ({ x, y, color }: { x: number, y: number, color: number }) => {
  const draw = (g: any) => {
    g.clear();
    g.beginFill(color);
    g.drawCircle(0, 0, 10); // 绘制单位为圆形
    g.endFill();
  };
  // 网格大小 20px
  return <Graphics draw={draw} x={x * 30} y={y * 30} />;
};

export default function TacticalViewport({ units }: { units: any[] }) {
  // 仅在客户端渲染
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-full h-full bg-neutral-900 animate-pulse" />;

  return (
    <Stage width={600} height={400} options={{ background: 0x111111, antialias: true }}>
      <Container x={20} y={20}>
        {units.map((u) => (
          <Unit key={u.id} x={u.x} y={u.y} color={u.team === 'A' ? 0xffffff : 0xff3333} />
        ))}
      </Container>
    </Stage>
  );
}