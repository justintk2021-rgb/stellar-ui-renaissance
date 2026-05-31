import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { useAppearanceStarColors } from "@/hooks/useAppearanceStarColors";

// Floating Particles — tinted with accent appearance
function Particles({
  count,
  accentPrimary,
  accentGlow,
  starWhite,
  isLight,
}: {
  count: number;
  accentPrimary: string;
  accentGlow: string;
  starWhite: string;
  isLight: boolean;
}) {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 25;
    }
    return pos;
  }, [count]);

  const colors = useMemo(() => {
    const palette = [starWhite, accentPrimary, accentGlow];
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const hex = palette[i % palette.length];
      const c = new THREE.Color(hex);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [count, starWhite, accentPrimary, accentGlow]);

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
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.065}
        vertexColors
        transparent
        opacity={isLight ? 0.36 : 0.58}
        sizeAttenuation
      />
    </points>
  );
}

// Background Scene
function BackgroundScene({
  particleCount,
  starCount,
  colors,
}: {
  particleCount: number;
  starCount: number;
  colors: ReturnType<typeof useAppearanceStarColors>;
}) {
  return (
    <>
      <ambientLight intensity={colors.isLight ? 0.35 : 0.2} />
      <Particles
        count={particleCount}
        accentPrimary={colors.accentPrimary}
        accentGlow={colors.accentGlow}
        starWhite={colors.starWhite}
        isLight={colors.isLight}
      />
      <Stars
        radius={100}
        depth={80}
        count={starCount}
        factor={4.8}
        fade
        speed={0.2}
        color={colors.accentGlow}
      />
      <Stars
        radius={80}
        depth={50}
        count={Math.floor(starCount * 0.35)}
        factor={2.1}
        fade
        speed={0.15}
        color={colors.starWhite}
      />
    </>
  );
}

export function AnimatedBackground() {
  const appearanceColors = useAppearanceStarColors();
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

  const particleCount = isSmall ? 60 : 100;
  const starCount = isSmall ? 800 : 2000;

  return (
    <>
      {/* CSS stars — always visible in margins and while WebGL loads */}
      <div className="app-starfield" aria-hidden>
        <div className="app-starfield-glow" aria-hidden />
      </div>
      {!reduced && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Canvas
            camera={{ position: [0, 0, 10], fov: 45 }}
            dpr={[1, 1.5]}
            frameloop={isActive ? "always" : "never"}
            gl={{ antialias: false, powerPreference: "low-power", alpha: true }}
            style={{ background: "transparent" }}
          >
            <Suspense fallback={null}>
              <BackgroundScene
                particleCount={particleCount}
                starCount={starCount}
                colors={appearanceColors}
              />
            </Suspense>
          </Canvas>
        </div>
      )}
    </>
  );
}

