import React from 'react';
import './StepIndicator.css';

interface Step {
  number: 1 | 2 | 3 | 4;
  label: string;
  icon: string;
}

const STEPS: Step[] = [
  { number: 1, label: 'Block Input',    icon: '📋' },
  { number: 2, label: 'Schedule Grid',  icon: '🗓️' },
  { number: 3, label: 'Calendar Files', icon: '📁' },
  { number: 4, label: 'Print Preview',  icon: '🖨️' },
];

interface Props {
  current: 1 | 2 | 3 | 4;
  onNavigate: (step: 1 | 2 | 3 | 4) => void;
  teacherName: string;
}

export default function StepIndicator({ current, onNavigate, teacherName }: Props) {
  const visibleSteps = STEPS.filter(step => step.number !== 3 || teacherName === 'Mr Hernandez');

  return (
    <nav className="step-indicator no-print" aria-label="Wizard steps">
      <div className="steps-track">
        {visibleSteps.map((step, i) => {
          const state = step.number < current ? 'done' : step.number === current ? 'active' : 'upcoming';
          return (
            <React.Fragment key={step.number}>
              <button
                className={`step-btn step-${state}`}
                onClick={() => onNavigate(step.number)}
                aria-current={state === 'active' ? 'step' : undefined}
                title={step.label}
              >
                <span className="step-circle">
                  {state === 'done' ? '✓' : step.icon}
                </span>
                <span className="step-label">{step.label}</span>
              </button>
              {i < visibleSteps.length - 1 && (
                <div className={`step-connector ${step.number < current ? 'done' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
