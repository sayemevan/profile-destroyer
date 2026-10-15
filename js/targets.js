// Zero-effort targets: cartoon "profiles" for everyday annoyances, and the
// "mystery" card used when a real profile hides its photo.

export const PRESETS = [
  {
    id: 'boss', name: 'My Boss', handle: 'the_boss', emoji: '😤', colors: ['#334155', '#64748b'],
    bio: "Can you hop on a quick call? It'll only take 2 hours.",
    stats: [['47', 'Meetings'], ['0', 'Raises'], ['∞', 'Emails']],
  },
  {
    id: 'ex', name: 'My Ex', handle: 'the_ex', emoji: '💔', colors: ['#be123c', '#fb7185'],
    bio: 'Still has your hoodie. Still watching your stories.',
    stats: [['3am', 'Texts'], ['0', 'Sorrys'], ['∞', 'Red flags']],
  },
  {
    id: 'monday', name: 'Monday', handle: 'monday', emoji: '😩', colors: ['#1d4ed8', '#60a5fa'],
    bio: 'Back again. Every. Single. Week.',
    stats: [['52', 'Visits/yr'], ['0', 'Fans'], ['∞', 'Coffee']],
  },
  {
    id: 'exams', name: 'Exams', handle: 'exam_season', emoji: '📚', colors: ['#7c2d12', '#f97316'],
    bio: 'Surprise! Chapter 9 was in the syllabus all along.',
    stats: [['12', 'Papers'], ['3', 'Hrs sleep'], ['∞', 'Stress']],
  },
  {
    id: 'alarm', name: 'Alarm Clock', handle: 'alarm_clock', emoji: '⏰', colors: ['#a16207', '#facc15'],
    bio: 'Rings five minutes after you finally fall asleep.',
    stats: [['6:00', 'AM'], ['9', 'Snoozes'], ['0', 'Mercy']],
  },
  {
    id: 'wifi', name: 'Slow WiFi', handle: 'slow_wifi', emoji: '🐌', colors: ['#166534', '#4ade80'],
    bio: 'Buffering… buffering… still buffering.',
    stats: [['1', 'Bar'], ['99%', 'Loading'], ['∞', 'Rage']],
  },
];

const FUN = { id: 'fun', name: 'Target', color: '#ff3b7a' };

export function presetProfile(id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return null;
  return {
    service: { ...FUN, color: p.colors[0] },
    preset: p.id,
    handle: p.handle,
    url: `preset:${p.id}`,
    name: p.name,
    bio: p.bio,
    stats: p.stats,
    avatar: emojiAvatar(p.emoji, p.colors),
  };
}

export function emojiAvatar(emoji, [c1, c2], size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.font = `${size * 0.58}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, size / 2, size * 0.54);
  return c;
}

// Grey silhouette with a question mark, for profiles that hide their photo.
export function mysteryAvatar(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#cbd5e1');
  grad.addColorStop(1, '#94a3b8');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#64748b';
  g.beginPath(); g.arc(size / 2, size * 0.4, size * 0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(size / 2, size * 0.98, size * 0.36, size * 0.3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.font = `900 ${size * 0.26}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', size / 2, size * 0.42);
  return c;
}

// Who got destroyed, in words: "My Boss", "@nasa's X profile", "myself"…
export function targetLabel(profile) {
  if (profile.preset) return profile.name;
  if (profile.selfie) return 'myself';
  if (profile.url) return `@${profile.handle}'s ${profile.service.name} profile`;
  return 'this profile';
}
