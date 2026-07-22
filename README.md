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
Comparison clips are **not** in the repo — see below.

## Preview locally
```bash
cd project_page
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish (GitHub Pages)
Create a public repo named `<username>.github.io` on the anonymous account,
then from THIS folder:
```bash
git init
git branch -M main
git remote add origin https://github.com/<username>/<username>.github.io.git
git add .
git commit -m "Initial project page"
git pull --rebase origin main   # if the repo already has a README
git push -u origin main
```
Enable Pages: repo Settings → Pages → Deploy from branch → main → / (root).
Live at: `https://<username>.github.io`

> Note: GitHub Pages serves from the repo root. If you keep everything inside
> a `project_page/` subfolder, either push the *contents* of this folder to the
> repo root, or move these files to the repo root before pushing.

## Videos (don't bloat the repo)
The 90 comparison clips are **GitHub Release assets under tag `v1`**, not repo
files. `scripts/crops_out_*/` is gitignored; the viewer fetches from the release
URL set in `CFG.base` (`static/compare.js`). Release assets are byte-range
capable, so seeking and frame-stepping work.

Clips are encoded off-repo from the 8K frame sequences. Every method **and** GT
must use identical settings, so the codec can never be mistaken for a method
difference — 512x512 crop, 30 fps, `libx264 -crf 20 -preset slow -pix_fmt
yuv420p -movflags +faststart`, plus `-map_metadata -1 -fflags +bitexact` to keep
encoder strings and timestamps out of the files. Short GOP (`-g 15
-keyint_min 15 -sc_threshold 0`) makes the viewer's frame-step responsive.

Upload with the CLI — the web "Draft a new release" form silently discards
attachments if you never click *Publish*, and silently skips files whose name
already exists:
```powershell
gh release create v1 --repo <user>/<user>.github.io --title "Comparison clips v1" `
  (Get-ChildItem scripts/crops_out_*/*.mp4).FullName
# re-upload/overwrite individual assets:
gh release upload v1 --clobber --repo <user>/<user>.github.io <files>
```
To serve a re-encode, upload under a **new tag** and bump `v1` in `CFG.base`;
replacing assets in place serves stale bytes from the CDN cache.

**Regenerate posters whenever the clips change**, or `static/posters/` will show
a frame from the old encode. One per clip, matching basename:
```powershell
Get-ChildItem scripts/crops_out_*/*.mp4 | ForEach-Object {
  ffmpeg -y -loglevel error -i $_.FullName -frames:v 1 -c:v libwebp -quality 72 `
    -map_metadata -1 -fflags +bitexact "static/posters/$($_.BaseName).webp"
}
```

Local preview: point `CFG.base` back at `scripts/crops_out_<ds>/`.

## Anonymity checklist (Phase 1)
- [ ] `noindex` meta tag present in `index.html` `<head>`
- [ ] `robots.txt` has `Disallow: /`
- [ ] No author names, affiliations, logos, or code links
- [ ] Metadata stripped from all videos/images
- [ ] Link shared ONLY in the paper supplementary — nowhere public

## After acceptance (Phase 2)
- [ ] Remove `noindex` meta tag; set `robots.txt` to `Allow: /`
- [ ] Swap "Anonymous Submission" for the author block (commented in index.html)
- [ ] Uncomment the BibTeX section; add arXiv/code links
- [ ] Transfer repo to your real account (or copy files there)
