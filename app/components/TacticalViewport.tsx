'use client';
import { Stage, Graphics, Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useEffect, useState } from 'react';

// === 飘字 ===
const FloatingText = ({ x, y, text, color, onFinish }: any) => {
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
      x={x * 40} 
      y={y * 40 + offsetY - 30} 
      anchor={0.5}
      style={new TextStyle({ fontSize: 18, fontWeight: 'bold', fill: color, stroke: 'black', strokeThickness: 4 })}
    />
  );
};

// === 障碍物 (亮灰色) ===
const ObstaclesLayer = ({ data }: { data: any[] }) => {
  const draw = (g: any) => {
    g.clear();
    g.beginFill(0x555566); // 亮一点的灰色
    g.lineStyle(2, 0x888899); // 亮边框
    data.forEach(obs => {
      g.drawRect(obs.x * 40, obs.y * 40, obs.w * 40, obs.h * 40);
    });
    g.endFill();
  };
  return <Graphics draw={draw} />;
};

// === 网格 (清晰可见) ===
const Grid = () => {
  const draw = (g: any) => {
    g.clear();
    g.lineStyle(1, 0x444455, 0.5); // 提亮线条
    for (let i = 0; i <= 20; i++) {
      g.moveTo(i * 40, 0); g.lineTo(i * 40, 800);
      g.moveTo(0, i * 40); g.lineTo(800, i * 40);
    }
  };
  return <Graphics draw={draw} />;
};

// === 战斗单位 (大号、高亮) ===
const Unit = ({ x, y, hp, maxHp, team, role, status, id }: any) => {
  const isDead = status === 'DEAD';
  const color = team === 'BLUE' ? 0x4488ff : 0xff4444; 
  
  const draw = (g: any) => {
    g.clear();
    
    if (isDead) {
      g.beginFill(0x222222);
      g.lineStyle(2, 0x666666);
      g.drawCircle(0, 0, 12);
      g.endFill();
      return;
    }

    // 1. 发光外圈 (白色)
    g.lineStyle(2, 0xffffff, 0.5);
    g.drawCircle(0, 0, 20); // 更大的圈

    // 2. 实体 (鲜艳颜色)
    g.beginFill(color);
    g.lineStyle(0);
    g.drawCircle(0, 0, 14);
    g.endFill();

    // 3. 血条
    const hpPercent = Math.max(0, hp / maxHp);
    g.beginFill(0x000000);
    g.drawRect(-20, -30, 40, 6);
    g.endFill();
    g.beginFill(hpPercent > 0.5 ? 0x00ff00 : 0xff0000);
    g.drawRect(-20, -30, 40 * hpPercent, 6);
    g.endFill();
  };

  return (
    <Container x={x * 40} y={y * 40}>
      <Graphics draw={draw} />
      {!isDead && (
        <Text 
          text={role} 
          anchor={0.5} 
          y={28} 
          style={new TextStyle({ fontSize: 12, fill: '#ffffff', fontWeight: 'bold', stroke: 'black', strokeThickness: 2 })} 
        />
      )}
    </Container>
  );
};

const LaserEffects = ({ attacks }: { attacks: any[] }) => {
  const [visible, setVisible] = useState<any[]>([]);
  useEffect(() => setVisible(attacks.filter(a => Date.now() - a.timestamp < 300)), [attacks]);

  const draw = (g: any) => {
    g.clear();
    visible.forEach(atk => {
      g.lineStyle(4, 0xffffff, 1); // 纯白核心
      g.moveTo(atk.from.x * 40, atk.from.y * 40);
      g.lineTo(atk.to.x * 40, atk.to.y * 40);
      g.lineStyle(8, atk.color, 0.4); // 彩色光晕
      g.moveTo(atk.from.x * 40, atk.from.y * 40);
      g.lineTo(atk.to.x * 40, atk.to.y * 40);
    });
  };
  return <Graphics draw={draw} />;
};

export default function TacticalViewport({ units, attacks, obstacles, floatingTexts }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="text-white text-2xl font-bold flex justify-center items-center h-[800px] bg-[#1e1e2e]">LOADING MAP...</div>;

  return (
    <Stage width={800} height={800} options={{ background: 0x1e1e2e, antialias: true }}>
      <Grid />
      <ObstaclesLayer data={obstacles} />
      <Container sortableChildren={true}>
        {units.map((u: any) => <Unit key={u.id} {...u} zIndex={10} />)}
        <LaserEffects attacks={attacks} />
        {floatingTexts.map((ft: any) => <FloatingText key={ft.id} {...ft} onFinish={()=>{}} />)}
      </Container>
    </Stage>
  );
}