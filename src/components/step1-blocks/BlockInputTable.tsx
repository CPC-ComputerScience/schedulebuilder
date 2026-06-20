import { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import type { BlockId } from '../../types';
import './BlockInputTable.css';

export default function BlockInputTable() {
  const { state, dispatch } = useSchedule();
  const [teacherName, setTeacherName] = useState(state.teacherName);

  const handleTeacherBlur = () => dispatch({ type: 'SET_TEACHER_NAME', payload: teacherName });

  const handleBlockChange = (
    id: BlockId,
    field: 'course' | 'grade' | 'isPrep',
    value: string | boolean
  ) => {
    if (field === 'isPrep') {
      dispatch({
        type: 'UPDATE_BLOCK',
        payload: { id, isPrep: value as boolean, grade: value ? '' : undefined } as any,
      });
    } else {
      dispatch({ type: 'UPDATE_BLOCK', payload: { id, [field]: value } });
    }
  };

  return (
    <div className="block-input-step screen-only">
      <div className="step-header">
        <div>
          <h2>Block Assignments</h2>
          <p>Enter your course code and grade for each block. Toggle "Prep" for preparation periods.</p>
        </div>
      </div>

      {/* Teacher Info */}
      <div className="card teacher-info-card">
        <div className="teacher-fields">
          <div className="field-group">
            <label className="field-label">Teacher Name</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Ms. Johnson"
              value={teacherName}
              onChange={e => setTeacherName(e.target.value)}
              onBlur={handleTeacherBlur}
            />
          </div>
        </div>
      </div>

      {/* Block Table */}
      <div className="card block-table-card">
        <div className="card-header">
          <div>
            <h3>Course Blocks</h3>
            <p className="text-muted mt-2">Blocks A–H map to your rotating schedule periods</p>
          </div>
          <div className="legend">
            <span className="legend-item">
              <span className="legend-dot prep" />
              Prep period
            </span>
            <span className="legend-item">
              <span className="legend-dot grade" />
              Gr. 7–8 = early lunch
            </span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table block-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Block</th>
                <th>Course Code</th>
                <th style={{ width: '110px' }}>Grade</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Prep</th>
              </tr>
            </thead>
            <tbody>
              {state.blocks.map(block => (
                <tr key={block.id} className={block.isPrep ? 'prep-row' : ''}>
                  <td>
                    <span className="block-badge">
                      Block {block.id}
                    </span>
                  </td>
                  <td>
                    <input
                      className={`input${block.isPrep ? ' prep' : ''}`}
                      type="text"
                      placeholder={block.isPrep ? 'prep' : 'e.g. 7ENG-01'}
                      value={block.isPrep ? 'prep' : block.course}
                      disabled={block.isPrep}
                      onChange={e => handleBlockChange(block.id, 'course', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className={`input grade-input${block.isPrep ? ' prep' : ''}`}
                      type="text"
                      placeholder={block.isPrep ? '—' : 'e.g. 7'}
                      value={block.isPrep ? '' : block.grade}
                      disabled={block.isPrep}
                      onChange={e => handleBlockChange(block.id, 'grade', e.target.value)}
                      maxLength={4}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <label className="toggle" title="Mark as prep period">
                      <input
                        type="checkbox"
                        checked={block.isPrep}
                        onChange={e => handleBlockChange(block.id, 'isPrep', e.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lunch-info-banner">
          <span className="lunch-icon">ℹ️</span>
          <div>
            <strong>P3 Lunch Logic</strong>
            <span className="text-muted"> — Grades 7 &amp; 8 have early lunch (P3-Early). Grades 9–12 have late lunch (P3-Late). The schedule grid will auto-assign your lunch period accordingly.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
