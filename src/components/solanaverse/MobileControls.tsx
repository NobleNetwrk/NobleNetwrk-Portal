"use client"
import React, { useState, useRef, useEffect } from 'react'

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  label: string;
}

const Joystick = ({ onMove, label }: JoystickProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const touchId = useRef<number | null>(null);

  // Logic to calculate position
  const updatePosition = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDist = rect.width / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp to circle radius
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    setPos({ x: dx, y: dy });
    // Normalize output -1 to 1. Invert Y.
    onMove(dx / maxDist, -dy / maxDist);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleStart = (e: TouchEvent) => {
      // PREVENT BROWSER SCROLLING
      e.preventDefault();
      
      if (touchId.current === null) {
        const touch = e.changedTouches[0];
        touchId.current = touch.identifier;
        setActive(true);
        updatePosition(touch.clientX, touch.clientY);
      }
    };

    const handleMove = (e: TouchEvent) => {
      // PREVENT BROWSER SCROLLING
      e.preventDefault(); 

      if (touchId.current !== null) {
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (touch) updatePosition(touch.clientX, touch.clientY);
      }
    };

    const handleEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (touchId.current !== null) {
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (touch) {
            touchId.current = null;
            setActive(false);
            setPos({ x: 0, y: 0 });
            onMove(0, 0);
        }
      }
    };

    // Attach "non-passive" listeners which allow us to preventDefault()
    el.addEventListener('touchstart', handleStart, { passive: false });
    el.addEventListener('touchmove', handleMove, { passive: false });
    el.addEventListener('touchend', handleEnd, { passive: false });
    el.addEventListener('touchcancel', handleEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchmove', handleMove);
      el.removeEventListener('touchend', handleEnd);
      el.removeEventListener('touchcancel', handleEnd);
    };
  }, [onMove]); // Re-bind if onMove changes (unlikely)

  return (
    <div
      ref={containerRef}
      // Added 'touch-none' CSS class as a backup
      className={`w-32 h-32 rounded-full border-2 ${active ? 'border-white bg-white/10' : 'border-white/20 bg-black/20'} backdrop-blur-sm relative flex items-center justify-center select-none transition-colors touch-none`}
    >
      <div
        className="w-12 h-12 bg-white/80 rounded-full shadow-lg absolute pointer-events-none"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      />
      {!active && <span className="absolute bottom-4 text-[10px] text-white/50 font-bold uppercase pointer-events-none">{label}</span>}
    </div>
  );
};

interface MobileControlsProps {
  onInput: (type: 'move' | 'look', x: number, y: number) => void;
}

export default function MobileControls({ onInput }: MobileControlsProps) {
  return (
    // Added 'touch-none' to the parent container too
    <div className="absolute bottom-6 left-6 right-6 z-50 flex justify-between items-end md:hidden pointer-events-auto touch-none">
      <Joystick label="Move" onMove={(x, y) => onInput('move', x, y)} />
      <Joystick label="Look" onMove={(x, y) => onInput('look', x, y)} />
    </div>
  );
}