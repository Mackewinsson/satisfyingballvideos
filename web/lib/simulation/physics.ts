import {
  BORDER_RADIUS,
  CENTER_X,
  CENTER_Y,
  ERASER_RADIUS_END,
  ERASER_RADIUS_START,
  FINAL_SPEED,
  INITIAL_SPEED,
  JITTER_END,
  JITTER_START,
  RING_RADIUS,
} from "./constants";

export function getTimeCurves(t: number): {
  targetSpeed: number;
  eraserR: number;
  jitter: number;
} {
  const clamped = Math.min(t, 1);
  const ease = clamped ** 1.5;
  const targetSpeed =
    INITIAL_SPEED + (FINAL_SPEED - INITIAL_SPEED) * ease;
  const eraserT = clamped > 0.8 ? Math.max(0, (clamped - 0.8) / 0.2) : 0;
  const eraserR =
    ERASER_RADIUS_START +
    (ERASER_RADIUS_END - ERASER_RADIUS_START) * eraserT;
  const jitter = JITTER_START + (JITTER_END - JITTER_START) * clamped;
  return { targetSpeed, eraserR: Math.floor(eraserR), jitter };
}

export function reflectVelocity(
  bx: number,
  by: number,
  vx: number,
  vy: number,
  jitterAmount: number,
): [number, number] {
  const dx = bx - CENTER_X;
  const dy = by - CENTER_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return [vx, vy];
  const nx = dx / dist;
  const ny = dy / dist;
  const dot = vx * nx + vy * ny;
  let rx = vx - 2 * dot * nx;
  let ry = vy - 2 * dot * ny;
  const jitter = (Math.random() * 2 - 1) * jitterAmount;
  const cosJ = Math.cos(jitter);
  const sinJ = Math.sin(jitter);
  const jx = rx * cosJ - ry * sinJ;
  const jy = rx * sinJ + ry * cosJ;
  return [jx, jy];
}

export function spawnBall(): {
  ballX: number;
  ballY: number;
  velX: number;
  velY: number;
} {
  const spawnAngle = Math.random() * Math.PI * 2;
  const spawnDist = Math.random() * (BORDER_RADIUS - RING_RADIUS - 10);
  const ballX = CENTER_X + Math.cos(spawnAngle) * spawnDist;
  const ballY = CENTER_Y + Math.sin(spawnAngle) * spawnDist;
  const speed = INITIAL_SPEED;
  const angle = Math.random() * Math.PI * 2;
  return {
    ballX,
    ballY,
    velX: speed * Math.cos(angle),
    velY: speed * Math.sin(angle),
  };
}
