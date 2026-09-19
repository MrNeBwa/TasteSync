import { useEffect, useRef, useState } from 'react';
import { SearchModeIcon } from './icons';
import type { SearchMode } from '../shared/types/domain';

export type ModeOption = { mode: SearchMode; label: string };

export const MODE_OPTIONS: ModeOption[] = [
  { mode: 'movies', label: 'MOVIES' },
  { mode: 'restaurants', label: 'FOOD' },
  { mode: 'entertainment', label: 'PLAY' },
];

const NOTCH = 120;

function normalizeWheel(acc: number): { steps: number; rest: number } {
  const step = Math.round(acc / 60);
  if (step === 0) return { steps: 0, rest: acc };
  return { steps: step, rest: acc - step * 60 };
}

export function ModeCircle({ mode, onModeChange }: { mode: SearchMode; onModeChange: (mode: SearchMode) => void }) {
  const index = MODE_OPTIONS.findIndex((option) => option.mode === mode);
  const [drag, setDrag] = useState<number | null>(null);
  const [wheelAcc, setWheelAcc] = useState(0);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; prevAngle: number; accumulated: number; fromIndex: number }>({
    active: false,
    prevAngle: 0,
    accumulated: 0,
    fromIndex: 0,
  });

  const rotation = (drag === null ? 0 : drag);

  const angleAt = (clientX: number, clientY: number): number => {
    const el = wheelRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      prevAngle: angleAt(event.clientX, event.clientY),
      accumulated: 0,
      fromIndex: index,
    };
    setDrag(0);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    if (!state.active) return;
    const current = angleAt(event.clientX, event.clientY);
    let delta = current - state.prevAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    state.prevAngle = current;
    state.accumulated += delta;

    const total = state.fromIndex * NOTCH + state.accumulated;
    const steps = Math.round(total / NOTCH);
    const nextIndex = ((steps % MODE_OPTIONS.length) + MODE_OPTIONS.length) % MODE_OPTIONS.length;
    const drift = total - steps * NOTCH;
    setDrag(drift);
    if (steps !== state.fromIndex) {
      state.fromIndex = steps;
      onModeChange(MODE_OPTIONS[nextIndex].mode);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    setDrag(null);
    (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const acc = wheelAcc + (event.deltaY > 0 ? 1 : -1) * Math.min(Math.abs(event.deltaY) / 8, 14);
    const { steps, rest } = normalizeWheel(acc);
    setWheelAcc(steps === 0 ? rest : rest < 0 ? 60 + rest : rest);
    if (steps !== 0) {
      const next = ((index + steps) % MODE_OPTIONS.length + MODE_OPTIONS.length) % MODE_OPTIONS.length;
      onModeChange(MODE_OPTIONS[next].mode);
    }
  };

  useEffect(() => {
    if (drag === null) setWheelAcc(0);
  }, [drag]);

  const wheelRotationDeg = -(index * NOTCH + (rotation === null ? 0 : rotation));

  return (
    <div className="mode-dial" role="group" aria-label="Mode selector">
      <div className="mode-dial-hud">
        {MODE_OPTIONS.map((option, i) => (
          <button
            key={option.mode}
            className={`mode-hud-item ${i === index ? 'active' : ''}`}
            onClick={() => onModeChange(option.mode)}
          >
            <SearchModeIcon mode={option.mode} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <div className="mode-dial-track">
        <div className="mode-dial-pointer" aria-hidden="true" />
        <div
          ref={wheelRef}
          className={`mode-dial-wheel ${drag !== null ? 'dragging' : ''}`}
          style={{ transform: `rotate(${wheelRotationDeg}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {MODE_OPTIONS.map((option, i) => (
            <span
              key={option.mode}
              className="mode-sector-icon"
              style={{ transform: `rotate(${i * NOTCH}deg) translateY(-50px) rotate(${-(i * NOTCH + wheelRotationDeg)}deg)` }}
            >
              <SearchModeIcon mode={option.mode} />
            </span>
          ))}
          <div className="mode-dial-cap">
            <SearchModeIcon mode={mode} />
            <span>{MODE_OPTIONS[index].label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}