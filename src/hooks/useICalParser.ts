import type { RotationDay, HolidayEvent, DayNum } from '../types';

/**
 * Parses an iCal (.ics) file text.
 * For rotation calendar: all-day events titled "1", "2", "3", or "4"
 * For holidays calendar: all-day events with any title
 */

function parseIcsDate(dtstart: string): string {
  // Handles both DATE (20261005) and DATETIME (20261005T000000Z) formats
  const clean = dtstart.replace(/;[^:]*:/, ':').split(':').pop() || dtstart;
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 8) {
    const year = digits.slice(0, 4);
    const month = digits.slice(4, 6);
    const day = digits.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  return '';
}

interface RawEvent {
  summary: string;
  dtstart: string;
  dtend?: string;
}

function extractEvents(icsText: string): RawEvent[] {
  const events: RawEvent[] = [];
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Unfold continuation lines
  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  let inEvent = false;
  let current: Partial<RawEvent> = {};

  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
    } else if (line === 'END:VEVENT') {
      if (inEvent && current.summary && current.dtstart) {
        events.push({ summary: current.summary, dtstart: current.dtstart });
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('SUMMARY:')) {
        current.summary = line.slice('SUMMARY:'.length).trim();
      } else if (line.startsWith('DTSTART')) {
        current.dtstart = line.trim();
      } else if (line.startsWith('DTEND')) {
        current.dtend = line.trim();
      }
    }
  }

  return events;
}

function expandEventDates(event: RawEvent): string[] {
  const startStr = parseIcsDate(event.dtstart);
  if (!startStr) return [];
  if (!event.dtend) return [startStr];
  
  const endStr = parseIcsDate(event.dtend);
  if (!endStr || startStr === endStr) return [startStr];

  const [sy, sm, sd] = startStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  
  const [ey, em, ed] = endStr.split('-').map(Number);
  const end = new Date(ey, em - 1, ed);

  const dates: string[] = [];
  const current = new Date(start);

  const cleanStart = event.dtstart.replace(/;[^:]*:/, ':').split(':').pop() || '';
  const isAllDay = !cleanStart.includes('T');

  while (current <= end) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    
    // For all-day events, DTEND is exclusive
    if (isAllDay && dateStr === endStr && startStr !== endStr) {
      break;
    }
    dates.push(dateStr);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

export function parseRotationIcs(icsText: string): RotationDay[] {
  const events = extractEvents(icsText);
  const result: RotationDay[] = [];
  const validDays = new Set(['1', '2', '3', '4']);

  for (const event of events) {
    const trimmed = event.summary.trim();
    if (validDays.has(trimmed)) {
      const num = parseInt(trimmed, 10) as DayNum;
      const dates = expandEventDates(event);
      for (const date of dates) {
        result.push({ date, dayNum: num });
      }
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function parseHolidaysIcs(icsText: string): HolidayEvent[] {
  const events = extractEvents(icsText);
  const result: HolidayEvent[] = [];

  for (const event of events) {
    if (event.summary) {
      const dates = expandEventDates(event);
      for (const date of dates) {
        result.push({ date, name: event.summary });
      }
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** Extract non-rotation events from cpc-days.ics (everything that isn't "1","2","3","4"). */
export function parseNotesIcs(icsText: string): HolidayEvent[] {
  const events = extractEvents(icsText);
  const result: HolidayEvent[] = [];
  const rotationDays = new Set(['1', '2', '3', '4']);

  for (const event of events) {
    const trimmed = event.summary.trim();
    if (!rotationDays.has(trimmed) && trimmed) {
      const dates = expandEventDates(event);
      for (const date of dates) {
        result.push({ date, name: trimmed });
      }
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
