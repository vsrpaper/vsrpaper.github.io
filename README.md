# Project Page

Static project/demo page for the paper. Plain HTML/CSS — no build step.

## Structure
```
index.html          # the page (title/abstract/figures live here)
robots.txt          # Phase 1: blocks crawlers (unlisted). Flip after acceptance.
diagrams/           # method figures, *.svg (only the six dark ones are referenced)
static/
  compare.js        # interactive comparison viewer; CFG at the top is the only knob
  compare.css
  style.css, site.js, fonts.css
  figures/          # nav_SEPE.jpg, nav_VIDEA.jpg — clickable 8K crop navigators
  posters/          # first frame of each clip (.webp), so the stage never sits black
```
