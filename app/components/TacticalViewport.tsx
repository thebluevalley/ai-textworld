'use client';
import { Stage, Graphics, Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useEffect, useState } from 'react';

// === 飘字组件 ===
const FloatingText = ({ x, y, text, color, onFinish }: any) => {
  const [offsetY, setOffsetY] = useState(0);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame++;
      setOffsetY(prev => prev - 1); // 向上飘
      setOpacity(prev => prev - 0.02); // 变淡
      
      if (frame < 50) {
        requestAnimationFrame(animate);
      } else {
        onFinish();
      }
    };
    animate();
  }, []);

  if (opacity <= 0) return null;

  return (
    <Text 
      text={text} 
      x={x * 40} 
      y={y * 40 + offsetY - 30} // 初始位置在头顶
      anchor={0.5}
      style={new TextStyle({
        fontFamily: 'Arial',
        fontSize: 16,
        fontWeight: 'bold',
        fill: color,
        stroke: '#000000',
        strokeThickness: 3,
        dropShadow: true,
        dropShadowDistance: 2,
      })}
      alpha={opacity}
    />
  );
};

// === 障碍物组件 ===
const ObstaclesLayer = ({ data }: { data: any[] }) => {
  const draw = (g: any) => {
    g.clear();
    g.beginFill(0x333333); // 深灰色墙体
    g.lineStyle(2, 0x555555); // 亮灰色边框
    
    data.forEach(obs => {
      g.drawRect(obs.x * 40, obs.y * 40, obs.w * 40, obs.h * 40);
      
      // 画点装饰细节
      g.beginFill(0x222222);
      g.drawCircle((obs.x + 0.5) * 40, (obs.y + 0.5) * 40, 4);
      g.endFill();
    });
    g.endFill();
  };
  return <Graphics draw={draw} />;
};

// === 地板网格 ===
const Grid = () => {
  const draw = (g: any) => {
    g.clear();
    g.lineStyle(1, 0x222222, 1);
    for (let i = 0; i <= 20; i++) {
      g.moveTo(i * 40, 0); g.lineTo(i * 40, 800);
      g.moveTo(0, i * 40); g.lineTo(800, i * 40);
    }
  };
  return <Graphics draw={draw} />;
};

// === 战斗单位 ===
const Unit = ({ x, y, hp, maxHp, team, role, status, id }: any) => {
  const isDead = status === 'DEAD';
  const color = team === 'BLUE' ? 0x3b82f6 : 0xef4444; 
  
  const draw = (g: any) => {
    g.clear();
    
    if (isDead) {
      g.beginFill(0x333333);
      g.drawCircle(0, 0, 10);
      g.endFill();
      return;
    }

    // 1. 选中光圈 (呼吸效果)
    g.lineStyle(1, color, 0.3);
    g.drawCircle(0, 0, 18);

    // 2. 实体 (更大更清晰)
    g.beginFill(color);
    g.lineStyle(2, 0xffffff, 0.8);
    g.drawCircle(0, 0, 12); // 主体变大
    g.endFill();

    // 3. 血条 (更宽，更明显)
    const hpW = 30;
    const hpH = 5;
    const hpY = -28;
    
    // 底色
    g.beginFill(0x000000);
    g.drawRect(-hpW/2, hpY, hpW, hpH);
    g.endFill();
    
    // 血量
    const hpPercent = Math.max(0, hp / maxHp);
    g.beginFill(hpPercent > 0.5 ? 0x22c55e : 0xff0000);
    g.drawRect(-hpW/2, hpY, hpW * hpPercent, hpH);
    g.endFill();
  };

  return (
    <Container x={x * 40} y={y * 40}>
      <Graphics draw={draw} />
      {!isDead && (
        <Text 
          text={`${role}`} 
          anchor={0.5} 
          y={25} 
          style={new TextStyle({ fontSize: 10, fill: '#888', fontWeight: 'bold' })} 
        />
      )}
    </Container>
  );
};

// === 激光层 ===
const LaserEffects = ({ attacks }: { attacks: any[] }) => {
  const [visible, setVisible] = useState<any[]>([]);
  useEffect(() => {
    // 只显示最近 200ms 的攻击
    setVisible(attacks.filter(a => Date.now() - a.timestamp < 200));
  }, [attacks, visible]); // 依赖 visible 触发重绘

  const draw = (g: any) => {
    g.clear();
    visible.forEach(atk => {
      g.lineStyle(3, atk.color, 0.8);
      g.moveTo(atk.from.x * 40, atk.from.y * 40);
      g.lineTo(atk.to.x * 40, atk.to.y * 40);
    });
  };
  return <Graphics draw={draw} />;
};

export default function TacticalViewport({ units, attacks, obstacles, floatingTexts }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="text-white">LOADING...</div>;

  return (
    <div className="relative shadow-2xl border border-white/10 rounded-lg overflow-hidden">
      <Stage width={800} height={800} options={{ background: 0x111111, antialias: true }}>
        <Grid />
        <ObstaclesLayer data={obstacles} />
        
        <Container sortableChildren={true}>
          {units.map((u: any) => <Unit key={u.id} {...u} zIndex={10} />)}
          <LaserEffects attacks={attacks} />
          {/* 飘字层 */}
          {floatingTexts.map((ft: any) => (
             <FloatingText key={ft.id} {...ft} onFinish={()=>{}} />
          ))}
        </Container>
      </Stage>
    </div>
  );
}