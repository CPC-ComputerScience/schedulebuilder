import type { Block, ScheduleGrid, ScheduleCell, DayNum, Period } from '../types';

const DAY_NUMS: DayNum[] = [1, 2, 3, 4];
const PERIODS: Period[] = ['P1', 'P2', 'P3-Early', 'P3-Late', 'P4'];

function makeEmpty(): ScheduleCell {
  return { content: '', isDuty: false, isLunch: false, isEmpty: true };
}

function makeLunch(): ScheduleCell {
  return { content: 'LUNCH', isDuty: false, isLunch: true, isEmpty: false };
}

function makeClass(course: string): ScheduleCell {
  return { content: course, isDuty: false, isLunch: false, isEmpty: false };
}

function isLowerGrade(grade: string): boolean {
  const g = parseInt(grade, 10);
  return g === 7 || g === 8;
}

function isUpperGrade(grade: string): boolean {
  const g = parseInt(grade, 10);
  return g >= 9 && g <= 12;
}

/**
 * Derives a 4-day schedule grid from the block assignments.
 * 
 * The mapping from the reference image:
 * Day 1: P1=A, P2=B, P3-Early=C(prep/empty), P3-Late=LUNCH, P4=D
 * Day 2: P1=E, P2=LC_DUTY?, P3-Early=G, P3-Late=LUNCH, P4=H
 * Day 3: P1=empty, P2=D, P3-Early=LUNCH, P3-Late=A, P4=B
 * Day 4: P1=G, P2=H, P3-Early=E, P3-Late=LUNCH, P4=empty
 *
 * This is a default mapping — the teacher can override any cell in Step 2.
 *
 * P3 lunch logic:
 *   - If a block assigned to P3 is grade 7 or 8:
 *       P3-Early = class (students go to early lunch, teacher teaches after)
 *       Wait — re-reading the spec: "grades 7&8 eat in first section"
 *       So P3-Early = lunch FOR grade 7-8 students
 *       If teacher has grade 7 class → students eat P3-Early → teacher teaches P3-Late
 *       Teacher's own lunch = when their students are NOT in class
 *       Grade 7 teacher: P3-Early = LUNCH (teacher free), P3-Late = class
 *       Grade 9+ teacher: P3-Early = class, P3-Late = LUNCH (teacher free)
 */

// Default block-to-day-period mapping based on the reference schedule image
// Each entry: [dayNum, period]
type BlockMapping = [DayNum, Period][];

const BLOCK_DEFAULT_SLOTS: Record<string, BlockMapping> = {
  A: [[1, 'P1'], [3, 'P3-Late']],   // appears Day1-P1 and Day3-P3-Late (7ENG-01)
  B: [[1, 'P2'], [3, 'P4']],        // appears Day1-P2 and Day3-P4 (7ENG-02)
  C: [[2, 'P3-Early']],             // prep — Day2-P3
  D: [[1, 'P4'], [2, 'P1']],        // ENL1W-03 Day1-P4, Day2-P1? No...
  E: [[2, 'P1'], [3, 'P2']],        // ENL1W-04 Day2-P1, Day3-P2? No...
  F: [[4, 'P3-Early']],             // prep — Day4-P3
  G: [[2, 'P3-Early'], [4, 'P1']],  // HSP3U-05 Day2-P3, Day4-P1
  H: [[2, 'P4'], [4, 'P2']],        // HSP3U-06 Day2-P4, Day4-P2
};

export function deriveGridFromBlocks(blocks: Block[]): ScheduleGrid {
  // Initialize empty grid
  const grid = {} as ScheduleGrid;
  for (const d of DAY_NUMS) {
    grid[d] = {} as Record<Period, ScheduleCell>;
    for (const p of PERIODS) {
      grid[d][p] = makeEmpty();
    }
  }

  // Set LUNCH for each day in P3 rows where no class is assigned
  // We'll set lunch after placing classes

  // Place each block's class
  for (const block of blocks) {
    if (!block.course && !block.isPrep) continue;

    const slots = BLOCK_DEFAULT_SLOTS[block.id] || [];
    for (const [dayNum, period] of slots) {
      if (block.isPrep) {
        // Prep period — leave as PREP label
        grid[dayNum][period] = {
          content: 'PREP',
          isDuty: false,
          isLunch: false,
          isEmpty: false,
        };
      } else if (period === 'P3-Early' || period === 'P3-Late') {
        // Apply P3 lunch logic
        if (isLowerGrade(block.grade)) {
          // Grade 7-8: students eat early (P3-Early), teacher class in P3-Late
          grid[dayNum]['P3-Early'] = makeLunch();
          grid[dayNum]['P3-Late'] = makeClass(block.course);
        } else if (isUpperGrade(block.grade)) {
          // Grade 9-12: teacher class in P3-Early, teacher lunch in P3-Late
          grid[dayNum]['P3-Early'] = makeClass(block.course);
          grid[dayNum]['P3-Late'] = makeLunch();
        } else {
          // Unknown grade — just place where specified
          grid[dayNum][period] = makeClass(block.course);
        }
      } else {
        grid[dayNum][period] = makeClass(block.course);
      }
    }
  }

  // Fill remaining P3 cells with LUNCH if still empty
  for (const d of DAY_NUMS) {
    if (grid[d]['P3-Early'].isEmpty) {
      grid[d]['P3-Early'] = makeLunch();
    }
    if (grid[d]['P3-Late'].isEmpty) {
      grid[d]['P3-Late'] = makeLunch();
    }
  }

  return grid;
}
