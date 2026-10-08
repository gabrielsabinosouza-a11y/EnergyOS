/**
 * Curated subset of 8‑bit icons suitable for the habit icon picker.
 * Organized by category so the picker can group them.
 * Each entry is the filename inside src/icons_8bits/ (including ".png").
 */

export interface HabitIconCategory {
  name: string;
  emoji: string;
  icons: string[];
}

export const HABIT_ICON_CATEGORIES: HabitIconCategory[] = [
  {
    name: "Exercício",
    emoji: "💪",
    icons: [
      "FitBod.png",
      "Google Fit.png",
      "Nike Run Club.png",
      "Strava.png",
      "Under Armour.png",
    ],
  },
  {
    name: "Estudo",
    emoji: "📚",
    icons: [
      "Duolingo.png",
      "Evernote.png",
      "Google Docs.png",
      "Google Keep.png",
      "Google Classroom.png",
    ],
  },
  {
    name: "Sono",
    emoji: "😴",
    icons: [
      "Google Sleep.png",
      "Sleep Cycle.png",
      "Pillow.png",
      "Google Calendar.png",
    ],
  },
  {
    name: "Alimentação",
    emoji: "🍎",
    icons: [
      "Deliveroo.png",
      "Glovo.png",
      "Uber Eats.png",
      "Amazon Shopping.png",
    ],
  },
  {
    name: "Foco",
    emoji: "🎯",
    icons: [
      "Google Calendar.png",
      "Google Tasks.png",
      "Microsoft To Do.png",
      "Todoist.png",
      "TickTick.png",
    ],
  },
  {
    name: "Água",
    emoji: "💧",
    icons: [
      "Google Fit.png",
      "Strava.png",
      "Nike Run Club.png",
      "Under Armour.png",
    ],
  },
  {
    name: "Leitura",
    emoji: "📖",
    icons: [
      "Google Books.png",
      "Google Playstore.png",
      "Kindle.png",
      "Audible.png",
    ],
  },
  {
    name: "Meditação",
    emoji: "🧘",
    icons: [
      "Calm.png",
      "Headspace.png",
      "Google Podcasts.png",
      "Spotify.png",
    ],
  },
  {
    name: "Geral",
    emoji: "⭐",
    icons: [
      "Google Chrome.png",
      "Discord.png",
      "Spotify.png",
      "YouTube.png",
      "Target.png",
    ],
  },
];

/** Flat list of all curated icon filenames. */
export const ALL_HABIT_ICONS = HABIT_ICON_CATEGORIES.flatMap((c) => c.icons);

/**
 * Resolve the import path for an icon filename.
 * Icons live in src/icons_8bits/ and are loaded via next/dynamic import.
 */
export function getIconPath(filename: string): string {
  return `/icons_8bits/${filename}`;
}
