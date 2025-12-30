'use client';
import { Stage, Graphics, Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useEffect, useState } from 'react';

// === 辅助函数：绘制虚线 ===
const drawDashedLine = (g: any, p1: any, p2: any, dashLen = 4, gapLen = 2) => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  let currentDist = 0;

  while (currentDist < dist) {
    // 画实线部分
    const x1 = p1.x + Math.cos(angle) * currentDist;
    const y1 = p1.y + Math.sin(angle) * currentDist;
    currentDist += dashLen;
    const x2 = p1.x + Math.cos(angle) * Math.min(currentDist, dist);
    const y2 = p1.y + Math.sin(angle) * Math.min(currentDist, dist);
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    // 跳过间隔部分
    currentDist += gapLen;
  }
};

// ... FloatingText, Grid, ObstaclesLayer, Unit 保持不变 ...
// (为了节省篇幅，这里省略了未修改的组件代码，请确保你的文件中包含它们)
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
      g.beginFill(0x334155);
      g.lineStyle(1, 0x475569);
      data.forEach((obs: any) => {
        g.drawRect(obs.x * cellSize, obs.y * cellSize, obs.w * cellSize, obs.h * cellSize);
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
    const radius = cellSize * 0.4;
    const draw = (g: any) => {
      g.clear();
      if (isDead) {
        g.beginFill(0x1e293b); g.drawCircle(0, 0, radius); g.endFill(); return;
      }
      g.beginFill(color, 0.05); g.drawCircle(0, 0, radius * 8); g.endFill();
      g.lineStyle(1, 0xffffff, 0.8); g.beginFill(color); g.drawCircle(0, 0, radius); g.endFill();
      const hpW = cellSize; const hpH = cellSize * 0.15; const hpY = -radius - hpH - 2;
      g.beginFill(0x000000); g.drawRect(-hpW/2, hpY, hpW, hpH); g.endFill();
      const hpPercent = Math.max(0, hp / maxHp);
      g.beginFill(hpPercent > 0.5 ? 0x22c55e : 0xff0000);
      g.drawRect(-hpW/2, hpY, hpW * hpPercent, hpH); g.endFill();
    };
    return (
      <Container x={x * cellSize} y={y * cellSize}>
        <Graphics draw={draw} />
      </Container>
    );
};

// === ⚡️ 精致的渐隐虚线弹道 ===
const LaserEffects = ({ attacks, cellSize }: any) => {
  // 使用内部状态来管理渐隐动画
  const [fadingAttacks, setFadingAttacks] = useState<any[]>([]);

  // 将新的攻击加入到渐隐队列中
  useEffect(() => {
    const newAttacks = attacks.filter((a: any) => 
       // 只添加最近 100ms 内的新攻击，防止重复
       Date.now() - a.timestamp < 100 && 
       !fadingAttacks.some(fa => fa.timestamp === a.timestamp)
    );
    if (newAttacks.length > 0) {
      // 初始 alpha 为 1.0
      setFadingAttacks(prev => [...prev, ...newAttacks.map((a:any) => ({...a, alpha: 1.0})) ]);
    }
  }, [attacks]);

  // 动画循环：逐渐降低 alpha
  useEffect(() => {
    let frameId: number;
    const animate = () => {
      setFadingAttacks(prev => {
         // 每帧减少 0.03 透明度，约 30 帧(0.5秒)后消失
         const updated = prev.map(a => ({...a, alpha: a.alpha - 0.03}));
         // 移除完全透明的
         return updated.filter(a => a.alpha > 0);
      });
      frameId = requestAnimationFrame(animate);
    };
    if (fadingAttacks.length > 0) frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [fadingAttacks.length > 0]);

  const draw = (g: any) => {
    g.clear();
    fadingAttacks.forEach((atk: any) => {
      const p1 = { x: atk.from.x * cellSize, y: atk.from.y * cellSize };
      const p2 = { x: atk.to.x * cellSize, y: atk.to.y * cellSize };
      
      // 设置线条样式：极细(1px)，基于透明度 faded alpha
      // 如果是 Miss，透明度更低
      const lineAlpha = atk.alpha * (atk.isMiss ? 0.4 : 0.8);
      g.lineStyle(1, atk.color, lineAlpha);

      // 画虚线
      drawDashedLine(g, p1, p2);

      // 如果命中且透明度较高，在目标点画一个小闪光
      if (!atk.isMiss && atk.alpha > 0.6) {
        g.beginFill(0xffffff, atk.alpha);
        g.drawCircle(p2.x, p2.y, 2);
        g.endFill();
      }
    });
  };
  return <Graphics draw={draw} />;
};

export default function TacticalViewport({ units, attacks, obstacles, floatingTexts, mapSize = 35 }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cellSize = 800 / mapSize; // 动态计算格子大小

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