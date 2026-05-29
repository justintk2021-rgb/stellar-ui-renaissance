import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Based on Framer ShaderFlow — chromatic aberration flowing sine wave.
 * @see https://framer.com/m/ShaderFlow-ukT8.js@tk1ODS2M6mhi1P5hmWCv
 */
export interface SpectraNoiseProps {
  /** Horizontal wave frequency (Framer default: 1) */
  xScale?: number;
  /** Wave amplitude (Framer default: 0.5) */
  yScale?: number;
  /** Radial chromatic distortion (Framer default: 0.05) */
  distortion?: number;
  /** Time step per frame — lower = slower (Framer default: 0.01) */
  animationSpeed?: number;
  /** Line intensity — lower = dimmer (Framer uses ~0.05) */
  brightness?: number;
  /** Ribbon thickness softness */
  thickness?: number;
  resolutionScale?: number;
  fixed?: boolean;
  /** When false, the WebGL loop fully stops (e.g. hero scrolled off-screen). */
  paused?: boolean;
  className?: string;
}

function getEffectiveDpr(resolutionScale: number) {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const cap = isMobile ? 1 : resolutionScale;
  return Math.min(window.devicePixelRatio || 1, cap);
}

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;

uniform vec2 resolution;
uniform float time;
uniform float xScale;
uniform float yScale;
uniform float distortion;
uniform float brightness;
uniform float thickness;

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

  float d = length(p) * distortion;

  float rx = p.x * (1.0 + d);
  float gx = p.x;
  float bx = p.x * (1.0 - d);

  float waveR = p.y + sin((rx + time) * xScale) * yScale;
  float waveG = p.y + sin((gx + time) * xScale) * yScale;
  float waveB = p.y + sin((bx + time) * xScale) * yScale;

  float r = brightness / (abs(waveR) + thickness);
  float g = brightness / (abs(waveG) + thickness);
  float b = brightness / (abs(waveB) + thickness);

  vec3 col = vec3(r, g, b);
  col = col / (1.0 + col * 0.4);

  gl_FragColor = vec4(col, 1.0);
}`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("SpectraNoise:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function SpectraNoise({
  xScale = 1,
  yScale = 0.5,
  distortion = 0.05,
  animationSpeed = 0.01,
  brightness = 0.05,
  thickness = 0.09,
  resolutionScale = 1,
  fixed = true,
  paused = false,
  className,
}: SpectraNoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ xScale, yScale, distortion, animationSpeed, brightness, thickness });
  propsRef.current = { xScale, yScale, distortion, animationSpeed, brightness, thickness };
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const loopControlRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const program = createProgram(gl);
    if (!program) return;

    gl.useProgram(program);

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, -1, 1, 1, 1]);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "resolution")!;
    const uTime = gl.getUniformLocation(program, "time")!;
    const uXScale = gl.getUniformLocation(program, "xScale")!;
    const uYScale = gl.getUniformLocation(program, "yScale")!;
    const uDistortion = gl.getUniformLocation(program, "distortion")!;
    const uBrightness = gl.getUniformLocation(program, "brightness")!;
    const uThickness = gl.getUniformLocation(program, "thickness")!;

    let raf = 0;
    let tabVisible = !document.hidden;
    let timeValue = 0;

    const resize = () => {
      const dpr = getEffectiveDpr(resolutionScale);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uRes, width, height);
    };

    resize();
    window.addEventListener("resize", resize);

    const onVisibility = () => {
      tabVisible = !document.hidden;
      if (tabVisible && !pausedRef.current) startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const drawFrame = () => {
      const p = propsRef.current;
      if (!reduced) {
        timeValue += p.animationSpeed;
      }

      gl.uniform1f(uTime, timeValue);
      gl.uniform1f(uXScale, p.xScale);
      gl.uniform1f(uYScale, p.yScale);
      gl.uniform1f(uDistortion, p.distortion);
      gl.uniform1f(uBrightness, p.brightness);
      gl.uniform1f(uThickness, p.thickness);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const tick = () => {
      raf = 0;
      if (!tabVisible || pausedRef.current) return;
      drawFrame();
      raf = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (raf !== 0 || !tabVisible || pausedRef.current) return;
      raf = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    startLoop();
    loopControlRef.current = { start: startLoop, stop: stopLoop };

    return () => {
      stopLoop();
      loopControlRef.current = null;
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
    };
  }, [resolutionScale]);

  useEffect(() => {
    if (paused) loopControlRef.current?.stop();
    else loopControlRef.current?.start();
  }, [paused]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "inset-0 z-0 pointer-events-none bg-black overflow-hidden",
        fixed ? "fixed" : "absolute",
        className,
      )}
      style={{ contain: "strict", willChange: "transform" }}
      aria-hidden
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
