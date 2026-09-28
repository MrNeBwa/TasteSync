"""Deterministic cover artwork for places.

OpenStreetMap carries an ``image`` tag on almost nothing: across the venues
seeded for this project, 0 of 48 had one. Fetching photos from Wikimedia
Commons by name would fix that, but a name match on an arbitrary OSM tag
routinely resolves to a same-named venue in a different city, and a wrong photo
of the wrong restaurant is worse than no photo. Each lookup also adds a few
hundred milliseconds to a feed that returns eight places at once.

So every place gets generated artwork instead: a duotone geometric composition
derived from the place's own identity. It always renders, costs no network
round trip, never shows the wrong building, and is distinct per place so a
batch of eight does not look repetitive. When OpenStreetMap *does* supply an
``image`` tag that photo still wins, because real beats synthetic.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from xml.sax.saxutils import escape as _escape

# Duotone pairs. They stay inside the app's existing palette so a generated
# cover reads as part of the product rather than a missing-image placeholder.
_PALETTES: tuple[tuple[str, str], ...] = (
    ("#efbd42", "#f06aa7"),
    ("#f06aa7", "#8fce6b"),
    ("#8fce6b", "#efbd42"),
    ("#efbd42", "#e5679f"),
    ("#2f6f6a", "#efbd42"),
    ("#7a4bd0", "#f06aa7"),
    ("#1d1d1b", "#efbd42"),
    ("#d1453f", "#efbd42"),
)

_WIDTH = 800
_HEIGHT = 450


@dataclass(frozen=True)
class _Seed:
    """A stable, well-distributed set of numbers for one place."""

    value: int

    @classmethod
    def for_place(cls, place_id: str, name: str) -> _Seed:
        # hash() is salted per process, so it would reshuffle the artwork on
        # every restart. A digest keeps a place's cover stable forever.
        digest = hashlib.sha256(f"{place_id}:{name}".encode()).digest()
        return cls(int.from_bytes(digest[:8], "big"))

    def pick(self, options):
        return options[self.value % len(options)]

    def between(self, low: float, high: float, *, salt: int = 0) -> float:
        span = high - low
        return low + ((self.value >> (salt * 8)) % 1000) / 1000 * span

    @property
    def angle(self) -> float:
        return (self.value >> 40) % 360


def _arcs(seed: _Seed, a: str, b: str) -> str:
    cx = seed.between(120, 680, salt=1)
    cy = seed.between(60, 300, salt=2)
    parts = []
    for i in range(7):
        r = 40 + i * seed.between(26, 40, salt=3)
        colour = a if i % 2 == 0 else b
        opacity = round(0.62 - i * 0.06, 3)
        parts.append(
            f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="none" '
            f'stroke="{colour}" stroke-width="{seed.between(6, 16, salt=4):.0f}" '
            f'opacity="{opacity}"/>'
        )
    return "".join(parts)


def _stripes(seed: _Seed, a: str, b: str) -> str:
    width = seed.between(18, 46, salt=1)
    parts = []
    offset = seed.between(-120, 120, salt=2)
    for x in range(int(offset) - _HEIGHT, _WIDTH + _HEIGHT, int(width * 2)):
        colour = a if int(x) % 4 < 2 else b
        parts.append(
            f'<rect x="{x:.0f}" y="{-_HEIGHT}" width="{width:.0f}" '
            f'height="{_HEIGHT * 3:.0f}" fill="{colour}" '
            f'transform="rotate({seed.angle} {_WIDTH / 2:.0f} {_HEIGHT / 2:.0f})" '
            f'opacity="0.5"/>'
        )
    return "".join(parts)


def _circles(seed: _Seed, a: str, b: str) -> str:
    parts = []
    for i in range(5):
        cx = seed.between(60, 740, salt=i + 1)
        cy = seed.between(60, 360, salt=i + 4)
        r = seed.between(70, 200, salt=i + 7)
        colour = a if i % 2 == 0 else b
        parts.append(
            f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="{colour}" '
            f'opacity="{round(0.34 - i * 0.04, 3)}"/>'
        )
    return "".join(parts)


def _horizon(seed: _Seed, a: str, b: str) -> str:
    parts = []
    for i in range(5):
        y = 150 + i * seed.between(24, 44, salt=i + 1)
        amp = seed.between(18, 52, salt=i + 3)
        colour = a if i % 2 == 0 else b
        parts.append(
            f'<path d="M0 {y:.0f} Q 200 {y - amp:.0f} 400 {y:.0f} '
            f'T 800 {y:.0f} L 800 {_HEIGHT} L 0 {_HEIGHT} Z" fill="{colour}" '
            f'opacity="{round(0.5 - i * 0.07, 3)}"/>'
        )
    return "".join(parts)


def _grid(seed: _Seed, a: str, b: str) -> str:
    cell = seed.between(38, 68, salt=1)
    parts = []
    cols = int(_WIDTH / cell) + 2
    rows = int(_HEIGHT / cell) + 2
    for cx in range(cols):
        for cy in range(rows):
            mix = (cx * 3 + cy * 5) % 7
            if mix > 3:
                continue
            colour = a if mix % 2 == 0 else b
            inset = cell * 0.18
            parts.append(
                f'<rect x="{cx * cell + inset:.0f}" y="{cy * cell + inset:.0f}" '
                f'width="{cell - inset * 2:.0f}" height="{cell - inset * 2:.0f}" '
                f'rx="{cell * 0.18:.0f}" fill="{colour}" '
                f'opacity="{round(0.5 - mix * 0.06, 3)}"/>'
            )
    return "".join(parts)


def _wedges(seed: _Seed, a: str, b: str) -> str:
    cx = seed.between(200, 600, salt=1)
    cy = seed.between(150, 340, salt=2)
    parts = []
    for i in range(9):
        start = (i * 40 + seed.value % 40) % 360
        colour = a if i % 2 == 0 else b
        parts.append(
            f'<path d="M{cx:.0f} {cy:.0f} L{cx + 700:.0f} {cy:.0f} '
            f'A700 700 0 0 1 {cx + 700 * (1 - (i * 40) / 360):.0f} '
            f'{cy + 700 * ((i * 40) / 360):.0f} Z" fill="{colour}" '
            f'opacity="{round(0.22 + (i % 3) * 0.12, 3)}" '
            f'transform="rotate({start} {cx:.0f} {cy:.0f})"/>'
        )
    return "".join(parts)


_PATTERNS = (_arcs, _stripes, _circles, _horizon, _grid, _wedges)


def place_cover_svg(place_id: str, name: str) -> str:
    """Return deterministic SVG artwork for a place.

    No text is drawn: the name is already rendered in the DOM over this image,
    and SVG text would fall back to whatever font the browser happens to have
    when the file is loaded as a background image.
    """
    seed = _Seed.for_place(place_id, name)
    a, b = _PALETTES[seed.value % len(_PALETTES)]
    pattern = _PATTERNS[(seed.value >> 8) % len(_PATTERNS)]
    angle = seed.angle
    # The name comes from OpenStreetMap and routinely contains & " and <, any
    # of which produces XML that no parser will accept. The bare default of
    # xml.sax.saxutils.escape leaves " alone, which breaks the attribute.
    label = _escape(f"Cover for {name}", {'"': "&quot;"})
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_WIDTH} {_HEIGHT}" '
        f'width="{_WIDTH}" height="{_HEIGHT}" role="img" '
        f'aria-label="{label}">'
        f'<defs><linearGradient id="g" gradientTransform="rotate({angle} .5 .5)">'
        f'<stop offset="0" stop-color="#1b1b1b"/>'
        f'<stop offset="1" stop-color="#2c2a26"/></linearGradient></defs>'
        f'<rect width="{_WIDTH}" height="{_HEIGHT}" fill="url(#g)"/>'
        f'<g>{pattern(seed, a, b)}</g>'
        f'<rect width="{_WIDTH}" height="{_HEIGHT}" fill="#0d0d0c" opacity="0.18"/>'
        f"</svg>"
    )
