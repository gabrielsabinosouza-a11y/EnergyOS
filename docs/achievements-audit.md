---
title: energyOS Achievements Audit
created: 2026-08-28
tags: [energyos, achievements, conquistas, badges, obsidian-checklist]
---

# energyOS Achievements Audit

> **Source of truth:** `src/lib/db/achievements.ts`
> (`ACHIEVEMENT_THRESHOLDS` + `META`) and the DB seed in `src/db-schema.sql`.
> All 8 achievements, real tier thresholds pulled directly from config — not
> guessed from the UI.
>
> **Tier-naming pattern used by this codebase:** each achievement has a **single
> title + description** and tiers are a **numeric progression** (Tier 1, 2, 3…).
> There is **no** "Bronze/Silver/Gold" per-tier label scheme. `tierFor()` counts
> how many thresholds the user's value has crossed (0 = locked). The UI shows
> thresholds as plain numbers (e.g. "1/5/20").
>
> **Icons:** one static icon per achievement (`ACHIEVEMENT_ICONS` in
> `src/app/perfil/page.tsx`) — currently no per-tier visual variation.

---

## 1. Streak Master
- **ID:** `streak_master`
- **Title:** Streak Master — *"Mantenha sequências de consistência"*
- **Category:** `streak` (orange)
- **Trigger/metric:** longest streak in days — `max(longest_streak, current_streak)` from `profiles`
- **Unique/one-time badge?** No — normal multi-tier progression
- **Tiers:**
  - [ ] Tier 1 — threshold: **7** days
  - [ ] Tier 2 — threshold: **30** days
  - [ ] Tier 3 — threshold: **100** days
  - [ ] Tier 4 — threshold: **365** days

## 2. Deep Focus
- **ID:** `deep_focus`
- **Title:** Deep Focus — *"Complete sessões longas de foco"*
- **Category:** `focus` (purple)
- **Trigger/metric:** longest **single** focus session in minutes (`getLongestFocusSession`)
- **Unique/one-time badge?** No
- **Tiers:**
  - [ ] Tier 1 — threshold: **25** min
  - [ ] Tier 2 — threshold: **60** min
  - [ ] Tier 3 — threshold: **120** min
  - [ ] Tier 4 — threshold: **240** min

## 3. Early Riser
- **ID:** `early_riser`
- **Title:** Early Riser — *"Faça check-in antes das 7h"*
- **Category:** `checkin` (green)
- **Trigger/metric:** count of daily check-ins made **before 7:00 AM** (`America/Sao_Paulo`) from `daily_checkins`
- **Unique/one-time badge?** No
- **Tiers:**
  - [ ] Tier 1 — threshold: **5** check-ins
  - [ ] Tier 2 — threshold: **25** check-ins
  - [ ] Tier 3 — threshold: **100** check-ins

## 4. Sleep Champion
- **ID:** `sleep_champion`
- **Title:** Sleep Champion — *"Durma 7 horas ou mais"*
- **Category:** `sleep` (sky blue)
- **Trigger/metric:** count of daily check-ins where `sleep_hours >= 7` from `daily_checkins`
- **Unique/one-time badge?** No
- **Tiers:**
  - [ ] Tier 1 — threshold: **10** check-ins
  - [ ] Tier 2 — threshold: **50** check-ins
  - [ ] Tier 3 — threshold: **100** check-ins

## 5. Consistency King
- **ID:** `consistency_king`
- **Title:** Consistency King — *"Semanas perfeitas de check-in"*
- **Category:** `checkin` (green)
- **Trigger/metric:** count of **perfect weeks** = weeks with 7 distinct check-in days (subquery grouping `daily_checkins` by week)
- **Unique/one-time badge?** No
- **Tiers:**
  - [ ] Tier 1 — threshold: **1** perfect week
  - [ ] Tier 2 — threshold: **10** perfect weeks
  - [ ] Tier 3 — threshold: **50** perfect weeks

## 6. XP Olympian
- **ID:** `xp_olympian`
- **Title:** XP Olympian — *"Acumule minutos de foco ao longo da vida"*
- **Category:** `focus` (purple)
- **Trigger/metric:** **lifetime** total focus minutes (`getLifetimeFocusMinutes`) — note: despite the "XP" name it counts minutes, not XP
- **Unique/one-time badge?** No
- **Tiers:**
  - [ ] Tier 1 — threshold: **1,000** min
  - [ ] Tier 2 — threshold: **10,000** min
  - [ ] Tier 3 — threshold: **50,000** min

## 7. Social Spark
- **ID:** `social_spark`
- **Title:** Social Spark — *"Faça amigos e entre em grupos"*
- **Category:** `social` (pink)
- **Trigger/metric:** **accepted friends + groups joined** (sum of `friendships` accepted count and `group_members` count)
- **Unique/one-time badge?** No
- **Tiers:**
  - [ ] Tier 1 — threshold: **1** friend-or-group
  - [ ] Tier 2 — threshold: **5** friends-or-groups
  - [ ] Tier 3 — threshold: **20** friends-or-groups

## 8. Rarest Aura
- **ID:** `rarest_aura`
- **Title:** Rarest Aura — *"Termine no topo da Liga Lendários"*
- **Category:** `league` (yellow)
- **Trigger/metric:** finish at the top of the **Lendas** league. It is **not computed** from a live value — it is **manually unlocked** by `unlockRarestAura()` (called from `league.ts` when a user ends the Lendas group in rank 1).
- **Unique/one-time badge?** ✅ **YES — unique/one-time, single tier** (top 1%, one-time unlock)
- **Tiers:**
  - [ ] Tier 1 — threshold: **1** (unlock once)

---

## Cross-check: code vs. the 8-badge icon prompt

### Achievements that exist in code but have no icon yet
- **None.** All 8 achievements have an icon mapped in `ACHIEVEMENT_ICONS` (`src/app/perfil/page.tsx:57`).

### Achievements from the icon prompt that don't exist in code
- **None.** All 8 designed badges exist in code, 1:1:
  - Social Spark → `social_spark`
  - Streak Master → `streak_master`
  - Deep Focus → `deep_focus`
  - Early Riser → `early_riser`
  - Sleep Champion → `sleep_champion`
  - Consistency King → `consistency_king`
  - XP Olympian → `xp_olympian`
  - Rarest Aura → `rarest_aura`

### 🚩 Mismatch to flag (as requested)
- The earlier icon prompt produced **one static icon + one description per
  achievement**. But **6 of the 8 badges have 3–4 tiers** (Streak Master and
  Deep Focus have 4; Early Riser, Sleep Champion, Consistency King, XP Olympian
  and Social Spark have 3). Only **Rarest Aura** is truly a single-tier unique badge.
- Implication for a future icon redesign: most achievements should get **per-tier
  visual progression** (e.g. duller/simpler at Tier 1 → more elaborate at final tier),
  rather than one flat icon. Nothing in code currently derives per-tier art —
  the codebase binds **one icon keyed by achievement `id`**, so per-tier art
  would need a new lookup (e.g. `ACHIEVEMENT_ICONS[id][tier]`).

---

## Reference — source code location

| What | Where |
|---|---|
| Station-threshold config | `ACHIEVEMENT_THRESHOLDS` in `src/lib/db/achievements.ts:7` |
| Titles / descriptions / categories | `META` in `src/lib/db/achievements.ts:18` |
| Value computation (triggers) | `computeValues()` in `src/lib/db/achievements.ts:38` |
| Tier counting logic | `tierFor()` in `src/lib/db/achievements.ts:29` |
| One-time unlock | `unlockRarestAura()` in `src/lib/db/achievements.ts:190` |
| DB seed rows | `src/db-schema.sql:386` |
| Icons / category colors | `src/app/perfil/page.tsx:44` and `:57` |
