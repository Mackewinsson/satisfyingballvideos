# -*- coding: utf-8 -*-
import pygame
import math
import random
import colorsys
import sys
import os
import time
from PIL import Image

pygame.init()

WIDTH, HEIGHT = 800, 800
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Satisfying Physics Lab")

CENTER_X, CENTER_Y = WIDTH // 2, HEIGHT // 2
BORDER_RADIUS = 370
RING_RADIUS = 35
ERASER_RADIUS_START = 45
ERASER_RADIUS_END = 85

def hsv_to_rgb(h, s, v):
    rgb = colorsys.hsv_to_rgb(h % 1.0, min(s, 1.0), min(v, 1.0))
    return (int(rgb[0] * 255), int(rgb[1] * 255), int(rgb[2] * 255))


def generate_color_scheme():
    base_hue = random.random()
    ball_hue = (base_hue + 0.5) % 1.0
    return {
        "base_hue": base_hue,
        "ball": hsv_to_rgb(ball_hue, 0.85, 0.92),
        "ball_highlight": hsv_to_rgb(ball_hue, 0.40, 1.0),
        "border_glow": hsv_to_rgb(base_hue, 0.15, 0.82),
        "border_line": hsv_to_rgb(base_hue, 0.08, 0.88),
        "bg": hsv_to_rgb(base_hue, 0.50, 0.03),
    }


scheme = generate_color_scheme()

INITIAL_SPEED = 10.0
FINAL_SPEED = 35.0
GRAVITY = 0.15
FRICTION = 1.0
JITTER_START = 0.18
JITTER_END = 0.35
TARGET_TIME = 60.0
FPS = 60

clock = pygame.time.Clock()
font = pygame.font.SysFont("monospace", 16, bold=True)
title_font = pygame.font.SysFont("monospace", 14, bold=True)
bounce_font = pygame.font.SysFont("monospace", 18, bold=True)
timer_font = pygame.font.SysFont("monospace", 22, bold=True)

recording = False
frames = []
frame_counter = 0
FRAME_SKIP = 2
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "downloads")


def rgb_to_hex(rgb):
    return "%02x%02x%02x" % (rgb[0], rgb[1], rgb[2])


def gif_path_for_current_scheme():
    """Ball color hex + timestamp so each export has a unique name."""
    hex_part = rgb_to_hex(scheme["ball"])
    stamp = time.strftime("%Y%m%d_%H%M%S")
    return os.path.join(OUTPUT_DIR, f"bouncing_ring_{hex_part}_{stamp}.gif")


def save_gif():
    global recording, frames
    if not frames:
        print("No frames captured.")
        recording = False
        return
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = gif_path_for_current_scheme()
    print(f"Saving transparent GIF with {len(frames)} frames...")
    processed = []
    for frame in frames:
        alpha = frame.split()[3]
        p = frame.convert("P", palette=Image.ADAPTIVE, colors=255)
        mask = Image.eval(alpha, lambda a: 255 if a <= 128 else 0)
        p.paste(255, mask)
        processed.append(p)
    processed[0].save(
        out_path,
        save_all=True,
        append_images=processed[1:],
        loop=0,
        duration=int(1000 / (FPS // FRAME_SKIP)),
        optimize=False,
        transparency=255,
        disposal=2,
    )
    print(f"Transparent GIF saved to {out_path}")
    frames = []
    recording = False


def capture_frame_transparent():
    frame_surf = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    frame_surf.fill((0, 0, 0, 0))

    vis = gradient_surface.copy()
    vis.blit(erase_mask, (0, 0), special_flags=pygame.BLEND_RGBA_SUB)
    vis.blit(circle_clip, (0, 0), special_flags=pygame.BLEND_RGBA_MIN)
    frame_surf.blit(vis, (0, 0))

    for g in range(6, 0, -1):
        a = int(15 * g)
        pygame.draw.circle(
            frame_surf, (*scheme["border_glow"], a),
            (CENTER_X, CENTER_Y), BORDER_RADIUS + g, 2,
        )
    pygame.draw.circle(
        frame_surf, (*scheme["border_line"], 255),
        (CENTER_X, CENTER_Y), BORDER_RADIUS, 2,
    )

    glow_r = RING_RADIUS * 3
    glow_surf = pygame.Surface((glow_r * 2, glow_r * 2), pygame.SRCALPHA)
    for gr in range(glow_r, RING_RADIUS, -2):
        a = max(0, int(45 * (1 - (gr - RING_RADIUS) / (glow_r - RING_RADIUS))))
        pygame.draw.circle(glow_surf, (*scheme["ball"], a), (glow_r, glow_r), gr)
    frame_surf.blit(glow_surf, (int(ball_x) - glow_r, int(ball_y) - glow_r))

    pygame.draw.circle(frame_surf, scheme["ball"], (int(ball_x), int(ball_y)), RING_RADIUS)
    pygame.draw.circle(frame_surf, scheme["ball_highlight"], (int(ball_x), int(ball_y)), RING_RADIUS, 2)

    raw = pygame.image.tostring(frame_surf, "RGBA")
    img = Image.frombytes("RGBA", (WIDTH, HEIGHT), raw)
    frames.append(img)


def build_gradient_surface():
    surf = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    surf.fill((0, 0, 0, 0))
    base_hue = scheme["base_hue"]
    for r in range(BORDER_RADIUS, 0, -1):
        t = r / BORDER_RADIUS
        hue = (base_hue + 0.12 * (1 - t)) % 1.0
        sat = 0.75 + 0.15 * t
        val = 0.35 + 0.55 * (1 - t) ** 1.5
        color = (*hsv_to_rgb(hue, sat, val), 255)
        pygame.draw.circle(surf, color, (CENTER_X, CENTER_Y), r)
    return surf


gradient_surface = build_gradient_surface()

erase_mask = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
erase_mask.fill((0, 0, 0, 0))

circle_clip = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
circle_clip.fill((0, 0, 0, 0))
pygame.draw.circle(circle_clip, (255, 255, 255, 255), (CENTER_X, CENTER_Y), BORDER_RADIUS)


def reset_state():
    global ball_x, ball_y, vel_x, vel_y, speed, bounce_count, erase_mask, elapsed
    spawn_angle = random.uniform(0, 2 * math.pi)
    spawn_dist = random.uniform(0, BORDER_RADIUS - RING_RADIUS - 10)
    ball_x = CENTER_X + math.cos(spawn_angle) * spawn_dist
    ball_y = CENTER_Y + math.sin(spawn_angle) * spawn_dist
    speed = INITIAL_SPEED
    angle = random.uniform(0, 2 * math.pi)
    vel_x = speed * math.cos(angle)
    vel_y = speed * math.sin(angle)
    bounce_count = 0
    elapsed = 0.0
    erase_mask = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    erase_mask.fill((0, 0, 0, 0))


reset_state()


def get_time_curves(t):
    t = min(t, 1.0)
    ease = t ** 1.5
    target_speed = INITIAL_SPEED + (FINAL_SPEED - INITIAL_SPEED) * ease
    eraser_t = max(0.0, (t - 0.8) / 0.2) if t > 0.8 else 0.0
    eraser_r = ERASER_RADIUS_START + (ERASER_RADIUS_END - ERASER_RADIUS_START) * eraser_t
    jitter = JITTER_START + (JITTER_END - JITTER_START) * t
    return target_speed, int(eraser_r), jitter


def reflect_velocity(bx, by, vx, vy, jitter_amount):
    dx = bx - CENTER_X
    dy = by - CENTER_Y
    dist = math.sqrt(dx * dx + dy * dy)
    if dist == 0:
        return vx, vy
    nx = dx / dist
    ny = dy / dist
    dot = vx * nx + vy * ny
    rx, ry = vx - 2 * dot * nx, vy - 2 * dot * ny

    jitter = random.uniform(-jitter_amount, jitter_amount)
    cos_j, sin_j = math.cos(jitter), math.sin(jitter)
    return rx * cos_j - ry * sin_j, rx * sin_j + ry * cos_j


def estimate_clear_percentage():
    scale = 6
    sw, sh = WIDTH // scale, HEIGHT // scale
    scaled_mask = pygame.transform.smoothscale(erase_mask, (sw, sh))
    cx, cy = CENTER_X // scale, CENTER_Y // scale
    br = BORDER_RADIUS // scale
    count = 0
    cleared = 0
    for x in range(max(0, cx - br), min(sw, cx + br)):
        for y in range(max(0, cy - br), min(sh, cy + br)):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= br * br:
                count += 1
                if scaled_mask.get_at((x, y))[3] > 60:
                    cleared += 1
    if count == 0:
        return 0.0
    return cleared / count


clear_pct = 0.0
clear_timer = 0
running = True

while running:
    dt = clock.tick(FPS)
    elapsed += dt / 1000.0
    progress = min(elapsed / TARGET_TIME, 1.0)
    target_speed, current_eraser_r, current_jitter = get_time_curves(progress)

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN:
            if event.key in (pygame.K_ESCAPE, pygame.K_q):
                running = False
            if event.key == pygame.K_r:
                scheme = generate_color_scheme()
                gradient_surface = build_gradient_surface()
                reset_state()
                clear_pct = 0.0
            if event.key == pygame.K_g:
                if not recording:
                    scheme = generate_color_scheme()
                    gradient_surface = build_gradient_surface()
                    reset_state()
                    clear_pct = 0.0
                    recording = True
                    frames = []
                    frame_counter = 0
                    print("Recording full 60s... will auto-save when done.")
                else:
                    save_gif()

    vel_y += GRAVITY
    vel_x *= FRICTION
    vel_y *= FRICTION

    speed = math.sqrt(vel_x ** 2 + vel_y ** 2)
    if speed > 0.1:
        scale_f = target_speed / speed
        vel_x *= scale_f
        vel_y *= scale_f
    speed = target_speed

    nudge = random.uniform(-0.005, 0.005)
    vel_x += nudge * speed
    vel_y += nudge * speed

    steps = max(1, int(speed / 3))
    sub_vx = vel_x / steps
    sub_vy = vel_y / steps

    for _ in range(steps):
        ball_x += sub_vx
        ball_y += sub_vy

        pygame.draw.circle(
            erase_mask, (0, 0, 0, 255), (int(ball_x), int(ball_y)), current_eraser_r
        )

        dx = ball_x - CENTER_X
        dy = ball_y - CENTER_Y
        dist = math.sqrt(dx * dx + dy * dy)

        if dist + RING_RADIUS >= BORDER_RADIUS:
            if dist > 0:
                overlap = (dist + RING_RADIUS) - BORDER_RADIUS
                ball_x -= (dx / dist) * overlap
                ball_y -= (dy / dist) * overlap

            full_vx = sub_vx * steps
            full_vy = sub_vy * steps
            full_vx, full_vy = reflect_velocity(
                ball_x, ball_y, full_vx, full_vy, current_jitter
            )

            ref_speed = math.sqrt(full_vx ** 2 + full_vy ** 2)
            if ref_speed > 0.1:
                norm = target_speed / ref_speed
                full_vx *= norm
                full_vy *= norm

            vel_x = full_vx
            vel_y = full_vy
            sub_vx = vel_x / steps
            sub_vy = vel_y / steps
            bounce_count += 1

    clear_timer += dt
    if clear_timer > 1500:
        clear_pct = estimate_clear_percentage()
        clear_timer = 0

    if recording and elapsed >= TARGET_TIME:
        save_gif()

    screen.fill(scheme["bg"])

    visible_gradient = gradient_surface.copy()
    visible_gradient.blit(erase_mask, (0, 0), special_flags=pygame.BLEND_RGBA_SUB)
    visible_gradient.blit(circle_clip, (0, 0), special_flags=pygame.BLEND_RGBA_MIN)
    screen.blit(visible_gradient, (0, 0))

    border_glow = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    for g in range(6, 0, -1):
        a = int(15 * g)
        pygame.draw.circle(
            border_glow,
            (*scheme["border_glow"], a),
            (CENTER_X, CENTER_Y),
            BORDER_RADIUS + g,
            2,
        )
    screen.blit(border_glow, (0, 0))
    pygame.draw.circle(screen, scheme["border_line"], (CENTER_X, CENTER_Y), BORDER_RADIUS, 2)

    glow_r = RING_RADIUS * 3
    glow_surf = pygame.Surface((glow_r * 2, glow_r * 2), pygame.SRCALPHA)
    for gr in range(glow_r, RING_RADIUS, -2):
        a = max(0, int(45 * (1 - (gr - RING_RADIUS) / (glow_r - RING_RADIUS))))
        pygame.draw.circle(glow_surf, (*scheme["ball"], a), (glow_r, glow_r), gr)
    screen.blit(glow_surf, (int(ball_x) - glow_r, int(ball_y) - glow_r))

    pygame.draw.circle(screen, scheme["ball"], (int(ball_x), int(ball_y)), RING_RADIUS)
    pygame.draw.circle(screen, scheme["ball_highlight"], (int(ball_x), int(ball_y)), RING_RADIUS, 2)

    remaining = max(0.0, TARGET_TIME - elapsed)
    mins = int(remaining) // 60
    secs = int(remaining) % 60
    timer_color = (230, 60, 60) if remaining < 10 else (200, 200, 210)
    timer_text = timer_font.render(f"{mins}:{secs:02d}", True, timer_color)
    screen.blit(timer_text, (15, 10))

    title_surf = title_font.render("SATISFYING PHYSICS LAB", True, (140, 140, 160))
    screen.blit(title_surf, (15, 38))

    right_x = WIDTH - 230
    info_y = 12
    stats = [
        f"Ring radius: {RING_RADIUS} px",
        f"Border radius: {BORDER_RADIUS} px",
        f"Ring speed: {speed:.0f} px/frame",
    ]
    for i, label in enumerate(stats):
        s = font.render(label, True, (200, 200, 210))
        screen.blit(s, (right_x, info_y + i * 20))

    bounce_text = bounce_font.render(f"BOUNCES: {bounce_count}", True, (80, 160, 255))
    screen.blit(bounce_text, (15, HEIGHT - 55))
    clear_text = font.render(f"CLEARED: {clear_pct * 100:.1f}%", True, (100, 180, 255))
    screen.blit(clear_text, (15, HEIGHT - 30))

    if recording:
        pygame.draw.circle(screen, (230, 40, 40), (WIDTH - 20, 15), 8)
        rec_text = font.render("REC", True, (230, 40, 40))
        screen.blit(rec_text, (WIDTH - 65, 7))

    ctrl = font.render("[R] Reset  [G] Record GIF  [Q] Quit", True, (60, 60, 80))
    screen.blit(ctrl, (WIDTH - 380, HEIGHT - 30))

    pygame.display.flip()

    if recording:
        frame_counter += 1
        if frame_counter % FRAME_SKIP == 0:
            capture_frame_transparent()

pygame.quit()
sys.exit()
