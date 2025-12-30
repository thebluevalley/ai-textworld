'use client';
import { Stage, Graphics, Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useEffect, useState } from 'react';

// === 自动缩放的组件 ===
// 接收 cellSize 属性，所有绘制都基于这个基准单位

const FloatingText = ({ x, y, text, color, cellSize, onFinish }: any) => {
  const [offsetY, setOffsetY] = useState(0);
  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame++;
      setOffsetY(prev => prev - 0.5);
      if (frame < 60) requestAnimationFrame(animate);
      else onFinish();
    };
    animate();
  }, []);

  return (
    <Text 
      text={text} 
      x={x * cellSize} 
      y={y * cellSize + offsetY - cellSize} 
      anchor={0.5}
      style={new TextStyle({ fontSize: cellSize * 0.8, fontWeight: 'bold', fill: color, stroke: 'black', strokeThickness: 2 })}
    />
  );
};

const Grid = ({ mapSize, cellSize }: any) => {
  const draw = (g: any) => {
    g.clear();
    g.lineStyle(1, 0x333344, 0.3);
    for (let i = 0; i <= mapSize; i++) {
      g.moveTo(i * cellSize, 0); g.lineTo(i * cellSize, 800);
      g.moveTo(0, i * cellSize); g.lineTo(800, i * cellSize);
    }
  };
  return <Graphics draw={draw} />;
};

const ObstaclesLayer = ({ data, cellSize }: any) => {
  const draw = (g: any) => {
    g.clear();
    g.beginFill(0x334155); // 蓝灰色建筑
    g.lineStyle(1, 0x475569);
    data.forEach((obs: any) => {
      g.drawRect(obs.x * cellSize, obs.y * cellSize, obs.w * cellSize, obs.h * cellSize);
      // 简单的屋顶效果
      g.beginFill(0x1e293b);
      g.drawRect((obs.x + 0.2) * cellSize, (obs.y + 0.2) * cellSize, (obs.w - 0.4) * cellSize, (obs.h - 0.4) * cellSize);
      g.endFill();
    });
    g.endFill();
  };
  return <Graphics draw={draw} />;
};

const Unit = ({ x, y, hp, maxHp, team, role, status, id, cellSize }: any) => {
  const isDead = status === 'DEAD';
  const color = team === 'BLUE' ? 0x60a5fa : 0xf87171; 
  const radius = cellSize * 0.4; // 单位半径是格子的 40%

  const draw = (g: any) => {
    g.clear();
    if (isDead) {
      g.beginFill(0x1e293b);
      g.drawCircle(0, 0, radius);
      g.endFill();
      return;
    }
    // 视线范围 (仅装饰)
    g.beginFill(color, 0.05);
    g.drawCircle(0, 0, radius * 8); 
    g.endFill();

    // 实体
    g.lineStyle(1, 0xffffff, 0.8);
    g.beginFill(color);
    g.drawCircle(0, 0, radius);
    g.endFill();

    // 血条 (根据格子大小自动缩放)
    const hpW = cellSize;
    const hpH = cellSize * 0.15;
    const hpY = -radius - hpH - 2;
    
    g.beginFill(0x000000);
    g.drawRect(-hpW/2, hpY, hpW, hpH);
    g.endFill();
    const hpPercent = Math.max(0, hp / maxHp);
    g.beginFill(hpPercent > 0.5 ? 0x22c55e : 0xff0000);
    g.drawRect(-hpW/2, hpY, hpW * hpPercent, hpH);
    g.endFill();
  };

  return (
    <Container x={x * cellSize} y={y * cellSize}>
      <Graphics draw={draw} />
    </Container>
  );
};

const LaserEffects = ({ attacks, cellSize }: any) => {
  const [visible, setVisible] = useState<any[]>([]);
  useEffect(() => setVisible(attacks.filter((a: any) => Date.now() - a.timestamp < 300)), [attacks]);

  const draw = (g: any) => {
    g.clear();
    visible.forEach((atk: any) => {
      g.lineStyle(atk.isMiss ? 1 : 2, atk.color, atk.isMiss ? 0.3 : 0.8);
      g.moveTo(atk.from.x * cellSize, atk.from.y * cellSize);
      g.lineTo(atk.to.x * cellSize, atk.to.y * cellSize);
    });
  };
  return <Graphics draw={draw} />;
};

export default function TacticalViewport({ units, attacks, obstacles, floatingTexts, mapSize = 50 }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cellSize = 800 / mapSize; // ⚡️ 核心计算：动态计算格子大小

  if (!mounted) return <div className="text-white">LOADING BATTLEFIELD...</div>;

  return (
    <Stage width={800} height={800} options={{ background: 0x0f172a, antialias: true }}>
      <Grid mapSize={mapSize} cellSize={cellSize} />
      <ObstaclesLayer data={obstacles} cellSize={cellSize} />
      <Container sortableChildren={true}>
        {units.map((u: any) => <Unit key={u.id} {...u} cellSize={cellSize} zIndex={10} />)}
        <LaserEffects attacks={attacks} cellSize={cellSize} />
        {floatingTexts.map((ft: any) => <FloatingText key={ft.id} {...ft} cellSize={cellSize} onFinish={()=>{}} />)}
      </Container>
    </Stage>
  );
}