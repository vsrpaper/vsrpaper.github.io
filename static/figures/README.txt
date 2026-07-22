Placeholder folder for figures (PNG/JPG/SVG).

Replace teaser.png and results.png references in index.html with your real
figures. Strip metadata before committing, e.g.:
  ffmpeg -i in.png -map_metadata -1 clean.png
or use exiftool -all= figure.png
