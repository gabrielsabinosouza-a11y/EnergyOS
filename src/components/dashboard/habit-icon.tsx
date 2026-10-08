"use client";

import { useState } from "react";
import Image from "next/image";
import type { UserDailyTask } from "@/types";
import { DEFAULT_HABIT_ICON_ID, getHabitAsset } from "@/lib/habit-icons";

interface HabitIconProps {
  habit: Pick<UserDailyTask, "iconType" | "iconValue" | "color" | "title">;
  size?: number;
  className?: string;
}

/** One safe renderer for current and pre-icon-feature habits. */
export function HabitIcon({ habit, size = 22, className = "" }: HabitIconProps) {
  const [failedSource, setFailedSource] = useState("");
  const isEmoji = habit.iconType === "emoji" && Boolean(habit.iconValue);
  const requestedSource = habit.iconType === "image" && Boolean(habit.iconValue)
    ? habit.iconValue
    : getHabitAsset(habit.iconValue).path;
  const src = failedSource === requestedSource
    ? getHabitAsset(DEFAULT_HABIT_ICON_ID).path
    : requestedSource;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}
      style={{ width: size, height: size, backgroundColor: `${habit.color || "#71d4ff"}24` }}
    >
      {isEmoji ? (
        <span className="leading-none" style={{ fontSize: Math.max(14, size * 0.78) }}>{habit.iconValue}</span>
      ) : (
        <Image
          src={src}
          alt={`${habit.title} ícone`}
          width={size}
          height={size}
          unoptimized
          className="h-full w-full object-contain"
          onError={() => setFailedSource(requestedSource)}
        />
      )}
    </span>
  );
}
