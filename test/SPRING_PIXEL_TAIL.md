# Spring pixel-tail characterization (openseadragon/openseadragon#2877)

This is a **Spring update** fixture, not a drawer repaint or GPU benchmark.
A fixed clock starts at 0 ms and advances in 16 ms steps through 1200 ms
(75 updates). The first 74 calls return "animating" under the current
exact-target contract; the 75th ends the spring. Every position is rounded
to a CSS pixel (device pixel ratio 1).

The pan proxy moves 0 -> 0.2 world units across 500 CSS pixels/world unit,
or 100 CSS pixels. The exponential zoom proxy moves 1 -> 2 with a stationary
world point 0.2 units from the center: 100 -> 200 CSS pixels. The default
viewer settings at base `36b92d228b121f5fa4c933aa5bb3d5eb10859e05`
are `springStiffness=6.5` and `animationTime=1.2` seconds. The near-linear
control changes **only** stiffness to `0.000001`.

| Projection / easing | Active updates | Unchanged active | Unchanged incl. final | Consecutive unchanged active tail | Last pixel-moving active tick |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pan, default ease-out (6.5) | 74 | 38 | 39 | 15 | 59 (944 ms) |
| Pan, near-linear (0.000001) | 74 | 0 | 0 | 0 | 74 (1184 ms) |
| Zoom, default ease-out (6.5, exponential) | 74 | 34 | 35 | 13 | 61 (976 ms) |
| Zoom, near-linear (0.000001, exponential) | 74 | 0 | 0 | 0 | 74 (1184 ms) |

These are **formula-derived fixture expectations, not executed test results**.
For tick `n = 0..75` and stiffness `s`, define
`f(n) = (1 - exp(-s*n/75)) / (1 - exp(-s))`.
The pan pixel is `round(100*f(n))`; zoom is `round(100*2^f(n))`.
For each `n=1..74`, count a stationary active update when the rounded
pixel equals tick `n-1`. Include tick 75 only in the "incl. final" column.
For the default ease-out, the pan first rounds to its final pixel at tick
59 and stays there for 15 more **active** ticks; zoom reaches its final
pixel at tick 61 and stays for 13. The final tick is also pixel-static.

This fixture intentionally characterizes the current behavior without
altering easing or introducing early-stop tolerances. The documented
plateaus do not themselves prove that a drawer performs redundant draws,
nor that all drawers or HDPI screens behave alike. Before changing Spring
termination, compare actual redraw counts and test for an end-of-motion
clunk with rendered browser output. The source report's original demo
may also exercise the image-loader API incorrectly; see the corrected
demo linked in upstream issue #2877.
