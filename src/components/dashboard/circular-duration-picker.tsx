"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface CircularDurationPickerProps {
  value: number;
  onChange: (minutes: number) => void;
  maxDurationMinutes?: number;
  snapIncrement?: number;
  minMinutes?: number;
  size?: number;
  disabled?: boolean;
  accentColor?: string;
  trackColor?: string;
  label?: string;
  centerContent?: React.ReactNode;
}

function clampAndSnap(raw: number, min: number, max: number, snap: number): number {
  const snapped = Math.round(raw / snap) * snap;
  return Math.max(min, Math.min(max, snapped));
}

export function CircularDurationPicker({
  value,
  onChange,
  maxDurationMinutes = 120,
  snapIncrement = 5,
  minMinutes = 10,
  size = 220,
  disabled = false,
  accentColor = "var(--accent)",
  trackColor = "var(--border-subtle)",
  label,
  centerContent,
}: CircularDurationPickerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const valueRef = useRef(value);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 6;
  const handleRadius = 10;

  const fraction = Math.max(0, Math.min(1, value / maxDurationMinutes));
  const arcLength = fraction * circumference;

  const handleAngleDeg = fraction * 360;
  const handleRad = ((handleAngleDeg - 90) * Math.PI) / 180;
  const handleX = cx + radius * Math.cos(handleRad);
  const handleY = cy + radius * Math.sin(handleRad);

  const computeMinutesFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return valueRef.current;
      const rect = svgRef.current.getBoundingClientRect();
      const svgCx = rect.left + rect.width / 2;
      const svgCy = rect.top + rect.height / 2;
      const dx = clientX - svgCx;
      const dy = clientY - svgCy;
      const angle = Math.atan2(dx, -dy);
      let degrees = (angle * 180) / Math.PI;
      if (degrees < 0) degrees += 360;
      const rawMinutes = (degrees / 360) * maxDurationMinutes;
      return clampAndSnap(rawMinutes, minMinutes, maxDurationMinutes, snapIncrement);
    },
    [maxDurationMinutes, minMinutes, snapIncrement],
  );

  function clearWindowListeners(move: (e: PointerEvent) => void, up: (e: PointerEvent) => void) {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  }

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabledRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      setDragging(true);
      svgRef.current?.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        ev.preventDefault();
        if (!draggingRef.current || disabledRef.current) return;
        onChange(computeMinutesFromPointer(ev.clientX, ev.clientY));
      };
      const up = () => {
        draggingRef.current = false;
        setDragging(false);
        clearWindowListeners(move, up);
      };

      move(e.nativeEvent);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [computeMinutesFromPointer, onChange],
  );

  useEffect(() => {
    if (!dragging) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        onChange(clampAndSnap(valueRef.current + snapIncrement, minMinutes, maxDurationMinutes, snapIncrement));
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(clampAndSnap(valueRef.current - snapIncrement, minMinutes, maxDurationMinutes, snapIncrement));
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dragging, onChange, snapIncrement, minMinutes, maxDurationMinutes]);

  const minutes = Math.round(value);
  const displayText = `${String(minutes).padStart(2, "0")}:00`;

  return (
    <div className="circular-duration-picker" style={{ position: "relative", width: size, height: size, maxWidth: "100%" }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="circular-duration-svg"
        style={{ touchAction: "none", cursor: disabled ? "default" : "grab", maxWidth: "100%", height: "auto", display: "block" }}
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
      >
        <defs>
          <filter id="duration-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="handle-shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={accentColor} floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          opacity={0.5}
        />

        {/* Tick marks at snap intervals */}
        {Array.from({ length: Math.floor(maxDurationMinutes / snapIncrement) }, (_, i) => {
          const tickFrac = (i * snapIncrement) / maxDurationMinutes;
          const tickAngle = tickFrac * 360 - 90;
          const tickRad = (tickAngle * Math.PI) / 180;
          const isMajor = i % (60 / snapIncrement) === 0;
          const innerR = radius - (isMajor ? 14 : 10);
          const outerR = radius - 7;
          return (
            <line
              key={i}
              x1={cx + innerR * Math.cos(tickRad)}
              y1={cy + innerR * Math.sin(tickRad)}
              x2={cx + outerR * Math.cos(tickRad)}
              y2={cy + outerR * Math.sin(tickRad)}
              stroke={tickFrac <= fraction ? accentColor : trackColor}
              strokeWidth={isMajor ? 2 : 1}
              opacity={tickFrac <= fraction ? 0.6 : 0.25}
              style={{ transition: "stroke 0.15s, opacity 0.15s" }}
            />
          );
        })}

        {/* Active arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            filter: "url(#duration-glow)",
            transition: dragging ? "none" : "stroke-dasharray 0.15s ease-out, stroke 0.4s ease",
          }}
        />

        {/* Draggable handle */}
        {!disabled && (
          <circle
            cx={handleX}
            cy={handleY}
            r={dragging ? handleRadius + 3 : handleRadius}
            fill={accentColor}
            stroke="var(--bg-primary)"
            strokeWidth={3}
            filter="url(#handle-shadow)"
            style={{
              cursor: "grab",
              transition: dragging ? "none" : "r 0.15s ease-out, fill 0.4s ease, stroke 0.4s ease",
              opacity: disabled ? 0.3 : 1,
            }}
          />
        )}
      </svg>

      {/* Center content — hidden when caller passes centerContent={<></>} */}
      {centerContent !== undefined ? (
        centerContent
      ) : (
        <div
          className="circular-duration-center"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            className="font-mono font-bold text-[var(--text)] drop-shadow-lg"
            style={{ fontSize: size * 0.14 }}
          >
            {displayText}
          </span>
          {label && (
            <span className="text-[10px] text-[var(--text-faint)] mt-0.5">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
