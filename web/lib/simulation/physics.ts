import { CENTER_X, CENTER_Y } from "./constants";
import type { StudioConfig } from "./types";

export function targetDurationMs(config: StudioConfig): number {
  return config.targetTime * 1000;
}

/**
 * Hypnotic ball physics: gravity → move → circle boundary reflect (Gemini template).
 */
export function resolveCircleCollision(
  ballX: number,
  ballY: number,
  velX: number,
  velY: number,
  containerRadius: number,
  ballRadius: number,
  restitution: number,
): {
  ballX: number;
  ballY: number;
  velX: number;
  velY: number;
  collided: boolean;
} {
  const dx = ballX - CENTER_X;
  const dy = ballY - CENTER_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = containerRadius - ballRadius;

  if (dist <= maxDist || dist === 0) {
    return { ballX, ballY, velX, velY, collided: false };
  }

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = dist - maxDist;
  const correctedX = ballX - nx * overlap;
  const correctedY = ballY - ny * overlap;

  const dot = velX * nx + velY * ny;
  const newVx = (velX - 2 * dot * nx) * restitution;
  const newVy = (velY - 2 * dot * ny) * restitution;

  return {
    ballX: correctedX,
    ballY: correctedY,
    velX: newVx,
    velY: newVy,
    collided: true,
  };
}

/** Template-style drop: slightly off-center with horizontal launch speed. */
export function createDropInitialState(config: StudioConfig): {
  ballX: number;
  ballY: number;
  velX: number;
  velY: number;
} {
  return {
    ballX: CENTER_X - 100,
    ballY: CENTER_Y - 50,
    velX: config.initialSpeed,
    velY: 0,
  };
}
