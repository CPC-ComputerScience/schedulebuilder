import { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import type { DayNum, Period, ScheduleCell } from '../../types';
import { PERIODS, PERIOD_SHORT_LABELS } from '../../types';
import './ScheduleGrid.css';

const DAY_NUMS: DayNum[] = [1, 2, 3, 4];

interface EditingCell {
  dayNum: DayNum;
  period: Period;
}

export default function ScheduleGrid() {
  const { state, dispatch } = useSchedule();
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');

  const grid = state.scheduleGrid;

  const handleResetGrid = () => {
    if (confirm('Reset the schedule grid from your block assignments? Any custom changes will be lost.')) {
      dispatch({ type: 'RESET_GRID_FROM_BLOCKS' });
    }
  };

  const startEdit = (dayNum: DayNum, period: Period) => {
    setEditing({ dayNum, period });
    setEditValue(grid[dayNum][period].content);
  };

  const commitEdit = () => {
    if (!editing) return;
    const isLunch = editValue.trim().toUpperCase() === 'LUNCH';
    dispatch({
      type: 'UPDATE_CELL',
      payload: {
        dayNum: editing.dayNum,
        period: editing.period,
        cell: {
          content: editValue.trim(),
          isLunch,
          isEmpty: editValue.trim() === '',
        },
      },
    });
    setEditing(null);
  };

  const toggleDuty = (dayNum: DayNum, period: Period) => {
    const cell = grid[dayNum][period];
    dispatch({
      type: 'UPDATE_CELL',
      payload: {
        dayNum,
        period,
        cell: { isDuty: !cell.isDuty },
      },
    });
  };

  const clearCell = (dayNum: DayNum, period: Period) => {
    dispatch({
      type: 'UPDATE_CELL',
      payload: {
        dayNum,
        period,
        cell: { content: '', isDuty: false, isLunch: false, isEmpty: true },
      },
    });
  };

  const getCellClass = (cell: ScheduleCell) => {
    if (cell.isDuty) return 'grid-cell duty';
    if (cell.isLunch) return 'grid-cell lunch';
    if (cell.isEmpty) return 'grid-cell empty';
    return 'grid-cell filled';
  };

  const getPeriodDesc = (period: Period) => {
    if (period === 'P3-Early') return 'Gr. 7–8 eat • Gr. 9–12 class';
    if (period === 'P3-Late')  return 'Gr. 9–12 eat • Gr. 7–8 class';
    return '';
  };

  return (
    <div className="schedule-grid-step screen-only">
      <div className="step-header">
        <div>
          <h2>Schedule Grid</h2>
          <p>Your 4-day rotation schedule. Cells are auto-filled from Block assignments — click any cell to edit. Use ⭐ to mark special duties (highlighted yellow).</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleResetGrid}>
          ↺ Reset from Blocks
        </button>
      </div>

      <div className="grid-legend">
        <span className="legend-pill duty-pill">⭐ Duty / Special</span>
        <span className="legend-pill lunch-pill">🥗 Lunch</span>
        <span className="legend-pill empty-pill">— Empty</span>
      </div>

      <div className="card grid-card">
        <div className="grid-scroll">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="period-col-header">Period</th>
                {DAY_NUMS.map(d => (
                  <th key={d} className="day-col-header">
                    <span className="day-num-badge">Day {d}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <tr key={period} className={period.includes('P3') ? 'p3-row' : ''}>
                  <td className="period-label-cell">
                    <div className="period-name">{PERIOD_SHORT_LABELS[period]}</div>
                    {getPeriodDesc(period) && (
                      <div className="period-desc">{getPeriodDesc(period)}</div>
                    )}
                  </td>
                  {DAY_NUMS.map(dayNum => {
                    const cell = grid[dayNum][period];
                    const isEditingThis = editing?.dayNum === dayNum && editing?.period === period;

                    return (
                      <td key={dayNum} className="grid-td">
                        {isEditingThis ? (
                          <div className="cell-edit-wrapper">
                            <input
                              className="cell-input"
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              placeholder="Course or duty…"
                            />
                          </div>
                        ) : (
                          <div
                            className={getCellClass(cell)}
                            onClick={() => startEdit(dayNum, period)}
                            title="Click to edit"
                          >
                            <span className="cell-content">
                              {cell.isEmpty ? <span className="cell-placeholder">—</span> : cell.content}
                            </span>
                            <div className="cell-actions">
                              <button
                                className={`btn-icon duty-btn${cell.isDuty ? ' active' : ''}`}
                                onClick={e => { e.stopPropagation(); toggleDuty(dayNum, period); }}
                                title={cell.isDuty ? 'Remove duty highlight' : 'Mark as duty'}
                              >⭐</button>
                              {!cell.isEmpty && (
                                <button
                                  className="btn-icon clear-btn"
                                  onClick={e => { e.stopPropagation(); clearCell(dayNum, period); }}
                                  title="Clear cell"
                                >✕</button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid-hint">
          <span>💡 Click any cell to edit its content · Use ⭐ to mark special duties (they print with yellow highlight)</span>
        </div>
      </div>
    </div>
  );
}
