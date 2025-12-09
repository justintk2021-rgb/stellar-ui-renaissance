import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { Trade } from "@/types/trade";

interface BarProps {
  position: [number, number, number];
  height: number;
  isPositive: boolean;
  index: number;
  pair: string;
  result: number;
  cumulative: number;
  onHover: (data: HoverData | null) => void;
}

interface HoverData {
  trade: number;
  pair: string;
  result: number;
  cumulative: number;
}

function Bar({ position, height, isPositive, index, pair, result, cumulative, onHover }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  const color = isPositive ? "#22c55e" : "#ef4444";
  const hoverColor = isPositive ? "#4ade80" : "#f87171";

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={() => {
        setHovered(true);
        onHover({ trade: index, pair, result, cumulative });
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
      }}
    >
      <boxGeometry args={[0.6, Math.abs(height) || 0.1, 0.6]} />
      <meshStandardMaterial
        color={hovered ? hoverColor : color}
        metalness={0.3}
        roughness={0.4}
        emissive={hovered ? color : "#000000"}
        emissiveIntensity={hovered ? 0.3 : 0}
      />
    </mesh>
  );
}

function Scene({ trades }: { trades: Trade[] }) {
  const [hoverData, setHoverData] = useState<HoverData | null>(null);

  const chartData = useMemo(() => {
    if (trades.length === 0) return [];
    
    let cumulative = 0;
    return trades.map((trade, index) => {
      cumulative += trade.result || 0;
      return {
        trade: index + 1,
        value: cumulative,
        pair: trade.pair,
        result: trade.result,
      };
    });
  }, [trades]);

  const maxAbsValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map(d => Math.abs(d.value)), 1);
  }, [chartData]);

  const scaleFactor = 2 / maxAbsValue;
  const spacing = 1.2;
  const totalWidth = chartData.length * spacing;
  const offsetX = -totalWidth / 2 + spacing / 2;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      {/* Base platform */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[totalWidth + 2, 0.1, 3]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Zero line */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[totalWidth + 1, 0.02, 0.02]} />
        <meshStandardMaterial color="#666666" />
      </mesh>

      {/* Bars */}
      {chartData.map((data, index) => {
        const height = data.value * scaleFactor;
        const yPos = height / 2;
        
        return (
          <Bar
            key={index}
            position={[offsetX + index * spacing, yPos, 0]}
            height={height}
            isPositive={data.value >= 0}
            index={data.trade}
            pair={data.pair}
            result={data.result}
            cumulative={data.value}
            onHover={setHoverData}
          />
        );
      })}

      {/* Trade number labels */}
      {chartData.map((data, index) => (
        <Text
          key={`label-${index}`}
          position={[offsetX + index * spacing, -0.4, 0.8]}
          fontSize={0.25}
          color="#888888"
          anchorX="center"
          anchorY="middle"
        >
          #{data.trade}
        </Text>
      ))}

      {/* Hover tooltip */}
      {hoverData && (
        <Html position={[0, 2.5, 0]} center>
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-2 shadow-xl text-center pointer-events-none">
            <p className="text-xs text-muted-foreground">Trade #{hoverData.trade}: {hoverData.pair}</p>
            <p className={`text-xs font-medium ${hoverData.result >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {hoverData.result >= 0 ? '+' : ''}${hoverData.result.toFixed(2)}
            </p>
            <p className={`text-sm font-bold ${hoverData.cumulative >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              Total: ${hoverData.cumulative.toFixed(2)}
            </p>
          </div>
        </Html>
      )}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={3}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

interface CumulativeBarChart3DProps {
  trades: Trade[];
}

export function CumulativeBarChart3D({ trades }: CumulativeBarChart3DProps) {
  if (trades.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
        No trades to display
      </div>
    );
  }

  return (
    <div className="h-[180px] w-full rounded-lg overflow-hidden bg-gradient-to-b from-background to-muted/20">
      <Canvas
        camera={{ position: [0, 3, 6], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene trades={trades} />
      </Canvas>
    </div>
  );
}
