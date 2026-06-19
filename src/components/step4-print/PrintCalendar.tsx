import React, { useMemo, useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import type { CalendarDay, CalendarWeek, Period, Weekday } from '../../types';
import { WEEKDAYS, WEEKDAY_LABELS } from '../../types';
import './PrintCalendar.css';

const WEEKDAY_JS: Record<Weekday, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5,
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const MONTH_FULL_NAMES = MONTH_NAMES;

/** Safely parse a "YYYY-MM-DD" string as LOCAL midnight (avoids UTC→local day shift). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Returns true if the event name indicates "no school" (full day off) */
function isNoSchoolEvent(name: string | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.includes('no school') || lower.includes('winter break') || lower.includes('march break');
}

/** Check if any string in a list triggers the no-school condition */
function hasNoSchoolNote(notes: string[]): boolean {
  return notes.some(n => isNoSchoolEvent(n));
}

/** Derive the list of academic years that have data in the ICS. */
function getAvailableAcademicYears(
  icalData: { rotationDays: { date: string }[]; holidays: { date: string }[] },
): number[] {
  const years = new Set<number>();
  const allDates = [
    ...icalData.rotationDays.map(r => r.date),
    ...icalData.holidays.map(h => h.date),
  ];
  for (const d of allDates) {
    const parsed = parseLocalDate(d);
    const y = parsed.getFullYear();
    const m = parsed.getMonth();
    // Aug–Dec → academic year starts that calendar year
    // Jan–Jun → academic year started the previous calendar year
    const academicYear = m >= 6 ? y : y - 1;
    years.add(academicYear);
  }
  return Array.from(years).sort((a, b) => a - b);
}

function useCalendarWeeks(printFullYear: boolean, academicStartYear: number): CalendarWeek[] {
  const { state } = useSchedule();
  const { selectedMonth, selectedYear, icalData, scheduleGrid } = state;

  return useMemo(() => {
    const rotationMap = new Map(icalData.rotationDays.map(r => [r.date, r.dayNum]));
    const holidayMap = new Map(icalData.holidays.map(h => [h.date, h.name]));

    const notesMap = new Map<string, string[]>();
    for (const n of icalData.notes) {
      const existing = notesMap.get(n.date) || [];
      existing.push(n.name);
      notesMap.set(n.date, existing);
    }

    let startDate: Date;
    let endDate: Date;

    if (printFullYear) {
      // Find the earliest event in August of the selected academic start year
      let firstAugustDate: Date | null = null;

      // Check holidays in August
      const augustHolidays = icalData.holidays.filter(h => {
        const d = parseLocalDate(h.date);
        return d.getFullYear() === academicStartYear && d.getMonth() === 7; // August = index 7
      });

      // Check rotation days in August
      const augustRotations = icalData.rotationDays.filter(r => {
        const d = parseLocalDate(r.date);
        return d.getFullYear() === academicStartYear && d.getMonth() === 7;
      });

      // Collect all August dates and find the earliest
      const allAugustDates: Date[] = [
        ...augustHolidays.map(h => parseLocalDate(h.date)),
        ...augustRotations.map(r => parseLocalDate(r.date)),
      ];

      if (allAugustDates.length > 0) {
        allAugustDates.sort((a, b) => a.getTime() - b.getTime());
        firstAugustDate = allAugustDates[0];
      } else {
        // Default to August 24th of the selected academic start year
        firstAugustDate = new Date(academicStartYear, 7, 24);
      }

      startDate = firstAugustDate;
      endDate = new Date(academicStartYear + 1, 5, 30); // June 30th of the next year
    } else {
      // Find all weeks that contain at least one day in the selected month
      startDate = new Date(selectedYear, selectedMonth, 1);
      endDate = new Date(selectedYear, selectedMonth + 1, 0);
    }

    // Start from the Monday of the first week
    const startMonday = new Date(startDate);
    startMonday.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

    // End at the Friday of the last week
    const endFriday = new Date(endDate);
    const lastDayOfWeek = (endDate.getDay() + 6) % 7; // 0=Mon
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
        const holidayName = holidayMap.get(dateStr);
        const isHoliday = !!holidayName;
        const dayNotes = notesMap.get(dateStr) || [];

        const day: CalendarDay = {
          date,
          weekday: wd,
          dayNum: dayNum as any,
          holidayName,
          isHoliday,
          notes: dayNotes,
          schedule: dayNum ? scheduleGrid[dayNum as 1|2|3|4] : null,
        };
        (week as any)[wd] = day;
      }

      weeks.push(week as CalendarWeek);
      current.setDate(current.getDate() + 7);
      weekNum++;
    }

    return weeks;
  }, [selectedMonth, selectedYear, icalData, scheduleGrid, printFullYear, academicStartYear]);
}

function formatDayHeader(day: CalendarDay): string {
  const date = day.date;
  const weekdayLabel = WEEKDAY_LABELS[day.weekday];
  const monthName = MONTH_FULL_NAMES[date.getMonth()];
  return `${weekdayLabel} ${monthName} ${date.getDate()}`;
}

// ─── Cell renderer ──────────────────────────────────────────────────────────
function PrintCell({ day, period }: { day: CalendarDay; period: Period }) {

  // A day is "no school" if it has no dayNum OR if any holiday/note says "no school" / "winter break" / "march break"
  const noSchool = day.dayNum === null || isNoSchoolEvent(day.holidayName) || hasNoSchoolNote(day.notes);

  if (noSchool) {
    return <td className="print-cell-empty print-cell-day-off"></td>;
  }

  if (!day.schedule || !day.dayNum) {
    return <td className="print-cell-empty"></td>;
  }

  const cell = day.schedule[period];
  if (!cell || cell.isEmpty) return <td className="print-cell-empty"></td>;

  const cellClass = [
    'print-cell-standard',
    cell.isDuty ? 'print-cell-duty' : '',
    cell.isLunch ? 'print-cell-lunch' : ''
  ].filter(Boolean).join(' ');

  return (
    <td className={cellClass}>
      <div className="print-cell-main-content">{cell.content}</div>
    </td>
  );
}

// ─── Notes cell: shows holiday/event text + notes from cpc-days.ics ─────────
function NotesCell({ day, className = '' }: { day: CalendarDay; className?: string }) {
  const noSchool = day.dayNum === null || isNoSchoolEvent(day.holidayName) || hasNoSchoolNote(day.notes);
  const cellClass = [
    'print-notes-cell',
    noSchool ? 'print-cell-day-off' : '',
    className,
  ].filter(Boolean).join(' ');

  // Combine holiday name + notes into a single list, deduped
  const allNotes: string[] = [];
  if (day.holidayName) allNotes.push(day.holidayName);
  for (const n of day.notes) {
    if (!allNotes.includes(n)) allNotes.push(n);
  }

  return (
    <td className={cellClass}>
      {allNotes.map((note, i) => (
        <div key={i} className="print-event-text">{note}</div>
      ))}
    </td>
  );
}

// ─── Empty/homeroom cell that respects "no school" greying ───────────────────
function EmptyCell({ day }: { day: CalendarDay }) {
  const noSchool = day.dayNum === null || isNoSchoolEvent(day.holidayName) || hasNoSchoolNote(day.notes);
  return <td className={`print-cell-empty ${noSchool ? 'print-cell-day-off' : ''}`}></td>;
}

interface PageProps {
  week: CalendarWeek;
}

// ─── Page 1: Mon / Tue / Wed ─────────────────────────────────────────────────
function PrintPageMTW({ week }: PageProps) {
  const days = [week.monday, week.tuesday, week.wednesday];

  return (
    <div className="print-page print-page-portrait">
      <table className="print-table">
        <thead>
          <tr>
            <th className="print-label-col" style={{ width: '15%' }}></th>
            {days.map((day, idx) => (
              <th key={idx} style={{ width: '28.33%' }}>
                {formatDayHeader(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Notes (top) — shows all events */}
          <tr className="row-notes-top">
            <td className="print-label-cell">Notes</td>
            {days.map((day, idx) => (
              <NotesCell key={idx} day={day} />
            ))}
          </tr>

          {/* Period 1 */}
          <tr className="row-period-p1">
            <td className="print-label-cell">
              <strong>Period 1</strong>
              <div className="period-time">8:45–10:02</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P1" />
            ))}
          </tr>

          {/* Homeroom */}
          <tr className="row-homeroom">
            <td className="print-label-cell">
              <strong>Homeroom</strong>
            </td>
            {days.map((day, idx) => (
              <EmptyCell key={idx} day={day} />
            ))}
          </tr>

          {/* Period 2 */}
          <tr className="row-period-p2">
            <td className="print-label-cell">
              <strong>Period 2</strong>
              <div className="period-time">10:22–11:39</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P2" />
            ))}
          </tr>

          {/* Period 3 (Early) */}
          <tr className="row-period-p3-early">
            <td className="print-label-cell">
              <strong>Period 3</strong>
              <div className="period-time">11:44–1:01</div>
              <div className="lunch-time">1st Lunch</div>
              <div className="lunch-time">11:44–12:34</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P3-Early" />
            ))}
          </tr>

          {/* Period 3 (Late) */}
          <tr className="row-period-p3-late">
            <td className="print-label-cell">
              <strong>Period 3</strong>
              <div className="period-time">12:39–1:56</div>
              <div className="lunch-time">2nd Lunch</div>
              <div className="lunch-time">1:06–1:56</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P3-Late" />
            ))}
          </tr>

          {/* Period 4 */}
          <tr className="row-period-p4">
            <td className="print-label-cell">
              <strong>Period 4</strong>
              <div className="period-time">2:01–3:18</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P4" />
            ))}
          </tr>

          {/* Notes (bottom) */}
          <tr className="row-notes-bottom">
            <td className="print-label-cell">Notes</td>
            {days.map((day, idx) => {
              const noSchool = day.dayNum === null || isNoSchoolEvent(day.holidayName) || hasNoSchoolNote(day.notes);
              return (
                <td key={idx} className={`print-notes-cell ${noSchool ? 'print-cell-day-off' : ''}`}></td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Page 2: Thu / Fri / To Do ───────────────────────────────────────────────
function PrintPageTF({ week }: PageProps) {
  const days = [week.thursday, week.friday];

  return (
    <div className="print-page print-page-portrait">
      <table className="print-table">
        <thead>
          <tr>
            <th className="print-label-col" style={{ width: '15%' }}></th>
            {days.map((day, idx) => (
              <th key={idx} style={{ width: '25%' }}>
                {formatDayHeader(day)}
              </th>
            ))}
            <th className="print-todo-col-header" style={{ width: '35%' }}>To Do</th>
          </tr>
        </thead>
        <tbody>
          {/* Notes (top) — shows all events */}
          <tr className="row-notes-top">
            <td className="print-label-cell">Notes</td>
            {days.map((day, idx) => (
              <NotesCell key={idx} day={day} />
            ))}
            <td rowSpan={8} className="print-todo-cell"></td>
          </tr>

          {/* Period 1 */}
          <tr className="row-period-p1">
            <td className="print-label-cell">
              <strong>Period 1</strong>
              <div className="period-time">8:45–10:02</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P1" />
            ))}
          </tr>

          {/* Homeroom */}
          <tr className="row-homeroom">
            <td className="print-label-cell">
              <strong>Homeroom</strong>
            </td>
            {days.map((day, idx) => (
              <EmptyCell key={idx} day={day} />
            ))}
          </tr>

          {/* Period 2 */}
          <tr className="row-period-p2">
            <td className="print-label-cell">
              <strong>Period 2</strong>
              <div className="period-time">10:22–11:39</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P2" />
            ))}
          </tr>

          {/* Period 3 (Early) */}
          <tr className="row-period-p3-early">
            <td className="print-label-cell">
              <strong>Period 3</strong>
              <div className="period-time">11:44–1:01</div>
              <div className="lunch-time">1st Lunch</div>
              <div className="lunch-time">11:44–12:34</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P3-Early" />
            ))}
          </tr>

          {/* Period 3 (Late) */}
          <tr className="row-period-p3-late">
            <td className="print-label-cell">
              <strong>Period 3</strong>
              <div className="period-time">12:39–1:56</div>
              <div className="lunch-time">2nd Lunch</div>
              <div className="lunch-time">1:06–1:56</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P3-Late" />
            ))}
          </tr>

          {/* Period 4 */}
          <tr className="row-period-p4">
            <td className="print-label-cell">
              <strong>Period 4</strong>
              <div className="period-time">2:01–3:18</div>
            </td>
            {days.map((day, idx) => (
              <PrintCell key={idx} day={day} period="P4" />
            ))}
          </tr>

          {/* Notes (bottom) */}
          <tr className="row-notes-bottom">
            <td className="print-label-cell">Notes</td>
            {days.map((day, idx) => {
              const noSchool = day.dayNum === null || isNoSchoolEvent(day.holidayName) || hasNoSchoolNote(day.notes);
              return (
                <td key={idx} className={`print-notes-cell ${noSchool ? 'print-cell-day-off' : ''}`}></td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Print Calendar component ───────────────────────────────────────────
export default function PrintCalendar() {
  const { state, dispatch } = useSchedule();
  const [printFullYear, setPrintFullYear] = useState(true);

  // Derive available academic years from ICS data
  const availableYears = useMemo(
    () => getAvailableAcademicYears(state.icalData),
    [state.icalData],
  );

  // Default to 2026
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(2026);

  const weeks = useCalendarWeeks(printFullYear, selectedAcademicYear);

  const { selectedMonth, selectedYear } = state;

  const changeMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    dispatch({ type: 'SET_MONTH', payload: { month: m, year: y } });
  };

  const hasData = state.icalData.rotationDays.length > 0;

  return (
    <div className="print-calendar-step">
      {/* Screen controls — hidden on print */}
      <div className="print-controls screen-only no-print">
        <div className="controls-left">
          <h2>Print Preview</h2>
          <p>Select a month or print the full school year (Aug – Jun). Each week is formatted as 2 portrait pages.</p>
        </div>
        <div className="controls-right">
          <label className="flex items-center gap-2 cursor-pointer mr-4" style={{ userSelect: 'none', color: 'var(--color-text)' }}>
            <input
              type="checkbox"
              checked={printFullYear}
              onChange={e => setPrintFullYear(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Print entire year (Aug – Jun)</span>
          </label>

          {printFullYear && availableYears.length > 0 && (
            <div className="year-selector">
              <select
                className="btn btn-ghost btn-sm"
                value={selectedAcademicYear}
                onChange={e => setSelectedAcademicYear(parseInt(e.target.value, 10))}
                style={{
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '0.9rem',
                }}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    {y}–{y + 1}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!printFullYear && (
            <div className="month-selector">
              <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(-1)}>‹ Prev</button>
              <span className="current-month">{MONTH_NAMES[selectedMonth]} {selectedYear}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(1)}>Next ›</button>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {!hasData && (
        <div className="card no-data-notice screen-only">
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📁</div>
            <h3>No rotation calendar loaded</h3>
            <p className="mt-2">Go back to Step 3 and upload your school rotation iCal file to see the full schedule.</p>
          </div>
        </div>
      )}

      {/* Print preview wrapper */}
      <div className="print-preview-wrapper print-calendar">
        {weeks.map((week) => (
          <React.Fragment key={week.weekNumber}>
            <PrintPageMTW week={week} />
            <PrintPageTF week={week} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
