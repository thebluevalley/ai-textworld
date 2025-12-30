'use client';
import { Stage, Graphics, Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useEffect, useState } from 'react';

const drawDashedLine = (g: any, p1: any, p2: any, dashLen = 4, gapLen = 2) => {
  const dx = p2.x - p1.x; const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  let currentDist = 0;
  while (currentDist < dist) {
    const x1 = p1.x + Math.cos(angle) * currentDist;
    const y1 = p1.y + Math.sin(angle) * currentDist;
    currentDist += dashLen;
    const x2 = p1.x + Math.cos(angle) * Math.min(currentDist, dist);
    const y2 = p1.y + Math.sin(angle) * Math.min(currentDist, dist);
    g.moveTo(x1, y1); g.lineTo(x2, y2);
    currentDist += gapLen;
  }
};

// ... FloatingText, Grid, ObstaclesLayer ... (保持不变)
const FloatingText = ({ x, y, text, color, cellSize, onFinish }: any) => {
    const [offsetY, setOffsetY] = useState(0);
    useEffect(() => {
      let frame = 0;
      const animate = () => { frame++; setOffsetY(prev => prev - 0.5); if (frame < 60) requestAnimationFrame(animate); else onFinish(); };
      animate();
    }, []);
    return <Text text={text} x={x * cellSize} y={y * cellSize + offsetY - cellSize} anchor={0.5} style={new TextStyle({ fontSize: cellSize * 0.8, fontWeight: 'bold', fill: color, stroke: 'black', strokeThickness: 2 })} />;
};
const Grid = ({ mapSize, cellSize }: any) => {
    const draw = (g: any) => { g.clear(); g.lineStyle(1, 0x333344, 0.3); for (let i = 0; i <= mapSize; i++) { g.moveTo(i * cellSize, 0); g.lineTo(i * cellSize, 800); g.moveTo(0, i * cellSize); g.lineTo(800, i * cellSize); } };
    return <Graphics draw={draw} />;
};
const ObstaclesLayer = ({ data, cellSize }: any) => {
    const draw = (g: any) => { g.clear(); g.beginFill(0x334155); g.lineStyle(1, 0x475569); data.forEach((obs: any) => { g.drawRect(obs.x * cellSize, obs.y * cellSize, obs.w * cellSize, obs.h * cellSize); g.beginFill(0x1e293b); g.drawRect((obs.x + 0.2) * cellSize, (obs.y + 0.2) * cellSize, (obs.w - 0.4) * cellSize, (obs.h - 0.4) * cellSize); g.endFill(); }); g.endFill(); };
    return <Graphics draw={draw} />;
};

// === 新增：战术移动线 ===
const MoveLines = ({ lines, cellSize }: any) => {
  const draw = (g: any) => {
    g.clear();
    lines.forEach((line: any) => {
      g.lineStyle(1, line.color, 0.3); // 淡淡的线
      const p1 = {x: line.from.x * cellSize, y: line.from.y * cellSize};
      const p2 = {x: line.to.x * cellSize, y: line.to.y * cellSize};
      // 画虚线表示计划路径
      drawDashedLine(g, p1, p2, 6, 4);
      // 终点画个小叉
      g.moveTo(p2.x - 3, p2.y - 3); g.lineTo(p2.x + 3, p2.y + 3);
      g.moveTo(p2.x + 3, p2.y - 3); g.lineTo(p2.x - 3, p2.y + 3);
    });
  };
  return <Graphics draw={draw} />;
};

const Unit = ({ x, y, hp, maxHp, team, role, status, id, cellSize }: any) => {
    const isDead = status === 'DEAD'; const color = team === 'BLUE' ? 0x60a5fa : 0xf87171; const radius = cellSize * 0.4;
    const draw = (g: any) => {
      g.clear(); if (isDead) { g.beginFill(0x1e293b); g.drawCircle(0, 0, radius); g.endFill(); return; }
      g.beginFill(color, 0.05); g.drawCircle(0, 0, radius * 8); g.endFill();
      g.lineStyle(1, 0xffffff, 0.8); g.beginFill(color); g.drawCircle(0, 0, radius); g.endFill();
      
      // 职业标识
      g.lineStyle(2, 0xffffff, 0.9);
      if (role === 'SNIPER') { // 准星
         g.drawCircle(0, 0, radius * 0.5);
         g.moveTo(-radius, 0); g.lineTo(radius, 0); g.moveTo(0, -radius); g.lineTo(0, radius);
      } else if (role === 'MEDIC') { // 十字
         g.moveTo(0, -radius*0.6); g.lineTo(0, radius*0.6); g.moveTo(-radius*0.6, 0); g.lineTo(radius*0.6, 0);
      } else if (role === 'LEADER') { // 星星(简化为菱形)
         g.drawPolygon([-radius*0.4, 0, 0, -radius*0.8, radius*0.4, 0, 0, radius*0.8]);
      }

      const hpW = cellSize; const hpH = cellSize * 0.15; const hpY = -radius - hpH - 2;
      g.beginFill(0x000000); g.drawRect(-hpW/2, hpY, hpW, hpH); g.endFill();
      const hpPercent = Math.max(0, hp / maxHp); g.beginFill(hpPercent > 0.5 ? 0x22c55e : 0xff0000); g.drawRect(-hpW/2, hpY, hpW * hpPercent, hpH); g.endFill();
    };
    return <Container x={x * cellSize} y={y * cellSize}><Graphics draw={draw} /></Container>;
};

// ... LaserEffects, SpeechBubble (保持不变) ...
const LaserEffects = ({ attacks, cellSize }: any) => {
  const [visible, setVisible] = useState<any[]>([]);
  useEffect(() => setVisible(attacks.filter((a: any) => Date.now() - a.timestamp < 300)), [attacks]);
  const draw = (g: any) => { g.clear(); visible.forEach((atk: any) => { g.lineStyle(atk.isMiss ? 1 : 2, atk.color, atk.isMiss ? 0.3 : 0.8); drawDashedLine(g, {x:atk.from.x*cellSize, y:atk.from.y*cellSize}, {x:atk.to.x*cellSize, y:atk.to.y*cellSize}); if (!atk.isMiss) { g.beginFill(0xffffff, 0.8); g.drawCircle(atk.to.x*cellSize, atk.to.y*cellSize, 2); g.endFill(); } }); };
  return <Graphics draw={draw} />;
};
const SpeechBubble = ({ x, y, text, team, cellSize }: any) => {
  const [opacity, setOpacity] = useState(1);
  useEffect(() => { const timer = setTimeout(() => setOpacity(0), 2000); return () => clearTimeout(timer); }, []);
  if (opacity === 0) return null;
  const color = team === 'BLUE' ? 0x60a5fa : 0xf87171;
  const draw = (g: any) => { g.clear(); g.beginFill(0x1e293b, 0.9 * opacity); g.lineStyle(1, color, opacity); g.drawRoundedRect(0, 0, 80, 20, 4); g.moveTo(40, 20); g.lineTo(35, 25); g.lineTo(45, 20); g.endFill(); };
  return <Container x={x * cellSize - 40} y={y * cellSize - cellSize * 2} alpha={opacity}><Graphics draw={draw} /><Text text={text} anchor={0.5} x={40} y={10} style={new TextStyle({ fontSize: 10, fill: '#ffffff', fontFamily: 'Arial', align: 'center' })} /></Container>;
};

export default function TacticalViewport({ units, attacks, obstacles, floatingTexts, thoughts, moveLines, mapSize = 35 }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cellSize = 800 / mapSize; 
  if (!mounted) return <div className="text-white">LOADING BATTLEFIELD...</div>;

  return (
    <Stage width={800} height={800} options={{ background: 0x0f172a, antialias: true }}>
      <Grid mapSize={mapSize} cellSize={cellSize} />
      <ObstaclesLayer data={obstacles} cellSize={cellSize} />
      <Container sortableChildren={true}>
        {/* 新增：绘制移动意图线，放在最底层 */}
        <MoveLines lines={moveLines} cellSize={cellSize} />
        {units.map((u: any) => <Unit key={u.id} {...u} cellSize={cellSize} zIndex={10} />)}
        <LaserEffects attacks={attacks} cellSize={cellSize} />
        {floatingTexts.map((ft: any) => <FloatingText key={ft.id} {...ft} cellSize={cellSize} onFinish={()=>{}} />)}
        {thoughts && thoughts.map((t: any) => <SpeechBubble key={t.id} {...t} cellSize={cellSize} />)}
      </Container>
    </Stage>
  );
}