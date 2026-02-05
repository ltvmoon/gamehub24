import { useEffect, useState } from "react";

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

export default function FlyingCard({
  children,
  containerRef,
  sourceRect,
  targetRect,
  duration = 400,
  onComplete,
  className = "",
  isOpen = true,
}: FlyingCardProps) {
  const [animationState, setAnimationState] = useState<{
    startPos: { x: number; y: number };
    endPos: { x: number; y: number };
  } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !sourceRect || !targetRect || !isOpen) return;

    const containerRect = containerRef.current.getBoundingClientRect();

    if (sourceRect.width === 0 && sourceRect.height === 0) return;

    const startPos = {
      x: sourceRect.left + sourceRect.width / 2 - containerRect.left,
      y: sourceRect.top + sourceRect.height / 2 - containerRect.top,
    };
    const endPos = {
      x: targetRect.left + targetRect.width / 2 - containerRect.left,
      y: targetRect.top + targetRect.height / 2 - containerRect.top,
    };

    setAnimationState({ startPos, endPos });
    setIsAnimating(false);

    const timer = setTimeout(() => {
      setIsAnimating(true);
    }, 10);

    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, duration + 50);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [sourceRect, targetRect, containerRef, isOpen, duration, onComplete]);

  if (!animationState || !isOpen) return null;

  const { startPos, endPos } = animationState;
  const currentPos = isAnimating ? endPos : startPos;

  return (
    <div
      className={`absolute pointer-events-none z-50 transition-all ease-out ${className}`}
      style={{
        left: currentPos.x,
        top: currentPos.y,
        transitionDuration: isAnimating ? `${duration}ms` : "0ms",
        transform: `translate(-50%, -50%) ${isAnimating ? "scale(1.1) rotate(5deg)" : "scale(0.8)"}`,
        opacity: isAnimating ? 1 : 0.8,
      }}
    >
      {children}
    </div>
  );
}

export const isVisible = (el: HTMLElement | null | undefined) =>
  el && el.offsetParent !== null;
