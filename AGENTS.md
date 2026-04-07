# AGENTS.md

This file orients AI coding agents working in this workspace (`/Users/PaleMac`).

## `bouncing_ring.py` ù Satisfying Physics Lab

Single-file **Pygame** demo: a colored ring moves inside a circular border, gradually speeds up, ùerasesù a radial gradient with a growing brush, and bounces with increasing jitter. Window title: **Satisfying Physics Lab**.

### Dependencies

- **pygame**
- **Pillow** (`PIL`) ù GIF export

Install if needed: `pip install pygame pillow`

### Run

From the directory that contains the script:

```bash
python3 bouncing_ring.py
```

### Controls

| Key | Action |
|-----|--------|
| **R** | New random color scheme, rebuild gradient, reset ball and erase mask |
| **G** | Start a **full 60s** recording (new scheme + reset). Press **G** again to **save early**; otherwise GIF saves automatically when `TARGET_TIME` elapses |
| **Q** / **Esc** | Quit |

### Output

- Transparent GIF path: **`downloads/bouncing_ring_<ball_hex>_<timestamp>.gif`** next to the script (`OUTPUT_DIR`; `downloads/` is created on save if missing). Ball RGB comes from `scheme["ball"]`.
- Recording uses `FRAME_SKIP` (every Nth frame) and `FPS` for frame duration in the GIF.

### Architecture (how to edit safely)

- **Constants** at module top: geometry (`WIDTH`, `HEIGHT`, `BORDER_RADIUS`, `RING_RADIUS`, eraser radii), physics (`INITIAL_SPEED`, `FINAL_SPEED`, `GRAVITY`, `FRICTION`, jitter range), timing (`TARGET_TIME`, `FPS`).
- **Color scheme**: `generate_color_scheme()` + `hsv_to_rgb()`; `scheme` dict drives background, ball, border, and gradient hues.
- **Surfaces**: `gradient_surface` (precomputed radial gradient), `erase_mask` (RGBA subtract from gradient), `circle_clip` (clamp to inner disk). Rebuilt on **R** / **G** start for gradient and mask via `build_gradient_surface()` and `reset_state()`.
- **Main loop**: single `while running:` at bottom ù updates physics, sub-stepping for collision, draws HUD (timer, bounces, clear %), optional `capture_frame_transparent()` when `recording`.
- **Time-based difficulty**: `get_time_curves(progress)` maps normalized elapsed time to target speed, eraser radius, and bounce jitter.
- **Clear metric**: `estimate_clear_percentage()` downscales `erase_mask` for a cheap approximate ù% clearedù inside the border.

When changing behavior, keep **GIF capture** (`capture_frame_transparent`) visually consistent with the on-screen draw path (same layering: gradient minus erase, clip, border glow, ball).

---

## Workspace model

This directory is a **home-folder workspace**, not one application repository. Treat each codebase under `projects/` as its **own project** with its own git history, dependencies, and conventions. Prefer changing files only inside the project the user is working on unless they ask otherwise.

Do **not** search or edit Cursor-managed worktrees under `~/.cursor/worktrees` unless the user explicitly asks.

## Projects under `projects/`

| Path | Package / focus | Notes |
|------|-----------------|--------|
| `projects/agent-insight-hub` | Agent Insight Hub | React + AWS serverless monorepo. See **`projects/agent-insight-hub/AGENTS.md`** for stack, layout, and commands. |
| `projects/customer-gdpr-deletion` | GDPR deletion (related backend) | Companion/isolated service; read that repo's `README` and local docs when touching it. |
| `projects/data-distribution-order-api` | `data-distribution-order-api` | Turbo/npm workspaces, CDK + Lambdas (order distribution API). |
| `projects/dip-order-database-service` | `dip-order-database-service` | Turbo/npm workspaces, CDK + data/ETL style Lambdas. |
| `projects/oca-monitor-account-creation` | `monitor-account-creation` | Turbo workspaces, AWS-style layout similar to sibling OCA repos. |
| `projects/wallet-hub` | `wallet-hub` | Turbo/npm workspaces, CDK + application packages. |

When starting work, **open or `cd` into the target project** and follow that project's `README`, `AGENTS.md`, and `.cursor/rules/` if present.

## Default agent behavior

- **Run commands** from the relevant project root (e.g. `projects/agent-insight-hub`), not from the home directory, unless the task is explicitly workspace-wide. For **`bouncing_ring.py`**, run from `/Users/PaleMac` (or wherever the file lives).
- **Respect existing tooling**: most `projects/*` repos use **npm** workspaces, **Turbo**, **Prettier**, and **ESLint**; use each repo's `package.json` scripts.
- **Keep changes scoped** to the requested feature or fix; avoid drive-by refactors across unrelated projects.
- **Secrets**: never commit credentials; use existing env patterns (`.env`, CDK context, CI secrets) documented per repo.

## Cursor-specific

- Project-specific rules may live in `projects/<name>/.cursor/rules/` as `.mdc` files; they apply when matching files are open or when `alwaysApply` is set.
- If the user's question clearly targets one repo or `bouncing_ring.py`, prefer that artifact's local context over the generic workspace sections below the fold.
