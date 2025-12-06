import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  start?: number;
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function useCountUp({
  start = 0,
  end,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = ''
}: UseCountUpOptions) {
  const [count, setCount] = useState(start);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevEndRef = useRef(end);
  const frameRef = useRef<number>();

  useEffect(() => {
    // Reset animation when end value changes
    if (prevEndRef.current !== end) {
      prevEndRef.current = end;
    }

    setIsAnimating(true);
    const startTime = performance.now();
    const startValue = count;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = startValue + (end - startValue) * easeOutQuart;
      setCount(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration]);

  const formattedValue = `${prefix}${count.toFixed(decimals)}${suffix}`;

  return { value: count, formattedValue, isAnimating };
}
