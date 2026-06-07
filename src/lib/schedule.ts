// 课程类型 + 排课配置
export type CourseType = "private" | "student" | "group" | "cardio";

export interface CourseMeta {
  type: CourseType;
  label: string;
  english: string;
  capacity: number;
  price: number; // 元/节
  trialAllowed: boolean;
}

export const COURSE_META: Record<CourseType, CourseMeta> = {
  private: { type: "private", label: "私教器械课", english: "Personal Strength", capacity: 1, price: 800, trialAllowed: false },
  student: { type: "student", label: "中高考应试课", english: "Youth Athletic Test Prep", capacity: 3, price: 300, trialAllowed: false },
  group:   { type: "group",   label: "团操课",       english: "Dynamic Group Class",      capacity: 8, price: 200, trialAllowed: true  },
  cardio:  { type: "cardio",  label: "有氧 Cardio",  english: "Metabolic Conditioning",   capacity: 8, price: 200, trialAllowed: true  },
};

export const HOURS: number[] = [10, 11, 13, 14, 15, 16, 17, 18, 19];

const SCHEDULE: Record<number, Partial<Record<number, CourseType>>> = {
  0: { 10: "private", 11: "private", 13: "cardio", 14: "group", 15: "private", 16: "private", 17: "student", 18: "group", 19: "private" },
  1: { 10: "private", 11: "cardio", 13: "group", 14: "private", 15: "private", 16: "student", 17: "student", 18: "cardio", 19: "private" },
  2: { 10: "group", 11: "private", 13: "private", 14: "cardio", 15: "private", 16: "private", 17: "student", 18: "group", 19: "private" },
  3: { 10: "private", 11: "private", 13: "cardio", 14: "private", 15: "group", 16: "student", 17: "student", 18: "private", 19: "cardio" },
  4: { 10: "cardio", 11: "private", 13: "group", 14: "private", 15: "private", 16: "private", 17: "student", 18: "group", 19: "private" },
  5: { 10: "group", 11: "cardio", 13: "group", 14: "private", 15: "private", 16: "cardio", 17: "group", 18: "private", 19: "private" },
  6: { 10: "cardio", 11: "group", 13: "private", 14: "private", 15: "cardio", 16: "group", 17: "private", 18: "private", 19: "group" },
};

export function courseFor(date: Date, hour: number): CourseType {
  const jsDay = date.getDay();
  const mondayBased = (jsDay + 6) % 7;
  return SCHEDULE[mondayBased]?.[hour] ?? "private";
}

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekDays(start: Date, count = 7): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

export const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function weekdayLabel(d: Date): string {
  const jsDay = d.getDay();
  return WEEKDAY_LABELS[(jsDay + 6) % 7];
}

export function isChinaMobile(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}
