# Profile Destroyer

Paste a social profile link, blast the profile card to pieces with a tiny cartoon gunslinger, then share how much you destroyed.

## Run

No build step, no dependencies. Any static server works:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## How it works

- `js/profile.js`: parses the link (X, Instagram, GitHub, YouTube, TikTok, Reddit, Twitch, Bluesky, Threads, Facebook, LinkedIn, or any site). Avatars come from [unavatar.io](https://unavatar.io); GitHub also pulls the real name, bio and stats from the GitHub API. Other platforms get joke bio and stats. If no avatar is found, it falls back to initials.
- `js/card.js`: draws the profile card on an offscreen canvas.
- `js/game.js`: the 15-second round. Tap to shoot, or hold and slide to spray. The gunman follows your finger. Bullets punch holes, crack and scorch the card, and knock off chunks. Every 10-hit combo fires a MEGA SHOT. The destroyed % is tracked on a 10px cell grid, and shots through existing holes miss. Shots on the profile photo leave a faded copy of the face behind.
- `js/weapons.js`: pistol, uzi, shotgun and bazooka, tuned to destroy about the same amount per round. The choice is remembered per browser.
- `js/share.js`: builds a 1080×1080 before/after brag image and the Facebook, WhatsApp and X share links. The link carries `?t=<profile url>&s=<score>`, so friends land on a "beat this score" challenge.
- `js/audio.js`: synthesized sound effects (no audio files).

## Deploy

It's a static site with no backend or database, so it deploys to Vercel (or Netlify, GitHub Pages) as-is: import the repo with no build command and use the repo root as the output directory.

## Known limits

- unavatar.io's free tier is rate-limited. For production, get an API key or proxy avatars through your own backend.
- Facebook and LinkedIn avatars aren't public, so those use the initials fallback.
- Link previews on social sites show a generic card. A per-score preview image would need a small server that renders `og:image`.
