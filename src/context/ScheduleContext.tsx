import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type {
  AppState, AppAction, Block, ScheduleGrid, ScheduleCell,
  DayNum, Period,
} from '../types';
import { deriveGridFromBlocks } from '../hooks/useScheduleBuilder';

const PERIODS_LIST: Period[] = ['P1', 'P2', 'P3-Early', 'P3-Late', 'P4'];
const DAY_NUMS: DayNum[] = [1, 2, 3, 4];

function makeEmptyCell(): ScheduleCell {
  return { content: '', isDuty: false, isLunch: false, isEmpty: true };
}

function makeEmptyGrid(): ScheduleGrid {
  const grid = {} as ScheduleGrid;
  for (const d of DAY_NUMS) {
    grid[d] = {} as Record<Period, ScheduleCell>;
    for (const p of PERIODS_LIST) {
      grid[d][p] = makeEmptyCell();
    }
  }
  return grid;
}

const DEFAULT_BLOCKS: Block[] = [
  { id: 'A', course: '', grade: '', isPrep: false },
  { id: 'B', course: '', grade: '', isPrep: false },
  { id: 'C', course: '', grade: '', isPrep: false },
  { id: 'D', course: '', grade: '', isPrep: false },
  { id: 'E', course: '', grade: '', isPrep: false },
  { id: 'F', course: '', grade: '', isPrep: false },
  { id: 'G', course: '', grade: '', isPrep: false },
  { id: 'H', course: '', grade: '', isPrep: false },
];

const now = new Date();
// Academic year runs Aug–Jun. In Jul+ of year Y → academic year Y–(Y+1).
// In Jan–Jun of year Y → academic year (Y-1)–Y.
const academicStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

const INITIAL_STATE: AppState = {
  teacherName: '',
  schoolName: '',
  blocks: DEFAULT_BLOCKS,
  scheduleGrid: makeEmptyGrid(),
  icalData: { rotationDays: [], holidays: [], notes: [] },
  selectedMonth: now.getMonth(),
  selectedYear: now.getFullYear(),
  step: 1,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TEACHER_NAME':
      return { ...state, teacherName: action.payload };
    case 'SET_SCHOOL_NAME':
      return { ...state, schoolName: action.payload };
    case 'UPDATE_BLOCK': {
      const blocks = state.blocks.map(b =>
        b.id === action.payload.id ? { ...b, ...action.payload } : b
      );
      return { ...state, blocks };
    }
    case 'UPDATE_CELL': {
      const { dayNum, period, cell } = action.payload;
      const grid = {
        ...state.scheduleGrid,
        [dayNum]: {
          ...state.scheduleGrid[dayNum],
          [period]: { ...state.scheduleGrid[dayNum][period], ...cell },
        },
      };
      return { ...state, scheduleGrid: grid };
    }
    case 'RESET_GRID_FROM_BLOCKS': {
      const grid = deriveGridFromBlocks(state.blocks);
      return { ...state, scheduleGrid: grid };
    }
    case 'SET_ICAL_DATA':
      return { ...state, icalData: { ...state.icalData, ...action.payload } };
    case 'SET_MONTH':
      return { ...state, selectedMonth: action.payload.month, selectedYear: action.payload.year };
    case 'SET_STEP':
      return { ...state, step: action.payload };
    default:
      return state;
  }
}

const STORAGE_KEY = 'cpc-schedule-builder-state';

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure icalData has all required fields (old data may lack 'notes')
      const icalData = {
        ...INITIAL_STATE.icalData,
        ...(parsed.icalData || {}),
      };
      // Always use fresh date values — never restore stale selectedMonth/selectedYear
      return {
        ...INITIAL_STATE,
        ...parsed,
        icalData,
        step: 1,
        selectedMonth: INITIAL_STATE.selectedMonth,
        selectedYear: INITIAL_STATE.selectedYear,
      };
    }
  } catch {}
  return INITIAL_STATE;
}

interface ContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const ScheduleContext = createContext<ContextValue | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      const { step: _step, ...toSave } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  }, [state]);

  return (
    <ScheduleContext.Provider value={{ state, dispatch }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
}
