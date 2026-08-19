Placeholder folder for video clips.

Do NOT commit large MP4s into the git repo. Instead:
  1. Compress + strip metadata with scripts/encode_videos.sh
  2. Upload the MP4s as GitHub *Release assets* (or to a Hugging Face repo)
  3. Replace the <source src="static/videos/clipN.mp4"> URLs in index.html
     with the hosted URLs, e.g.:
     https://github.com/<user>/<user>.github.io/releases/download/v1/clip1.mp4

Small local test clips (a few MB) are fine to commit temporarily.
