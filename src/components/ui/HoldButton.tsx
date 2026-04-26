import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import { cn } from '../../lib/utils';

interface HoldButtonProps {
  onConfirm: () => void;
  children: React.ReactNode;
  className?: string;
  holdTime?: number; // in ms
  colorClass?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export const HoldButton: React.FC<HoldButtonProps> = ({ 
  onConfirm, 
  children, 
  className, 
  holdTime = 1200,
  colorClass = "bg-green-600",
  icon,
  disabled = false
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const isMounted = useRef(false);
  const controls = useAnimation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleStart = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    if (disabled || !isMounted.current) return;
    e.stopPropagation();
    setIsPressing(true);
    controls.start({
      width: '100%',
      transition: { duration: holdTime / 1000, ease: "linear" }
    });

    timerRef.current = setTimeout(() => {
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      onConfirm();
      handleCancel();
    }, holdTime);
  };

  const handleCancel = (e?: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    if (e) e.stopPropagation();
    if (!isMounted.current) return;
    setIsPressing(false);
    controls.stop();
    controls.set({ width: '0%' });
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  return (
    <button
      onPointerDown={handleStart}
      onPointerUp={handleCancel}
      onPointerLeave={handleCancel}
      onMouseDown={handleStart}
      onMouseUp={handleCancel}
      onMouseLeave={handleCancel}
      onTouchStart={handleStart}
      onTouchEnd={handleCancel}
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
      disabled={disabled}
      className={cn(
        "relative overflow-hidden transition-transform select-none cursor-pointer touch-none",
        !disabled && "active:scale-95",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Background Fill Animation */}
      <motion.div
        initial={{ width: '0%' }}
        animate={controls}
        className={cn("absolute inset-0 opacity-30", colorClass)}
      />
      
      {/* Label Content */}
      <div className="relative z-10 flex items-center justify-center gap-2">
        {icon}
        {isPressing ? 'Tahan...' : children}
      </div>
      
      {/* Progress Line */}
      {isPressing && (
        <motion.div 
          className={cn("absolute bottom-0 left-0 h-1", colorClass)}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: holdTime / 1000, ease: "linear" }}
        />
      )}
    </button>
  );
};
