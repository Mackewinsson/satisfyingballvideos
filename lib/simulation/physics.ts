import { CENTER_X, CENTER_Y } from "./constants";
import type { StudioConfig } from "./types";

export function targetDurationMs(config: StudioConfig): number {
  return config.targetTime * 1000;
}

/** Min inward normal speed (px/frame) to count as a real wall bounce. */
export const MIN_BOUNCE_IMPACT_SPEED = 1.5;

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
  /** Speed into the wall along the surface normal (px/frame). */
  impactSpeed: number;
} {
  const dx = ballX - CENTER_X;
  const dy = ballY - CENTER_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = containerRadius - ballRadius;

  if (dist <= maxDist || dist === 0) {
    return { ballX, ballY, velX, velY, collided: false, impactSpeed: 0 };
  }

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = dist - maxDist;
  const correctedX = ballX - nx * overlap;
  const correctedY = ballY - ny * overlap;

  const dot = velX * nx + velY * ny;
  const impactSpeed = Math.abs(dot);
  const newVx = (velX - 2 * dot * nx) * restitution;
  const newVy = (velY - 2 * dot * ny) * restitution;

  return {
    ballX: correctedX,
    ballY: correctedY,
    velX: newVx,
    velY: newVy,
    collided: true,
    impactSpeed,
  };
}

export function isSignificantBounce(impactSpeed: number): boolean {
  return impactSpeed >= MIN_BOUNCE_IMPACT_SPEED;
}

/**
 * Random spawn in the upper part of the arena (wide horizontal spread).
 * Polar sampling around the top (-π/2) keeps cos(angle) ≈ 0, so the ball
 * always looked centered; this samples (x, y) in an upper band instead.
 */
export function createDropInitialState(config: StudioConfig): {
  ballX: number;
  ballY: number;
  velX: number;
  velY: number;
} {
  const maxDist = config.borderRadius - config.ringRadius;
  // dy < 0 = above center (screen y grows downward)
  const minDy = -maxDist * 0.92;
  const maxDy = -maxDist * 0.42;
  const dy = minDy + Math.random() * (maxDy - minDy);
  const ballY = CENTER_Y + dy;
  const maxDx = Math.sqrt(Math.max(0, maxDist * maxDist - dy * dy));
  const ballX =
    CENTER_X + (Math.random() * 2 - 1) * maxDx * (0.82 + Math.random() * 0.18);

  const speed = config.initialSpeed;
  const velX =
    (Math.random() < 0.5 ? -1 : 1) * speed * (0.65 + Math.random() * 0.35);
  const velY = Math.random() * 1.5;

  return { ballX, ballY, velX, velY };
}
