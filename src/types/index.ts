// ─── Block Input ────────────────────────────────────────────────────────────

export type BlockId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface Block {
  id: BlockId;
  course: string;
  grade: string; // e.g. "7", "9", "" for prep
  isPrep: boolean;
}

// ─── Schedule Grid ──────────────────────────────────────────────────────────

export type DayNum = 1 | 2 | 3 | 4;

// P3-Early = grades 7-8 eat lunch (teacher teaches in P3-Early if grade 7/8)
// P3-Late  = grades 9-12 eat lunch (teacher teaches in P3-Late if grade 9-12)
export type Period = 'P1' | 'P2' | 'P3-Early' | 'P3-Late' | 'P4';

export const PERIODS: Period[] = ['P1', 'P2', 'P3-Early', 'P3-Late', 'P4'];

export const PERIOD_LABELS: Record<Period, string> = {
  'P1': 'Period 1',
  'P2': 'Period 2',
  'P3-Early': 'P3 (Early Lunch)',
  'P3-Late': 'P3 (Late Lunch)',
  'P4': 'Period 4',
};

export const PERIOD_SHORT_LABELS: Record<Period, string> = {
  'P1': 'P1',
  'P2': 'P2',
  'P3-Early': 'P3 (E)',
  'P3-Late': 'P3 (L)',
  'P4': 'P4',
};

export interface ScheduleCell {
  content: string;   // course code, "LUNCH", custom duty, or ""
  isDuty: boolean;   // yellow highlight
  isLunch: boolean;
  isEmpty: boolean;
}

// [dayNum 1-4][period] = cell
export type ScheduleGrid = Record<DayNum, Record<Period, ScheduleCell>>;

// ─── iCal Data ──────────────────────────────────────────────────────────────

export interface RotationDay {
  date: string;      // "YYYY-MM-DD"
  dayNum: DayNum;
}

export interface HolidayEvent {
  date: string;      // "YYYY-MM-DD"
  name: string;
}

export interface ICalData {
  rotationDays: RotationDay[];
  holidays: HolidayEvent[];
  notes: HolidayEvent[];      // non-rotation events from cpc-days.ics
}

// ─── Calendar / Print ───────────────────────────────────────────────────────

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
};

export interface CalendarDay {
  date: Date;
  weekday: Weekday;
  dayNum: DayNum | null;      // null = no school / holiday
  holidayName?: string;
  isHoliday: boolean;
  notes: string[];             // non-rotation events from cpc-days.ics
  schedule: Record<Period, ScheduleCell> | null;
}

export interface CalendarWeek {
  weekNumber: number;
  monday: CalendarDay;
  tuesday: CalendarDay;
  wednesday: CalendarDay;
  thursday: CalendarDay;
  friday: CalendarDay;
}

// ─── App State ──────────────────────────────────────────────────────────────

export interface AppState {
  teacherName: string;
  schoolName: string;
  blocks: Block[];
  scheduleGrid: ScheduleGrid;
  icalData: ICalData;
  selectedMonth: number; // 0-11
  selectedYear: number;
  step: 1 | 2 | 3 | 4;
}

export type AppAction =
  | { type: 'SET_TEACHER_NAME'; payload: string }
  | { type: 'SET_SCHOOL_NAME'; payload: string }
  | { type: 'UPDATE_BLOCK'; payload: Partial<Block> & { id: BlockId } }
  | { type: 'UPDATE_CELL'; payload: { dayNum: DayNum; period: Period; cell: Partial<ScheduleCell> } }
  | { type: 'RESET_GRID_FROM_BLOCKS' }
  | { type: 'SET_ICAL_DATA'; payload: Partial<ICalData> }
  | { type: 'SET_MONTH'; payload: { month: number; year: number } }
  | { type: 'SET_STEP'; payload: 1 | 2 | 3 | 4 };
