// Lightweight, browser-independent controller utilities for the Quest reality pass.
export function readThumbstick(axes) {
  if (!axes || typeof axes.length !== 'number' || axes.length < 2) return { x: 0, y: 0 };
  const x = Number(axes[axes.length >= 4 ? 2 : 0]);
  const y = Number(axes[axes.length >= 4 ? 3 : 1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const magnitude = Math.hypot(x, y);
  if (magnitude < 0.2) return { x: 0, y: 0 };
  const scale = Math.min(1, magnitude);
  return { x: x / magnitude * scale, y: y / magnitude * scale };
}

export function snapTurnStep(axis, wasArmed) {
  const x = Number.isFinite(axis) ? axis : 0;
  if (Math.abs(x) < 0.35) return { degrees: 0, armed: true };
  if (wasArmed && Math.abs(x) > 0.7)
    return { degrees: x > 0 ? -30 : 30, armed: false };
  return { degrees: 0, armed: wasArmed };
}
