import { useState, useRef } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { parseRotationIcs, parseHolidaysIcs } from '../../hooks/useICalParser';
import type { RotationDay, HolidayEvent } from '../../types';
import './ICalUpload.css';

interface UploadZoneProps {
  label: string;
  description: string;
  icon: string;
  uploaded: boolean;
  count: number;
  onFile: (text: string) => void;
}

function UploadZone({ label, description, icon, uploaded, count, onFile }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => onFile(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`dropzone ${dragging ? 'dragover' : ''} ${uploaded ? 'uploaded' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ics"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div className="dropzone-icon">{uploaded ? '✅' : icon}</div>
      <h4>{uploaded ? `${label} — Loaded` : label}</h4>
      {uploaded ? (
        <p className="uploaded-count">{count} event{count !== 1 ? 's' : ''} loaded</p>
      ) : (
        <p>{description}</p>
      )}
      <span className="dropzone-cta">{uploaded ? 'Click to replace file' : 'Drop .ics file here or click to browse'}</span>
    </div>
  );
}

export default function ICalUpload() {
  const { state, dispatch } = useSchedule();
  const { icalData } = state;
  const [showManual, setShowManual] = useState(false);

  const handleRotation = (text: string) => {
    const rotationDays = parseRotationIcs(text);
    dispatch({ type: 'SET_ICAL_DATA', payload: { rotationDays } });
  };

  const handleHolidays = (text: string) => {
    const holidays = parseHolidaysIcs(text);
    dispatch({ type: 'SET_ICAL_DATA', payload: { holidays } });
  };

  // Build a simple preview map: date string → info
  const rotationMap = new Map(icalData.rotationDays.map(r => [r.date, r.dayNum]));
  const holidayMap = new Map(icalData.holidays.map(h => [h.date, h.name]));

  // Get date range for preview
  const previewMonths = getPreviewMonths(icalData.rotationDays, icalData.holidays);
  const isSyncActive = icalData.rotationDays.length > 0;

  return (
    <div className="ical-upload-step screen-only">
      <div className="step-header">
        <div>
          <h2>Calendar Configurations</h2>
          <p>The rotating schedule days and school holidays are loaded automatically from Firebase Storage.</p>
        </div>
      </div>

      {/* Sync Status Card */}
      <div className="card sync-status-card">
        <div className="sync-status-header">
          <div className="sync-status-badge">
            <span className={`status-dot ${isSyncActive ? 'active' : 'pending'}`} />
            <strong>{isSyncActive ? 'Firebase Sync Active' : 'Connecting to Firebase...'}</strong>
          </div>
          <span className="database-label">gs://cpc-schedule-builder.firebasestorage.app</span>
        </div>
        
        {isSyncActive ? (
          <div className="sync-details mt-4">
            <p className="text-muted">
              Successfully fetched school calendars from Firebase storage. The rotating day sequence (Day 1–4) and holidays are synchronized locally.
            </p>
            <div className="sync-grid mt-4">
              <div className="sync-metric-box">
                <span className="metric-icon">🔄</span>
                <div>
                  <div className="metric-val">{icalData.rotationDays.length}</div>
                  <div className="metric-label">cpc days.ics events</div>
                </div>
              </div>
              <div className="sync-metric-box">
                <span className="metric-icon">📅</span>
                <div>
                  <div className="metric-val">{icalData.holidays.length}</div>
                  <div className="metric-label">cpc teacher days.ics events</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="sync-details mt-4">
            <p className="text-muted">Loading calendar files from Firebase Storage. Please wait...</p>
          </div>
        )}
      </div>

      {/* Collapsible Manual Upload Section */}
      <div className="manual-upload-toggle mt-4">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowManual(!showManual)}>
          {showManual ? 'Hide Advanced Options ▲' : 'Show Advanced / Manual Upload Options ▼'}
        </button>
      </div>

      {showManual && (
        <div className="upload-grid mt-4">
          <div className="upload-section">
            <div className="upload-section-header">
              <h3>Override School Rotation</h3>
              <p>Upload a custom <code>cpc days.ics</code> rotation calendar.</p>
            </div>
            <UploadZone
              label="Rotation Calendar"
              description="Events titled 1, 2, 3, or 4 for each school day"
              icon="🔄"
              uploaded={icalData.rotationDays.length > 0}
              count={icalData.rotationDays.length}
              onFile={handleRotation}
            />
          </div>

          <div className="upload-section">
            <div className="upload-section-header">
              <h3>Override Holidays &amp; Events</h3>
              <p>Upload a custom <code>cpc teacher days.ics</code> holidays calendar.</p>
            </div>
            <UploadZone
              label="Holidays &amp; Events"
              description="PA days, holidays, staff meetings"
              icon="📅"
              uploaded={icalData.holidays.length > 0}
              count={icalData.holidays.length}
              onFile={handleHolidays}
            />
          </div>
        </div>
      )}

      {/* Preview */}
      {isSyncActive && (
        <div className="card preview-card mt-6">
          <h3>Calendar Preview</h3>
          <p className="text-muted mt-2">Showing loaded dates. Rotation days are color-coded; holidays shown in red.</p>
          <div className="preview-months">
            {previewMonths.slice(0, 6).map(({ year, month }) => (
              <MiniMonth
                key={`${year}-${month}`}
                year={year}
                month={month}
                rotationMap={rotationMap}
                holidayMap={holidayMap}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mini Month Calendar ──────────────────────────────────────────────────────

const DAY_COLORS: Record<number, string> = {
  1: '#5b7fff',
  2: '#8b5cf6',
  3: '#06d6a0',
  4: '#f59e0b',
};

function MiniMonth({
  year, month, rotationMap, holidayMap,
}: {
  year: number; month: number;
  rotationMap: Map<string, number>;
  holidayMap: Map<string, string>;
}) {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="mini-month">
      <div className="mini-month-header">{MONTH_NAMES[month]} {year}</div>
      <div className="mini-month-grid">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="mini-day-header">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="mini-cell empty-cell" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayNum = rotationMap.get(dateStr);
          const holiday = holidayMap.get(dateStr);
          return (
            <div
              key={i}
              className={`mini-cell ${holiday ? 'holiday-cell' : dayNum ? 'rotation-cell' : 'no-school-cell'}`}
              style={dayNum && !holiday ? { backgroundColor: DAY_COLORS[dayNum] + '33', borderColor: DAY_COLORS[dayNum] + '66' } : {}}
              title={holiday || (dayNum ? `Day ${dayNum}` : '')}
            >
              <span className="mini-day-num">{day}</span>
              {dayNum && !holiday && <span className="mini-rotation-num" style={{ color: DAY_COLORS[dayNum] }}>{dayNum}</span>}
              {holiday && <span className="mini-holiday-dot">H</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getPreviewMonths(
  rotationDays: RotationDay[],
  holidays: HolidayEvent[],
): { year: number; month: number }[] {
  const dateStrings = [
    ...rotationDays.map(r => r.date),
    ...holidays.map(h => h.date),
  ].sort();

  if (dateStrings.length === 0) return [];

  // Compute the current academic year based on today's date.
  // Academic year runs Aug–Jun. If we're in Jul+ of year Y, the academic year is Y–(Y+1).
  // If we're in Jan–Jun of year Y, the academic year is (Y-1)–Y.
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed: 0=Jan, 6=Jul
  const academicStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;
  // Academic year range: August of academicStartYear through June of academicStartYear+1
  const rangeStart = `${academicStartYear}-08`;
  const rangeEnd = `${academicStartYear + 1}-06`;

  const months = new Set<string>();
  for (const d of dateStrings) {
    const ym = d.slice(0, 7); // "YYYY-MM"
    if (ym >= rangeStart && ym <= rangeEnd) {
      months.add(ym);
    }
  }

  return Array.from(months)
    .sort()
    .map(ym => {
      const [y, m] = ym.split('-');
      return { year: parseInt(y), month: parseInt(m) - 1 };
    });
}
