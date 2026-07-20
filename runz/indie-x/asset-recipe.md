# RUNZ Indie X 2026 Asset Recipe

The public assets in `runz/assets/indie-x/2026/` were derived from owned RUNZ screenshots and the current Steam trailer.

## Still Images

- Preview: crop `combat-chaos.png` at `(1060, 400, 1660, 1000)`, resize to 1000x1000 with nearest-neighbor sampling, and export as progressive JPG at quality 88 and 300 DPI.
- High-resolution screenshot: crop the same source at `(450, 320, 1650, 995)`, resize to 3600x2025 with nearest-neighbor sampling, and export as optimized PNG at 300 DPI.
- Logo: extract the trailer frame at 45.4 seconds, flood-fill exterior near-black pixels as transparent while preserving the enclosed black lockup, and export the unchanged 1920x1080 canvas as optimized RGBA PNG at 300 DPI.

Logo source-frame extraction:

```powershell
ffmpeg -ss 45.4 -i runz-steam-trailer.mp4 -frames:v 1 indiex_logo_source.png
```

## Gameplay Reel

The reel is seven two-second segments, silent for festival editing, encoded as H.264 at 1920x1080 and 30 fps:

```powershell
ffmpeg -i runz-steam-trailer.mp4 -filter_complex "[0:v]trim=start=0.2:end=2.2,setpts=PTS-STARTPTS[v0];[0:v]trim=start=10:end=12,setpts=PTS-STARTPTS[v1];[0:v]trim=start=14:end=16,setpts=PTS-STARTPTS[v2];[0:v]trim=start=18:end=20,setpts=PTS-STARTPTS[v3];[0:v]trim=start=30:end=32,setpts=PTS-STARTPTS[v4];[0:v]trim=start=34:end=36,setpts=PTS-STARTPTS[v5];[0:v]trim=start=40:end=42,setpts=PTS-STARTPTS[v6];[v0][v1][v2][v3][v4][v5][v6]concat=n=7:v=1:a=0,fps=30,format=yuv420p[v]" -map "[v]" -c:v libx264 -profile:v high -level 4.1 -crf 20 -preset slow -movflags +faststart -an runz-gameplay-reel-14s.mp4
```
