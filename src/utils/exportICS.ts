import { AppState, Period } from '../types';

function formatICSDate(date: Date, timeStr: string): string {
  // timeStr is like "8:45" or "10:02" or "2:01"
  const [hourStr, minStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  
  // Convert 12-hour (afternoon) to 24-hour if it's 1, 2, or 3
  if (hour < 8) {
    hour += 12;
  }

  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(min).padStart(2, '0');

  // Format: YYYYMMDDThhmmss
  // Example: 20260904T084500
  // Note: we can generate "floating" time (no Z) so it respects local timezone of the user importing it
  return `${yyyy}${MM}${dd}T${hh}${mm}00`;
}

const PERIOD_TIMES: Record<Period, { start: string, end: string }> = {
  'P1': { start: '8:45', end: '10:02' },
  'P2': { start: '10:22', end: '11:39' },
  'P3-Early': { start: '11:44', end: '1:01' },
  'P3-Late': { start: '12:39', end: '1:56' },
  'P4': { start: '2:01', end: '3:18' }
};

export function generateICS(state: AppState): string {
  const { icalData, scheduleGrid } = state;
  const rotationMap = new Map(icalData.rotationDays.map(r => [r.date, r.dayNum]));
  
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  // We also want to skip holidays that are "no school"
  const noSchoolDates = new Set<string>();
  for (const h of icalData.holidays) {
    const nameLower = h.name.toLowerCase();
    if (nameLower.includes('no school') || nameLower.includes('winter break') || nameLower.includes('march break')) {
      noSchoolDates.add(h.date);
    }
  }
  for (const n of icalData.notes) {
    const nameLower = n.name.toLowerCase();
    if (nameLower.includes('no school') || nameLower.includes('winter break') || nameLower.includes('march break')) {
      noSchoolDates.add(n.date);
    }
  }

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CPC Schedule Builder//EN',
    'CALSCALE:GREGORIAN',
  ];

  // Generate events for every rotation day
  for (const [dateStr, dayNum] of rotationMap.entries()) {
    if (noSchoolDates.has(dateStr)) continue;

    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    const daySchedule = scheduleGrid[dayNum];
    if (!daySchedule) continue;

    for (const [period, cell] of Object.entries(daySchedule) as [Period, any][]) {
      if (cell.isEmpty || !cell.content) continue;

      const times = PERIOD_TIMES[period];
      const startDT = formatICSDate(dateObj, times.start);
      const endDT = formatICSDate(dateObj, times.end);

      let summary = cell.content;
      if (cell.isDuty) summary = `[Duty] ${summary}`;
      else if (cell.isLunch) summary = `[Lunch] ${summary}`;

      // Generate a unique ID
      const uid = `${dateStr}-${period}-cpc-schedule@schedulebuilder`;

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${startDT}`,
        `DTEND:${endDT}`,
        `SUMMARY:${summary}`,
        'END:VEVENT'
      );
    }
  }

  icsContent.push('END:VCALENDAR');
  
  // Return CRLF string
  return icsContent.join('\r\n');
}

export function downloadICS(state: AppState) {
  const content = generateICS(state);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Schedule_${state.teacherName.replace(/\\s+/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
