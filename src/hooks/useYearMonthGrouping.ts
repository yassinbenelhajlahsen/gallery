import { useMemo } from "react";
import { parseLocalDateLike } from "../services/deleteService";

export type MonthGroup<T> = {
  key: string;
  monthLabel: string;
  items: T[];
};

export type YearGroup<T> = {
  year: string;
  totalItems: number;
  months: MonthGroup<T>[];
};

const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: "long" });

export function useYearMonthGrouping<T extends { date: string }>(
  items: T[],
): YearGroup<T>[] {
  return useMemo(() => {
    if (!items.length) return [];

    // Parse each item once; carry the timestamp through grouping + sorting.
    type Entry = { item: T; time: number };
    const yearMap = new Map<number, Map<number, Entry[]>>();

    items.forEach((item) => {
      const parsed = parseLocalDateLike(item.date) ?? new Date(0);
      const year = parsed.getFullYear();
      const monthIndex = parsed.getMonth();
      const monthMap = yearMap.get(year) ?? new Map<number, Entry[]>();
      const bucket = monthMap.get(monthIndex) ?? [];
      bucket.push({ item, time: parsed.getTime() });
      monthMap.set(monthIndex, bucket);
      yearMap.set(year, monthMap);
    });

    return Array.from(yearMap.entries())
      .sort(([yearA], [yearB]) => yearB - yearA)
      .map(([year, monthMap]) => {
        const months = Array.from(monthMap.entries())
          .sort(([a], [b]) => b - a)
          .map(([monthIndex, bucket]) => ({
            key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
            monthLabel: MONTH_FORMATTER.format(new Date(year, monthIndex, 1)),
            items: bucket.sort((a, b) => b.time - a.time).map((entry) => entry.item),
          }));

        return {
          year: year.toString(),
          totalItems: months.reduce((n, m) => n + m.items.length, 0),
          months,
        };
      });
  }, [items]);
}
