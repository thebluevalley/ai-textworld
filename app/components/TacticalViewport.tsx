'use client';
import { Stage, Graphics, Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useEffect, useState } from 'react';

// 网格
const Grid = () => {
  const draw = (g: any) => {
    g.clear();
    g.lineStyle(1, 0x1e293b, 1); // 这里的线颜色要配合背景
    for (let i = 0; i <= 20; i++) {
      g.moveTo(i * 40, 0);
      g.lineTo(i * 40, 800);
      g.moveTo(0, i * 40);
      g.lineTo(800, i * 40);
    }
  };
  return <Graphics draw={draw} />;
};

// 激光特效层
const LaserEffects = ({ attacks }: { attacks: any[] }) => {
  const [visibleAttacks, setVisibleAttacks] = useState<any[]>([]);

  useEffect(() => {
    // 每次 attacks 更新，都把新的加入 visible，并设置定时器移除
    const now = Date.now();
    // 过滤掉超过 300ms 的旧特效
    const recent = attacks.filter(a => now - a.timestamp < 300);
    setVisibleAttacks(recent);
  }, [attacks]);

  const draw = (g: any) => {
    g.clear();
    visibleAttacks.forEach(atk => {
      g.lineStyle(2, atk.color, 0.8);
      g.moveTo(atk.from.x * 40, atk.from.y * 40);
      g.lineTo(atk.to.x * 40, atk.to.y * 40);
      
      // 画个击中点爆炸效果
      g.beginFill(atk.color);
      g.drawCircle(atk.to.x * 40, atk.to.y * 40, 4);
      g.endFill();
    });
  };

  return <Graphics draw={draw} />;
};

// 战斗单位
const Unit = ({ x, y, hp, maxHp, team, role, status, id }: any) => {
  const isDead = status === 'DEAD';
  const color = isDead ? 0x475569 : (team === 'BLUE' ? 0x3b82f6 : 0xef4444); // 蓝 vs 红
  
  const textStyle = new TextStyle({
    fontFamily: ['Arial', 'sans-serif'],
    fontSize: 10,
    fontWeight: 'bold',
    fill: isDead ? '#475569' : (team === 'BLUE' ? '#60a5fa' : '#f87171'),
  });

  const draw = (g: any) => {
    g.clear();
    
    if (isDead) {
      // 尸体：画个叉
      g.lineStyle(2, 0x334155, 1);
      g.moveTo(-10, -10); g.lineTo(10, 10);
      g.moveTo(10, -10); g.lineTo(-10, 10);
      return;
    }

    // 1. 射程/感知圈 (选中或攻击时显示，这里为了视觉丰富一直淡淡显示)
    g.beginFill(color, 0.05);
    g.drawCircle(0, 0, role === 'SNIPER' ? 120 : 80);
    g.endFill();

    // 2. 实体形状 (根据职业变化)
    g.beginFill(color);
    g.lineStyle(2, 0xffffff, 0.8);
    
    if (role === 'LEADER') {
      // 星星/五边形
      g.drawStar(0, 0, 5, 12, 6);
    } else if (role === 'SNIPER') {
      // 三角形
      g.drawRegularPolygon(0, 0, 3, 10, 0);
    } else if (role === 'MEDIC') {
      // 十字 (用两个矩形模拟)
      g.drawRect(-4, -10, 8, 20);
      g.drawRect(-10, -4, 20, 8);
    } else {
      // 突击兵：方形
      g.drawRect(-8, -8, 16, 16);
    }
    g.endFill();

    // 3. HP 条背景
    g.beginFill(0x000000);
    g.drawRect(-15, -25, 30, 4);
    g.endFill();

    // 4. HP 条前景
    const hpPercent = Math.max(0, hp / maxHp);
    const hpColor = hpPercent > 0.5 ? 0x22c55e : (hpPercent > 0.2 ? 0xeab308 : 0xef4444);
    g.beginFill(hpColor);
    g.drawRect(-15, -25, 30 * hpPercent, 4);
    g.endFill();
  };

  return (
    <Container x={x * 40} y={y * 40}>
      <Graphics draw={draw} />
      {!isDead && (
        <Text text={`${role.substring(0,1)}-${id}`} anchor={0.5} y={20} style={textStyle} />
      )}
    </Container>
  );
};

export default function TacticalViewport({ units, attacks }: { units: any[], attacks: any[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="text-cyan-500 animate-pulse">LOADING HOLO-DECK...</div>;

  return (
    <Stage 
      width={800} 
      height={800} 
      options={{ background: 0x0f172a, antialias: true, resolution: 2 }}
    >
      <Grid />
      <Container sortableChildren={true}>
        {units.map((u) => (
          <Unit key={u.id} {...u} zIndex={10} />
        ))}
        {/* 激光层放在最上面 */}
        <LaserEffects attacks={attacks} />
      </Container>
    </Stage>
  );
}