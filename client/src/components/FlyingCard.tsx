import { useEffect, useState, useRef } from "react";

export interface FlyingCardProps {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLElement | null>;
  sourceRect: DOMRect | null | undefined;
  targetRect: DOMRect | null | undefined;
  duration?: number;
  onComplete?: () => void;
  className?: string;
  isOpen?: boolean;
}

type AnimationPhase = "idle" | "appearing" | "moving" | "disappearing";

export default function FlyingCard({
  children,
  containerRef,
  sourceRect,
  targetRect,
  duration = 500,
  onComplete,
  className = "",
  isOpen = true,
}: FlyingCardProps) {
  const [phase, setPhase] = useState<AnimationPhase>("idle");
  const [positions, setPositions] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    // Clear previous timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!containerRef.current || !sourceRect || !targetRect || !isOpen) {
      setPhase("idle");
      return;
    }

    if (sourceRect.width === 0 && sourceRect.height === 0) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    const start = {
      x: sourceRect.left + sourceRect.width / 2 - containerRect.left,
      y: sourceRect.top + sourceRect.height / 2 - containerRect.top,
    };
    const end = {
      x: targetRect.left + targetRect.width / 2 - containerRect.left,
      y: targetRect.top + targetRect.height / 2 - containerRect.top,
    };

    setPositions({ start, end });

    // Phase 1: Appear (fade in at source)
    setPhase("appearing");

    // Phase 2: Move (after fade in completes)
    const moveTimer = setTimeout(() => {
      setPhase("moving");
    }, 100);
    timersRef.current.push(moveTimer);

    // Phase 3: Disappear (fade out at target)
    const disappearTimer = setTimeout(() => {
      setPhase("disappearing");
    }, 100 + duration);
    timersRef.current.push(disappearTimer);

    // Complete callback
    const completeTimer = setTimeout(
      () => {
        setPhase("idle");
        onComplete?.();
      },
      100 + duration + 200,
    );
    timersRef.current.push(completeTimer);
  }, [sourceRect, targetRect, containerRef, isOpen, duration, onComplete]);

  if (!positions || phase === "idle") return null;

  const { start, end } = positions;

  // Determine current position and styles based on phase
  const getStyles = () => {
    switch (phase) {
      case "appearing":
        return {
          x: start.x,
          y: start.y,
          opacity: 0,
          scale: 0.6,
          rotate: -5,
          transition: "none",
        };
      case "moving":
        return {
          x: end.x,
          y: end.y,
          opacity: 1,
          scale: 1.05,
          rotate: 3,
          transition: `all ${duration}ms ease-in-out`,
        };
      case "disappearing":
        return {
          x: end.x,
          y: end.y,
          opacity: 0,
          scale: 0.9,
          rotate: 0,
          transition: "all 200ms ease-out",
        };
      default:
        return {
          x: start.x,
          y: start.y,
          opacity: 0,
          scale: 0.8,
          rotate: 0,
          transition: "none",
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`absolute pointer-events-none z-50 ${className}`}
      style={{
        left: styles.x,
        top: styles.y,
        opacity: styles.opacity,
        transform: `translate(-50%, -50%) scale(${styles.scale}) rotate(${styles.rotate}deg)`,
        transition: styles.transition,
      }}
    >
      {children}
    </div>
  );
}

export const isVisible = (el: HTMLElement | null | undefined) =>
  el && el.offsetParent !== null;
