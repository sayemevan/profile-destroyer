# Profile Destroyer

Paste a social profile link, blast the profile card to pieces with a tiny cartoon gunslinger, then share how much you destroyed.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:8765. The dev server runs the `/api` functions like Vercel does.

## How it works

- `js/profile.js`: parses the link (X, Instagram, GitHub, YouTube, TikTok, Reddit, Twitch, Bluesky, Threads, Facebook, LinkedIn, or any site). It asks `/api/profile` for the real name and picture, then falls back to [unavatar.io](https://unavatar.io), then to initials. GitHub uses the GitHub API for name, bio and stats. Other platforms get a joke bio and stats.
- `js/card.js`: draws the profile card on an offscreen canvas.
- `js/game.js`: the 15-second round. Tap to shoot, or hold and slide to spray. The gunman follows your finger. Bullets punch holes, crack and scorch the card, and knock off chunks. Every 10-hit combo fires a MEGA SHOT. The destroyed % is tracked on a 10px cell grid, and shots through existing holes miss. Shots on the profile photo leave a faded copy of the face behind.
- `js/weapons.js`: pistol, uzi, shotgun and bazooka, tuned to destroy about the same amount per round. The choice is remembered per browser.
- `js/share.js`: builds the 1080×1080 before/after brag image with a Sayem Dreams follow bar. Players post it with **Share image** (the phone's share sheet) or save it. **Copy link** gives a challenge link, `?t=<target>&s=<score>`; its preview uses the default `og.jpg`.
- `js/targets.js`: one-tap cartoon targets (My Boss, My Ex, Monday, Exams, Alarm Clock, Slow WiFi) and the Mystery card for private profiles. Private profiles play straight away; after the round the player can add the real name and photo, and `replayDamage` redraws the exact same damage on it.
- `js/clip.js`: records the round as a 540×960 video with sound, a score bar and a Sayem Dreams watermark, to share on Reels, TikTok and Stories.
- Challenge links (`?t=…&s=…`) skip the home screen and start the same target with "BEAT xx%" on screen. The round clock starts on the first shot.
- `js/audio.js`: synthesized sound effects (no audio files).

## API (Vercel functions in `api/`)

- `GET /api/profile?url=`: reads a profile page's public Open Graph tags (name, picture, real URL). This also resolves Facebook `facebook.com/share/…` links. Only known social sites are fetched.
- `GET /api/img?src=`: proxies profile pictures so the canvas can be exported, with CDN caching so unavatar.io's free quota (25/day per IP) lasts. Only known image hosts are allowed.

## Deploy to Vercel

1. Import the GitHub repo in Vercel. No build command is needed.
2. Optional: set `UNAVATAR_API_KEY` for a paid unavatar.io plan if you get a lot of traffic.

## Known limits

- Profile lookups depend on each site showing public tags to bots. Facebook, Instagram and X do today; TikTok doesn't, so it uses unavatar.io. Sites may also block datacenter IPs.
- `og.jpg` is referenced by absolute URL (`https://profile-destroyer.vercel.app/og.jpg`) in `index.html`. Update it if the domain changes.
