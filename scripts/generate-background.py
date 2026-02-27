#!/usr/bin/env python3
"""
Generate background.svg with strand-based glow animation.

Individual strands (lines of boxes) light up traveling inward toward the
brain icon at the center (200, 100). Other boxes glow only very subtly.

Usage:
    python3 scripts/generate-background.py
"""

import math
import os
import random

# --- Configuration ---
VIEWBOX_W = 400
VIEWBOX_H = 200
CENTER_X = 200
CENTER_Y = 100

BOX_SIZE = 8
GAP = 2
CELL_SIZE = BOX_SIZE + GAP  # 10

EXCLUDE_RADIUS = 35   # no boxes inside this radius from center
DIM_RADIUS = 50       # strand boxes between 35-50px glow dimmer

STRAND_PROXIMITY = 6  # max distance (px) from a strand line to be a strand box

# Colors (TRON palette)
COLORS = [
    ("#00ffff", 0.60),  # Cyan 60%
    ("#ff4088", 0.25),  # Pink 25%
    ("#ffdd00", 0.15),  # Gold 15%
]

# Strand definitions: (start_point, end_point) — all end at the brain center
STRANDS = [
    ((0, 0), (CENTER_X, CENTER_Y)),
    ((VIEWBOX_W, 0), (CENTER_X, CENTER_Y)),
    ((0, VIEWBOX_H), (CENTER_X, CENTER_Y)),
    ((VIEWBOX_W, VIEWBOX_H), (CENTER_X, CENTER_Y)),
    ((0, CENTER_Y), (CENTER_X, CENTER_Y)),
    ((VIEWBOX_W, CENTER_Y), (CENTER_X, CENTER_Y)),
    ((CENTER_X, 0), (CENTER_X, CENTER_Y)),
    ((120, 0), (CENTER_X, CENTER_Y)),
    ((280, 0), (CENTER_X, CENTER_Y)),
    ((0, 50), (CENTER_X, CENTER_Y)),
    ((VIEWBOX_W, 50), (CENTER_X, CENTER_Y)),
    ((0, 150), (CENTER_X, CENTER_Y)),
    ((VIEWBOX_W, 150), (CENTER_X, CENTER_Y)),
]

# Per-strand configuration: (travel_time, cycle_length, phase_offset)
# - travel_time: seconds for pulse to travel edge→brain (different speeds)
# - cycle_length: total animation cycle in seconds (prevents sync)
# - phase_offset: negative delay offset so animation starts "mid-cycle" (no flash)
STRAND_CONFIGS = [
    (12.0, 22, 11.2),   # strand 0: oben-links
    (14.0, 26, 13.9),   # strand 1: oben-rechts
    (13.0, 24, 13.4),   # strand 2: unten-links
    (15.0, 28, 16.2),   # strand 3: unten-rechts
    (11.0, 20, 12.1),   # strand 4: mitte-links
    (12.0, 22, 13.8),   # strand 5: mitte-rechts
    (10.0, 18, 11.4),   # strand 6: oben-mitte
    (16.0, 30, 20.2),   # strand 7: oben-links-mitte
    (11.0, 20, 13.9),   # strand 8: oben-rechts-mitte
    (13.0, 24, 17.3),   # strand 9: links-oben
    (10.0, 18, 13.4),   # strand 10: rechts-oben
    (14.0, 26, 19.9),   # strand 11: links-unten
    (12.0, 22, 17.4),   # strand 12: rechts-unten
]

# Seed for reproducible "organic" variation
random.seed(42)

# --- Brain SVG template (preserved from original) ---
BRAIN_SVG = """\
  <!-- Brain structure (Tron-style with glow and colors) -->
  <defs>
    <!-- Glow filters -->
    <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="glow-pink" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Brain gradients -->
    <linearGradient id="brain-gradient-lr" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00ffff"/>
      <stop offset="50%" stop-color="#ff4088"/>
      <stop offset="100%" stop-color="#00ffff"/>
    </linearGradient>
    <linearGradient id="brain-gradient-tb" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4488ff"/>
      <stop offset="50%" stop-color="#ff4088"/>
      <stop offset="100%" stop-color="#4488ff"/>
    </linearGradient>
  </defs>

  <g transform="translate(200, 100)">
    <!-- Brain outer glow background -->
    <ellipse cx="0" cy="0" rx="30" ry="28" fill="none" stroke="#00ffff" stroke-width="1" opacity="0.15" filter="url(#glow-strong)"/>

    <!-- Brain outline - left hemisphere (cyan glow) -->
    <polyline points="-3,28 -8,26 -14,23 -20,18 -25,12 -28,5 -28,-3 -27,-10 -24,-16 -20,-21 -14,-25 -8,-27 0,-28"
      fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow-cyan)" opacity="0.9"/>

    <!-- Brain outline - right hemisphere (cyan glow) -->
    <polyline points="3,28 8,26 14,23 20,18 25,12 28,5 28,-3 27,-10 24,-16 20,-21 14,-25 8,-27 0,-28"
      fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow-cyan)" opacity="0.9"/>

    <!-- Brain bottom connection -->
    <polyline points="-3,28 0,30 3,28" fill="none" stroke="#00ffff" stroke-width="2" filter="url(#glow-cyan)" opacity="0.9"/>

    <!-- Corpus callosum (center connection) - pink -->
    <polyline points="0,-28 -2,-22 2,-16 -2,-10 2,-4 -2,2 2,8 -2,14 2,20 0,28"
      fill="none" stroke="#ff4088" stroke-width="2" filter="url(#glow-pink)" opacity="0.8"/>

    <!-- Left hemisphere gyri (brain folds) - detailed -->
    <!-- Frontal lobe folds -->
    <polyline points="-26,-8 -20,-10 -16,-6 -20,-2"
      fill="none" stroke="#4488ff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.7"/>
    <polyline points="-24,-14 -18,-16 -14,-12 -18,-8"
      fill="none" stroke="#4488ff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.7"/>
    <polyline points="-20,-20 -14,-22 -10,-18 -14,-14"
      fill="none" stroke="#4488ff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.6"/>

    <!-- Parietal lobe folds -->
    <polyline points="-26,2 -20,0 -16,4 -20,8"
      fill="none" stroke="#00ffff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.7"/>
    <polyline points="-24,10 -18,8 -14,12 -18,16"
      fill="none" stroke="#00ffff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.7"/>

    <!-- Temporal lobe folds -->
    <polyline points="-22,18 -16,16 -12,20 -16,24"
      fill="none" stroke="#ff4088" stroke-width="1.5" filter="url(#glow-pink)" opacity="0.6"/>
    <polyline points="-10,22 -6,18 -4,22 -8,26"
      fill="none" stroke="#ff4088" stroke-width="1.5" filter="url(#glow-pink)" opacity="0.5"/>

    <!-- Right hemisphere gyri (mirrored) -->
    <!-- Frontal lobe folds -->
    <polyline points="26,-8 20,-10 16,-6 20,-2"
      fill="none" stroke="#4488ff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.7"/>
    <polyline points="24,-14 18,-16 14,-12 18,-8"
      fill="none" stroke="#4488ff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.7"/>
    <polyline points="20,-20 14,-22 10,-18 14,-14"
      fill="none" stroke="#4488ff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.6"/>

    <!-- Parietal lobe folds -->
    <polyline points="26,2 20,0 16,4 20,8"
      fill="none" stroke="#00ffff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.7"/>
    <polyline points="24,10 18,8 14,12 18,16"
      fill="none" stroke="#00ffff" stroke-width="1.5" filter="url(#glow-cyan)" opacity="0.7"/>

    <!-- Temporal lobe folds -->
    <polyline points="22,18 16,16 12,20 16,24"
      fill="none" stroke="#ff4088" stroke-width="1.5" filter="url(#glow-pink)" opacity="0.6"/>
    <polyline points="10,22 6,18 4,22 8,26"
      fill="none" stroke="#ff4088" stroke-width="1.5" filter="url(#glow-pink)" opacity="0.5"/>

    <!-- Inner brain structures (thalamus/brainstem hint) -->
    <polyline points="-8,5 -4,8 0,5 4,8 8,5"
      fill="none" stroke="#ff4088" stroke-width="1" filter="url(#glow-pink)" opacity="0.5"/>
    <polyline points="-6,-5 -2,-2 2,-5 6,-2"
      fill="none" stroke="#4488ff" stroke-width="1" filter="url(#glow-cyan)" opacity="0.5"/>

    <!-- Neural activity pulses (static dots for better performance) -->
    <circle cx="-15" cy="-10" r="2" fill="#00ffff" filter="url(#glow-cyan)" opacity="0.7"/>
    <circle cx="15" cy="-10" r="2" fill="#00ffff" filter="url(#glow-cyan)" opacity="0.7"/>
    <circle cx="-12" cy="8" r="2" fill="#ff4088" filter="url(#glow-pink)" opacity="0.7"/>
    <circle cx="12" cy="8" r="2" fill="#ff4088" filter="url(#glow-pink)" opacity="0.7"/>
    <circle cx="0" cy="-18" r="2" fill="#4488ff" filter="url(#glow-cyan)" opacity="0.7"/>
    <circle cx="0" cy="15" r="2" fill="#ff4088" filter="url(#glow-pink)" opacity="0.7"/>

    <!-- Synaptic connections (static lines for better performance) -->
    <line x1="-15" y1="-10" x2="-8" y2="-5" stroke="#00ffff" stroke-width="0.5" opacity="0.5"/>
    <line x1="15" y1="-10" x2="8" y2="-5" stroke="#00ffff" stroke-width="0.5" opacity="0.5"/>
    <line x1="-12" y1="8" x2="-4" y2="5" stroke="#ff4088" stroke-width="0.5" opacity="0.5"/>
    <line x1="12" y1="8" x2="4" y2="5" stroke="#ff4088" stroke-width="0.5" opacity="0.5"/>
  </g>"""


def pick_color():
    """Pick a random color based on the configured weights."""
    r = random.random()
    cumulative = 0
    for color, weight in COLORS:
        cumulative += weight
        if r <= cumulative:
            return color
    return COLORS[0][0]


def distance_to_segment(px, py, ax, ay, bx, by):
    """Return the shortest distance from point (px, py) to line segment (a→b)."""
    dx = bx - ax
    dy = by - ay
    len_sq = dx * dx + dy * dy
    if len_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / len_sq))
    proj_x = ax + t * dx
    proj_y = ay + t * dy
    return math.hypot(px - proj_x, py - proj_y)


def project_on_segment(px, py, ax, ay, bx, by):
    """Return t in [0, 1] — the projection of point (px, py) onto segment (a→b).

    t=0 means closest to a (edge), t=1 means closest to b (brain).
    """
    dx = bx - ax
    dy = by - ay
    len_sq = dx * dx + dy * dy
    if len_sq == 0:
        return 0.0
    return max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / len_sq))


def find_closest_strand(bx, by):
    """Find the closest strand to point (bx, by).

    Returns (strand_index, distance, t_value) or None if no strand is close enough.
    """
    best = None
    for i, ((ax, ay), (ex, ey)) in enumerate(STRANDS):
        dist = distance_to_segment(bx, by, ax, ay, ex, ey)
        if dist <= STRAND_PROXIMITY:
            if best is None or dist < best[1]:
                t = project_on_segment(bx, by, ax, ay, ex, ey)
                best = (i, dist, t)
    return best


def generate_boxes():
    """Generate all box data, classifying each as strand or ambient."""
    cols = VIEWBOX_W // CELL_SIZE
    rows = VIEWBOX_H // CELL_SIZE

    # Calculate the offset to center the grid
    grid_w = cols * CELL_SIZE
    grid_h = rows * CELL_SIZE
    offset_x = (VIEWBOX_W - grid_w + GAP) / 2
    offset_y = (VIEWBOX_H - grid_h + GAP) / 2

    boxes = []
    for row in range(rows):
        for col in range(cols):
            x = offset_x + col * CELL_SIZE
            y = offset_y + row * CELL_SIZE
            # Center of the box
            bx = x + BOX_SIZE / 2
            by = y + BOX_SIZE / 2
            dist_to_center = math.hypot(bx - CENTER_X, by - CENTER_Y)

            if dist_to_center < EXCLUDE_RADIUS:
                continue

            color = pick_color()
            strand_info = find_closest_strand(bx, by)

            if strand_info is not None:
                strand_idx, _dist, t = strand_info
                is_dim = dist_to_center < DIM_RADIUS
                travel_time, cycle_length, phase_offset = STRAND_CONFIGS[strand_idx]
                # Negative delay: animation starts as if already running
                # t=0 (edge) fires first, t=1 (brain) fires last
                delay = round(-(phase_offset - t * travel_time), 2)
                boxes.append({
                    "x": round(x, 2),
                    "y": round(y, 2),
                    "type": "strand",
                    "is_dim": is_dim,
                    "color": color,
                    "delay": delay,
                    "cycle": cycle_length,
                })
            else:
                # Ambient box — very subtle, negative delay (no initial flash)
                delay = round(-random.uniform(0, 30), 2)
                duration = round(random.uniform(18, 30), 2)
                boxes.append({
                    "x": round(x, 2),
                    "y": round(y, 2),
                    "type": "ambient",
                    "is_dim": False,
                    "color": color,
                    "delay": delay,
                    "duration": duration,
                })

    return boxes


def bucket_value(val, step):
    """Round val to the nearest step for CSS class bucketing."""
    return round(round(val / step) * step, 2)


def delay_class_name(delay, prefix):
    """Generate a CSS class name for a (possibly negative) delay value.

    Negative delays use 'n' prefix: sn45 = -4.5s, an35 = -3.5s
    Positive delays use bare prefix: s45 = 4.5s
    """
    if delay < 0:
        val_str = str(abs(delay)).replace(".", "")
        return f"{prefix}n{val_str}"
    else:
        val_str = str(delay).replace(".", "")
        return f"{prefix}{val_str}"


def generate_svg():
    """Generate the complete background SVG."""
    boxes = generate_boxes()

    # Bucket delays/durations for smaller CSS
    STRAND_DELAY_STEP = 0.3
    AMBIENT_DELAY_STEP = 0.5
    AMBIENT_DUR_STEP = 1.0

    strand_delays = set()
    strand_cycles = set()
    ambient_durations = set()
    ambient_delays = set()

    for box in boxes:
        if box["type"] == "strand":
            box["delay_bucket"] = bucket_value(box["delay"], STRAND_DELAY_STEP)
            strand_delays.add(box["delay_bucket"])
            strand_cycles.add(box["cycle"])
        else:
            box["delay_bucket"] = bucket_value(box["delay"], AMBIENT_DELAY_STEP)
            box["dur_bucket"] = bucket_value(box["duration"], AMBIENT_DUR_STEP)
            ambient_delays.add(box["delay_bucket"])
            ambient_durations.add(box["dur_bucket"])

    # Build CSS
    css_lines = []
    css_lines.append("    <style>")

    # Keyframes — wider pulse: glow for 25% of cycle (strand) / 20% (ambient)
    css_lines.append("      @keyframes sg {")
    css_lines.append("        0%   { opacity: 0.03; }")
    css_lines.append("        12%  { opacity: 0.30; }")
    css_lines.append("        25%  { opacity: 0.03; }")
    css_lines.append("        100% { opacity: 0.03; }")
    css_lines.append("      }")
    css_lines.append("      @keyframes sgd {")
    css_lines.append("        0%   { opacity: 0.02; }")
    css_lines.append("        12%  { opacity: 0.12; }")
    css_lines.append("        25%  { opacity: 0.02; }")
    css_lines.append("        100% { opacity: 0.02; }")
    css_lines.append("      }")
    css_lines.append("      @keyframes ag {")
    css_lines.append("        0%   { opacity: 0.02; }")
    css_lines.append("        10%  { opacity: 0.08; }")
    css_lines.append("        20%  { opacity: 0.02; }")
    css_lines.append("        100% { opacity: 0.02; }")
    css_lines.append("      }")

    # Strand base classes (animation-name + timing, duration set per-strand via cycle class)
    css_lines.append("      .bs { animation-name: sg; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }")
    css_lines.append("      .bsd { animation-name: sgd; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }")
    css_lines.append("      .ba { animation-name: ag; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }")

    # Strand cycle duration classes (per-strand, e.g. c7 = 7s, c13 = 13s)
    for c in sorted(strand_cycles):
        css_lines.append(f"      .c{c} {{ animation-duration: {c}s; }}")

    # Strand delay classes (negative values)
    for d in sorted(strand_delays):
        cls = delay_class_name(d, "s")
        css_lines.append(f"      .{cls} {{ animation-delay: {d}s; }}")

    # Ambient duration classes
    for d in sorted(ambient_durations):
        cls = f"ad{str(d).replace('.', '')}"
        css_lines.append(f"      .{cls} {{ animation-duration: {d}s; }}")

    # Ambient delay classes (negative values)
    for d in sorted(ambient_delays):
        cls = delay_class_name(d, "a")
        css_lines.append(f"      .{cls} {{ animation-delay: {d}s; }}")

    # Accessibility
    css_lines.append("      @media (prefers-reduced-motion: reduce) {")
    css_lines.append("        .bs, .bsd, .ba { animation: none; opacity: 0.04; }")
    css_lines.append("      }")
    css_lines.append("    </style>")

    # Build SVG
    parts = []
    parts.append('<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">')
    parts.append("\n".join(css_lines))
    parts.append('  <rect width="400" height="200" fill="#121212"/>')

    # Box grid
    parts.append("  <!-- Glowing box grid -->")
    parts.append("  <g>")

    strand_count = 0
    ambient_count = 0

    for box in boxes:
        if box["type"] == "strand":
            cls = "bsd" if box["is_dim"] else "bs"
            cycle_cls = f"c{box['cycle']}"
            delay_cls = delay_class_name(box["delay_bucket"], "s")
            parts.append(
                f'    <rect x="{box["x"]}" y="{box["y"]}" '
                f'width="{BOX_SIZE}" height="{BOX_SIZE}" rx="1" '
                f'fill="{box["color"]}" class="{cls} {cycle_cls} {delay_cls}"/>'
            )
            strand_count += 1
        else:
            dur_cls = f"ad{str(box['dur_bucket']).replace('.', '')}"
            delay_cls = delay_class_name(box["delay_bucket"], "a")
            parts.append(
                f'    <rect x="{box["x"]}" y="{box["y"]}" '
                f'width="{BOX_SIZE}" height="{BOX_SIZE}" rx="1" '
                f'fill="{box["color"]}" class="ba {dur_cls} {delay_cls}"/>'
            )
            ambient_count += 1

    parts.append("  </g>")

    # Brain
    parts.append("")
    parts.append(BRAIN_SVG)

    parts.append("</svg>")
    return "\n".join(parts), strand_count, ambient_count


if __name__ == "__main__":
    svg_content, strand_count, ambient_count = generate_svg()
    # Write relative to script location (project root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_path = os.path.join(project_root, "static", "images", "background.svg")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_content)

    box_count = strand_count + ambient_count
    print(f"Generated {output_path}")
    print(f"  Strand boxes: {strand_count}")
    print(f"  Ambient boxes: {ambient_count}")
    print(f"  Total boxes: {box_count}")
    print(f"  File size: {len(svg_content):,} bytes")
