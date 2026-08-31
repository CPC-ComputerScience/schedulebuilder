import { AppState, CalendarWeek, CalendarDay, WEEKDAYS, Weekday, Period } from '../types';
import * as XLSX from 'xlsx';

const WEEKDAY_JS: Record<Weekday, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isNoSchoolEvent(name: string | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.includes('no school') || lower.includes('winter break') || lower.includes('march break');
}

function hasNoSchoolNote(notes: string[]): boolean {
  return notes.some(n => isNoSchoolEvent(n));
}

function getCalendarWeeks(state: AppState): CalendarWeek[] {
  const { icalData, scheduleGrid } = state;
  const academicStartYear = 2026;

  const rotationMap = new Map(icalData.rotationDays.map(r => [r.date, r.dayNum]));

  const holidayMap = new Map<string, string[]>();
  for (const h of icalData.holidays) {
    const existing = holidayMap.get(h.date) || [];
    if (!existing.includes(h.name)) existing.push(h.name);
    holidayMap.set(h.date, existing);
  }

  const notesMap = new Map<string, string[]>();
  for (const n of icalData.notes) {
    const existing = notesMap.get(n.date) || [];
    if (!existing.includes(n.name)) existing.push(n.name);
    notesMap.set(n.date, existing);
  }

  let firstAugustDate: Date | null = null;
  const augustHolidays = icalData.holidays.filter(h => {
    const d = parseLocalDate(h.date);
    return d.getFullYear() === academicStartYear && d.getMonth() === 7;
  });
  const augustRotations = icalData.rotationDays.filter(r => {
    const d = parseLocalDate(r.date);
    return d.getFullYear() === academicStartYear && d.getMonth() === 7;
  });
  const allAugustDates: Date[] = [
    ...augustHolidays.map(h => parseLocalDate(h.date)),
    ...augustRotations.map(r => parseLocalDate(r.date)),
  ];
  if (allAugustDates.length > 0) {
    allAugustDates.sort((a, b) => a.getTime() - b.getTime());
    firstAugustDate = allAugustDates[0];
  } else {
    firstAugustDate = new Date(academicStartYear, 7, 24);
  }
  
  const startDate = firstAugustDate;
  const endDate = new Date(academicStartYear + 1, 5, 30);

  const startMonday = new Date(startDate);
  startMonday.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

  const endFriday = new Date(endDate);
  const lastDayOfWeek = (endDate.getDay() + 6) % 7;
  endFriday.setDate(endDate.getDate() + (4 - lastDayOfWeek));

  const weeks: CalendarWeek[] = [];
  let weekNum = 1;
  let current = new Date(startMonday);

  while (current <= endFriday) {
    const week: Partial<CalendarWeek> = { weekNumber: weekNum };

    for (const wd of WEEKDAYS) {
      const date = new Date(current);
      date.setDate(current.getDate() + (WEEKDAY_JS[wd] - 1));

      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayNum = rotationMap.get(dateStr) ?? null;

      const holidayNames = holidayMap.get(dateStr) || [];
      const isHoliday = holidayNames.length > 0;
      const holidayName = holidayNames.length > 0 ? holidayNames.join(' / ') : undefined;

      const dayNotes = notesMap.get(dateStr) || [];

      const day: CalendarDay = {
        date,
        weekday: wd,
        dayNum: dayNum as any,
        holidayName,
        isHoliday,
        notes: dayNotes,
        schedule: dayNum ? scheduleGrid[dayNum as 1 | 2 | 3 | 4] : null,
      };
      (week as any)[wd] = day;
    }

    weeks.push(week as CalendarWeek);
    current.setDate(current.getDate() + 7);
    weekNum++;
  }

  return weeks;
}

function formatDayHeader(day: CalendarDay): string {
  const date = day.date;
  const weekdayLabel = day.weekday.charAt(0).toUpperCase() + day.weekday.slice(1);
  const monthName = MONTH_NAMES[date.getMonth()];
  return `${weekdayLabel} ${monthName} ${date.getDate()}`;
}

export function downloadExcel(state: AppState) {
  const weeks = getCalendarWeeks(state);
  
  const data: any[] = [];
  
  for (const week of weeks) {
    const days = [week.monday, week.tuesday, week.wednesday, week.thursday, week.friday];
    
    // Header Row
    const headerRow = [''];
    for (const day of days) {
      let headerText = formatDayHeader(day);
      if (day.dayNum !== null) {
        headerText += `\n(Day ${day.dayNum})`;
      }
      headerRow.push(headerText);
    }
    data.push(headerRow);
    
    // Notes Row
    const notesRow = ['Notes'];
    for (const day of days) {
      const noSchool = day.dayNum === null || isNoSchoolEvent(day.holidayName) || hasNoSchoolNote(day.notes);
      if (noSchool) {
        notesRow.push('No School');
      } else {
        const allNotes = [];
        if (day.holidayName) allNotes.push(day.holidayName);
        for (const n of day.notes) {
          if (!allNotes.includes(n)) allNotes.push(n);
        }
        notesRow.push(allNotes.join('\n'));
      }
    }
    data.push(notesRow);
    
    // Period rows
    const periods: { label: string, key: Period | 'Homeroom' }[] = [
      { label: 'Period 1\n8:45-10:02', key: 'P1' },
      { label: 'Homeroom', key: 'Homeroom' },
      { label: 'Period 2\n10:22-11:39', key: 'P2' },
      { label: 'Period 3\n11:44-1:01', key: 'P3-Early' },
      { label: 'Period 3\n12:39-1:56', key: 'P3-Late' },
      { label: 'Period 4\n2:01-3:18', key: 'P4' },
    ];
    
    for (const p of periods) {
      const row = [p.label];
      for (const day of days) {
        const noSchool = day.dayNum === null || isNoSchoolEvent(day.holidayName) || hasNoSchoolNote(day.notes);
        if (noSchool) {
          row.push('');
        } else if (p.key === 'Homeroom') {
          row.push('');
        } else {
          const cell = day.schedule?.[p.key as Period];
          if (!cell || cell.isEmpty) {
            row.push('');
          } else {
            let cellText = cell.content || '';
            if (cell.isDuty) cellText = `[Duty]\n${cellText}`;
            if (cell.isLunch) cellText = `[Lunch]\n${cellText}`;
            row.push(cellText);
          }
        }
      }
      data.push(row);
    }
    
    // Blank row separator
    data.push([]);
    data.push([]);
  }

  // Create workbook and worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // Set some column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Period column
    { wch: 20 }, // Mon
    { wch: 20 }, // Tue
    { wch: 20 }, // Wed
    { wch: 20 }, // Thu
    { wch: 20 }, // Fri
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

  // Export
  XLSX.writeFile(workbook, `Schedule_${state.teacherName.replace(/\s+/g, '_')}.xlsx`);
}
