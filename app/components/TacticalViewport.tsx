'use client';
import { Stage, Graphics, Container, Text } from '@pixi/react';
import { TextStyle } from 'pixi.js';
import { useEffect, useState, useRef } from 'react';

// === 新增：网格背景组件 ===
// 画布 800x800，分为 20x20 格，每格 40px
const Grid = () => {
  const draw = (g: any) => {
    g.clear();
    g.lineStyle(1, 0x333333, 0.3); // 深灰色细线，低透明度
    // 画纵线
    for (let i = 0; i <= 20; i++) {
      g.moveTo(i * 40, 0);
      g.lineTo(i * 40, 800);
    }
    // 画横线
    for (let i = 0; i <= 20; i++) {
      g.moveTo(0, i * 40);
      g.lineTo(800, i * 40);
    }
  };
  return <Graphics draw={draw} />;
};

// === 升级：单位组件 (增加光圈和文字标签) ===
const Unit = ({ x, y, color, id, role }: any) => {
  // 定义文字样式
  const textStyle = new TextStyle({
    fontFamily: ['JetBrains Mono', 'monospace'], // 优先使用我们配置的字体
    fontSize: 12,
    fontWeight: 'bold',
    fill: '#aaaaaa', // 浅灰色文字
    align: 'center',
  });

  const draw = (g: any) => {
    g.clear();
    
    // 1. 范围光圈 (半透明) - 假设感知范围是 3 格
    g.beginFill(color, 0.15);
    g.drawCircle(0, 0, 3 * 40); 
    g.endFill();

    // 2. 单位核心实体
    g.beginFill(color);
    g.lineStyle(2, 0xffffff, 0.8); // 加个白边让它更突出
    g.drawCircle(0, 0, 10);
    g.endFill();
  };

  // 注意：PixiJS 容器坐标是像素值，所以要乘以 40
  return (
    <Container x={x * 40} y={y * 40}>
      <Graphics draw={draw} />
      {/* ID 标签显示在单位上方 */}
      <Text 
        text={id.toUpperCase()} 
        anchor={0.5} 
        y={-25} 
        style={textStyle} 
      />
      {/* 角色标签显示在单位下方，字小一点 */}
      <Text 
        text={`[${role}]`} 
        anchor={0.5} 
        y={25} 
        style={new TextStyle({ ...textStyle, fontSize: 10, fill: color })} 
      />
    </Container>
  );
};

export default function TacticalViewport({ units }: { units: any[] }) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-full h-full flex items-center justify-center text-neutral-600 animate-pulse tracking-widest">INITIALIZING TACTICAL DISPLAY...</div>;

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-[#141414]">
      <Stage 
        width={800} 
        height={800} 
        // 修改背景色为深灰色 (0x141414)，而不是纯黑
        options={{ background: 0x141414, antialias: true, resolution: window.devicePixelRatio || 1 }}
        className="border border-neutral-800 shadow-2xl shadow-black/50 rounded-sm"
      >
        {/* 先画网格在最底层 */}
        <Grid />
        {/* 再画单位层 */}
        <Container sortableChildren={true}>
          {units.map((u) => (
            <Unit key={u.id} {...u} zIndex={10} />
          ))}
        </Container>
      </Stage>
    </div>
  );
}