# composite/carries: Which technique carries which part (visual)

**What it is:** the brief table from the Composite sheet, turned into a picture for the slide (Key: "the second composite slide is too detailed, make it more visual"). It shows a wireframe product page. Each part is outlined in the colour of the surface that carries it, with a leader line to a surface tag, and the pairs light up one at a time.

**Source:** `design/techniques/composite.html` §2, the "Brief · a product launch page" table. Same parts, same surfaces, labelled illustrative there. The deck's own derivative, not a migration: the sheet has no such figure.

**Mapping:** nav, headline and button → DOM · CSS; line icons → SVG; product → WebGL; particle field → WebGPU; backdrop loop → video; no GPU → a still with the same DOM.

**Motion:** a CSS highlight cycles through the six pairs every 2s, 12s in all. With reduced motion it is static, with everything lit.
