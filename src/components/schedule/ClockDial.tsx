"use client";

import { useRef, useEffect, useState } from "react";

interface ClockDialProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
}

export function ClockDial({ value, max, onChange, label }: ClockDialProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const radius = 80;
  const centerX = 100;
  const centerY = 100;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "var(--glass-bg-hover)";
    ctx.fillRect(0, 0, 200, 200);

    // Draw outer circle
    ctx.strokeStyle = "var(--glass-border)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw center circle
    ctx.fillStyle = "var(--accent)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw tick marks and numbers
    for (let i = 0; i < max; i++) {
      const angle = (i / max) * Math.PI * 2 - Math.PI / 2;
      const x1 = centerX + Math.cos(angle) * (radius - 8);
      const y1 = centerY + Math.sin(angle) * (radius - 8);
      const x2 = centerX + Math.cos(angle) * radius;
      const y2 = centerY + Math.sin(angle) * radius;

      ctx.strokeStyle = i % (max === 24 ? 6 : 15) === 0 ? "var(--text)" : "var(--text-muted)";
      ctx.lineWidth = i % (max === 24 ? 6 : 15) === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw numbers
      if (i % (max === 24 ? 6 : 15) === 0) {
        const numX = centerX + Math.cos(angle) * (radius - 25);
        const numY = centerY + Math.sin(angle) * (radius - 25);
        ctx.fillStyle = "var(--text)";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i === 0 && max === 24 ? 24 : i), numX, numY);
      }
    }

    // Draw current value indicator
    const angle = (value / max) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * (radius - 15);
    const y = centerY + Math.sin(angle) * (radius - 15);

    // Draw line from center to value
    ctx.strokeStyle = "var(--accent)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Draw value circle
    ctx.fillStyle = "var(--accent)";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }, [value, max]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    updateValue(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    updateValue(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    updateValueFromTouch(e);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    updateValueFromTouch(e);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const updateValue = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;

    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;

    let newValue = Math.round((angle / (Math.PI * 2)) * max);
    if (newValue === max) newValue = 0;
    if (newValue < 0) newValue = 0;
    if (newValue >= max) newValue = max - 1;

    onChange(newValue);
  };

  const updateValueFromTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left - centerX;
    const y = e.touches[0].clientY - rect.top - centerY;

    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;

    let newValue = Math.round((angle / (Math.PI * 2)) * max);
    if (newValue === max) newValue = 0;
    if (newValue < 0) newValue = 0;
    if (newValue >= max) newValue = max - 1;

    onChange(newValue);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="cursor-pointer rounded-full border border-[var(--glass-border)]"
        style={{ backgroundColor: "var(--glass-bg-hover)" }}
      />
      {label && (
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--accent)]">
            {String(value).padStart(2, "0")}
          </p>
        </div>
      )}
    </div>
  );
}
