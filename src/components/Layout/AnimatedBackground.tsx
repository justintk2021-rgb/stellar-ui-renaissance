import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

// Floating Particles - White/gray particles
function Particles({ count }: { count: number }) {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 25;
    }
    return pos;
  }, [count]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.015;
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.008;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#ffffff"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

// Background Scene
function BackgroundScene({ particleCount, starCount }: { particleCount: number; starCount: number }) {
  return (
    <>
      <ambientLight intensity={0.2} />
      <Particles count={particleCount} />
      <Stars radius={100} depth={50} count={starCount} factor={3} fade speed={0.3} />
    </>
  );
}

export function AnimatedBackground() {
  // Pause rendering when tab is hidden, and reduce work on small screens / reduced motion
  const [isActive, setIsActive] = useState(true);
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const isSmall = useMemo(
    () => typeof window !== "undefined" && window.innerWidth < 768,
    []
  );

  useEffect(() => {
    const onVis = () => setIsActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (reduced) return null;

  const particleCount = isSmall ? 30 : 50;
  const starCount = isSmall ? 400 : 700;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        dpr={[1, 1.5]}
        frameloop={isActive ? "always" : "never"}
        gl={{ antialias: false, powerPreference: "low-power" }}
      >
        <Suspense fallback={null}>
          <BackgroundScene particleCount={particleCount} starCount={starCount} />
        </Suspense>
      </Canvas>
    </div>
  );
}

