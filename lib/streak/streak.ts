import { addDays, eachDateInRange, localDateKey } from "@/lib/dates/local-date";

export type StreakPauseRange = {
  start_date: string;
  end_date: string;
};

export type StreakSummary = {
  currentStreak: number;
  longestStreak: number;
  trainedDays: Set<string>;
  pausedDays: Set<string>;
  hasTrainedToday: boolean;
  isPausedToday: boolean;
};

export function pauseDaysFromRanges(pauses: StreakPauseRange[]) {
  const pausedDays = new Set<string>();

  for (const pause of pauses) {
    for (const date of eachDateInRange(pause.start_date, pause.end_date)) {
      pausedDays.add(date);
    }
  }

  return pausedDays;
}

export function calculateCurrentStreak(trainedDays: Set<string>, pausedDays: Set<string>) {
  const streakDays = new Set([...trainedDays, ...pausedDays]);
  let cursor = localDateKey();

  if (!streakDays.has(cursor)) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;

  while (streakDays.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function calculateLongestStreak(trainedDays: Set<string>, pausedDays: Set<string>) {
  const sortedDays = [...new Set([...trainedDays, ...pausedDays])].sort();
  let longest = 0;
  let current = 0;
  let previous: string | null = null;

  for (const day of sortedDays) {
    current = previous && addDays(previous, 1) === day ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }

  return longest;
}

export function summarizeStreak(trainedDays: Set<string>, pauses: StreakPauseRange[]): StreakSummary {
  const pausedDays = pauseDaysFromRanges(pauses);
  const today = localDateKey();

  return {
    currentStreak: calculateCurrentStreak(trainedDays, pausedDays),
    longestStreak: calculateLongestStreak(trainedDays, pausedDays),
    trainedDays,
    pausedDays,
    hasTrainedToday: trainedDays.has(today),
    isPausedToday: pausedDays.has(today)
  };
}
