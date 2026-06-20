import { useEffect, useState } from 'react';
import { useSchedule } from './context/ScheduleContext';
import StepIndicator from './components/wizard/StepIndicator';
import BlockInputTable from './components/step1-blocks/BlockInputTable';
import ScheduleGrid from './components/step2-schedule/ScheduleGrid';
import ICalUpload from './components/step3-ical/ICalUpload';
import PrintCalendar from './components/step4-print/PrintCalendar';
import { parseRotationIcs, parseHolidaysIcs, parseNotesIcs } from './hooks/useICalParser';
import './App.css';

function AppInner() {
  const { state, dispatch } = useSchedule();
  const { step, icalData } = state;
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    // If calendars are not yet loaded in context, or notes are missing, fetch them
    if (icalData.rotationDays.length === 0 && icalData.holidays.length === 0 || (icalData.notes || []).length === 0) {
      setLoadingCalendars(true);
      Promise.all([
        fetch(`${import.meta.env.BASE_URL}cpc-days.ics`).then(res => {
          if (!res.ok) throw new Error("Failed to fetch cpc-days");
          return res.text();
        }),
        fetch(`${import.meta.env.BASE_URL}cpc-teacher-days.ics`).then(res => {
          if (!res.ok) throw new Error('Could not download cpc teacher days.ics');
          return res.text();
        })
      ])
        .then(([rotationText, holidaysText]) => {
          const rotationDays = parseRotationIcs(rotationText);
          const holidays = parseHolidaysIcs(holidaysText);
          const notes = parseNotesIcs(rotationText);
          dispatch({
            type: 'SET_ICAL_DATA',
            payload: { rotationDays, holidays, notes }
          });
          setCalendarError(null);
        })
        .catch(err => {
          console.error('Error auto-loading calendar files:', err);
          setCalendarError(err.message || 'Failed to load school calendars from Firebase.');
        })
        .finally(() => {
          setLoadingCalendars(false);
        });
    }
  }, [icalData, dispatch]);

  const goTo = (s: 1 | 2 | 3 | 4) => dispatch({ type: 'SET_STEP', payload: s });

  const showStep3 = state.teacherName === 'Mr Hernandez';
  const visibleSteps = [1, 2, ...(showStep3 ? [3] : []), 4];
  const displayStep = visibleSteps.indexOf(step) + 1;
  const totalSteps = visibleSteps.length;

  const handleNext = () => {
    if (step === 1) {
      dispatch({ type: 'RESET_GRID_FROM_BLOCKS' });
    }
    const currIdx = visibleSteps.indexOf(step);
    if (currIdx < visibleSteps.length - 1) {
      goTo(visibleSteps[currIdx + 1] as any);
    }
  };

  const handleBack = () => {
    const currIdx = visibleSteps.indexOf(step);
    if (currIdx > 0) {
      goTo(visibleSteps[currIdx - 1] as any);
    }
  };

  return (
    <div className="app-root">
      {/* Header */}
      <header className="app-header no-print">
        <div className="container">
          <div className="header-inner">
            <div className="brand">
              <div className="brand-icon">📅</div>
              <div>
                <h1 className="brand-title">Schedule Builder</h1>
                <span className="brand-sub">CPC Printable Calendar</span>
              </div>
            </div>
            <div className="header-actions">
              {state.teacherName && (
                <span className="teacher-chip">👤 {state.teacherName}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="container no-print">
        <StepIndicator current={step} onNavigate={goTo} teacherName={state.teacherName} />
      </div>

      {/* Main content */}
      <main className="main-content">
        <div className="container">
          {calendarError && (
            <div className="alert alert-danger no-print" style={{ background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--color-red)', display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <span>⚠️</span>
              <div>
                <strong>Sync Error:</strong> {calendarError} You can still upload files manually in Step 3.
              </div>
            </div>
          )}
          {loadingCalendars && (
            <div className="alert alert-info no-print" style={{ background: 'var(--color-primary-dim)', border: '1px solid rgba(91,127,255,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--color-primary)', display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <span>🔄</span>
              <div>
                Synchronizing calendar files with Firebase...
              </div>
            </div>
          )}
          <div className="step-content">
            {step === 1 && <BlockInputTable />}
            {step === 2 && <ScheduleGrid />}
            {step === 3 && showStep3 && <ICalUpload />}
            {step === 4 && <PrintCalendar />}
          </div>

          {/* Navigation */}
          <div className="wizard-nav no-print">
            <button
              className="btn btn-ghost"
              onClick={handleBack}
              disabled={step === 1}
            >
              ← Back
            </button>
            <div className="step-counter">Step {displayStep} of {totalSteps}</div>
            {step !== 4 ? (
              <button className="btn btn-primary" onClick={handleNext}>
                {step === 1 ? 'Build Schedule →' : step === 2 && showStep3 ? 'Upload Calendars →' : 'Preview & Print →'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => window.print()}>
                🖨️ Print Calendar
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer no-print">
        <div className="container">
          <p>CPC Schedule Builder · Data saved locally in your browser</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return <AppInner />;
}
