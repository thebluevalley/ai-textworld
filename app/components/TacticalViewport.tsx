'use client';
import { Stage, Graphics, Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useEffect, useState } from 'react';

// ... FloatingText, Grid 保持不变 ...
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
      style={new TextStyle({ fontSize: 16, fontWeight: 'bold', fill: color, stroke: 'black', strokeThickness: 3 })}
    />
  );
};

const Grid = () => {
  const draw = (g: any) => {
    g.clear();
    g.lineStyle(1, 0x333333, 0.5);
    for (let i = 0; i <= 20; i++) {
      g.moveTo(i * 40, 0); g.lineTo(i * 40, 800);
      g.moveTo(0, i * 40); g.lineTo(800, i * 40);
    }
  };
  return <Graphics draw={draw} />;
};

// === 🧱 障碍物渲染 (混凝土风格) ===
const ObstaclesLayer = ({ data }: { data: any[] }) => {
  const draw = (g: any) => {
    g.clear();
    g.beginFill(0x444444); // 混凝土灰
    g.lineStyle(2, 0x666666); // 亮边
    
    data.forEach(obs => {
      g.drawRect(obs.x * 40, obs.y * 40, obs.w * 40, obs.h * 40);
      
      // 画一点简单的“X”纹理表示不可通行
      g.lineStyle(1, 0x333333, 0.5);
      g.moveTo(obs.x * 40, obs.y * 40);
      g.lineTo((obs.x + obs.w) * 40, (obs.y + obs.h) * 40);
    });
    g.endFill();
  };
  return <Graphics draw={draw} />;
};

const Unit = ({ x, y, hp, maxHp, team, role, status, id }: any) => {
  const isDead = status === 'DEAD';
  const color = team === 'BLUE' ? 0x4488ff : 0xff4444; 
  
  const draw = (g: any) => {
    g.clear();
    if (isDead) {
      g.beginFill(0x222222);
      g.drawCircle(0, 0, 10);
      g.endFill();
      // 画个叉
      g.lineStyle(2, 0x555555);
      g.moveTo(-8, -8); g.lineTo(8, 8);
      g.moveTo(8, -8); g.lineTo(-8, 8);
      return;
    }
    
    // 视线锥示意 (简单的三角形，指向随机方向增加动态感)
    g.beginFill(color, 0.1);
    g.drawCircle(0, 0, 25);
    g.endFill();

    // 实体
    g.beginFill(color);
    g.lineStyle(2, 0xffffff, 0.8);
    g.drawCircle(0, 0, 14);
    g.endFill();

    // 血条
    const hpPercent = Math.max(0, hp / maxHp);
    g.beginFill(0x000000);
    g.drawRect(-20, -30, 40, 5);
    g.endFill();
    g.beginFill(hpPercent > 0.5 ? 0x00ff00 : 0xff0000);
    g.drawRect(-20, -30, 40 * hpPercent, 5);
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
          style={new TextStyle({ fontSize: 10, fill: '#ccc', fontWeight: 'bold' })} 
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
      // 命中是实线，没命中(被墙挡住或miss)是低透明度线
      g.lineStyle(atk.isMiss ? 1 : 3, atk.color, atk.isMiss ? 0.3 : 0.8);
      g.moveTo(atk.from.x * 40, atk.from.y * 40);
      g.lineTo(atk.to.x * 40, atk.to.y * 40);
      
      if (!atk.isMiss) {
        g.beginFill(0xffffff);
        g.drawCircle(atk.to.x * 40, atk.to.y * 40, 3);
        g.endFill();
      }
    });
  };
  return <Graphics draw={draw} />;
};

export default function TacticalViewport({ units, attacks, obstacles, floatingTexts }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="text-white">LOADING...</div>;

  return (
    <Stage width={800} height={800} options={{ background: 0x1a1a1a, antialias: true }}>
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