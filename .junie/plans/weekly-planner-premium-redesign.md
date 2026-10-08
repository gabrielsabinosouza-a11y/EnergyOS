# Weekly Planner — Premium Redesign

## Overview
Redesign the weekly planner modal and day cards into a premium planning experience. The recurring system infrastructure is already implemented; this is a visual/UX overhaul.

## Goals
- Replace basic category chips with smart animated category chips (emoji + icon)
- Add a polished planning type toggle (One-Time vs Recurring Weekly)
- Redesign the weekday selector with larger, animated day buttons
- Enhance day cards with better visual hierarchy, icons, and completion states
- Add Section 5 fields: color, icon, time, duration, notes
- Keep all existing functionality intact

## Smart Categories

Replace the existing category system with these premium chips:

| Emoji | Name | Icon |
|-------|------|------|
| ⛪ | Faith | Church |
| 📚 | Study | BookOpen |
| 💼 | Work | Briefcase |
| 🏋️ | Fitness | Dumbbell |
| 🎯 | Goals | Target |
| 🎮 | Hobby | Gamepad2 |
| 👨‍👩‍👧 | Family | Heart |
| 🧠 | Learning | Brain |
| ✨ | Custom | Star |

Each chip shows the emoji + name, with animated selection (scale, glow, color).

## Modal Sections

### Section 1: Activity Name
- Large input: "What are you planning?"
- Character counter (max 60)

### Section 2: Smart Categories
- Beautiful emoji chips with animated selection
- Spring animations on tap/click
- Selected chip glows with category color

### Section 3: Planning Type
- Segmented control: "One-Time" vs "Recurring Weekly"
- Animated toggle with icon

### Section 4: Weekday Selector (if Recurring)
- Large day buttons: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Multi-select with animated fill
- Selected days show the habit color

### Section 5: Additional Options
- Color palette (12 preset colors)
- Icon picker (paper, pencil, book)
- Time (optional)
- Duration (optional)
- Note (optional)
- Start date
- End rule (never / date / count)

## Day Cards Redesign

- Show category emoji on each item
- Better visual hierarchy: emoji + title + time
- Recurring items show a small repeat icon
- Completed items are dimmed with strikethrough
- "+N mais" button for crowded cards
- Empty state with "+" button on hover
- Today's card highlighted with accent color

## File Structure

**Modified files:**
- `src/lib/categories.ts` — Add smart category definitions with emojis
- `src/components/category-chips.tsx` — Redesign with emoji + animations
- `src/components/dashboard/weekly-plan-modal.tsx` — Full redesign with sections
- `src/components/dashboard/weekly-plan.tsx` — Enhanced day cards and item rows

**No new files needed** — all changes are redesigns of existing components.

## Delivery Steps

### ✓ Step 1: Smart categories with emojis
Add emoji-based category definitions and redesign the CategoryChips component with animated selection.

### ✓ Step 2: Redesign the modal
Rewrite weekly-plan-modal.tsx with premium sections, planning type toggle, animated weekday selector, and all fields.

### ✓ Step 3: Enhance day cards
Improve weekly-plan.tsx day cards with emoji icons, better hierarchy, and polished item rows.

### ✓ Step 4: Validate
Run linter, TypeScript check, and tests to verify no regressions.
