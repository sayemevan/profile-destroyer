// Weapon stats. Tuned so each gun destroys roughly the same amount per round,
// just with a different feel.
//   gap     seconds between shots while holding
//   pellets bullets per shot (shotgun)
//   spread  random aim error, radians
//   r       bullet hole radius range (card units)
//   chunkP  chance a hit knocks a chunk loose, chunk = its radius range
//   reach   how far a shot landing in a hole can still catch an intact edge
//   muzzle  distance from shoulder to barrel tip (gunman units)

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'Pistol', gap: 0.11, pellets: 1, spread: 0.022, speed: 1800,
    r: [8, 11], chunkP: 0.3, chunk: [22, 34], reach: 7, muzzle: 54, kick: 1, flash: 1,
  },
  uzi: {
    id: 'uzi', name: 'Uzi', gap: 0.055, pellets: 1, spread: 0.07, speed: 2000,
    r: [5, 8], chunkP: 0.22, chunk: [18, 26], reach: 7, muzzle: 58, kick: 0.6, flash: 0.8,
  },
  shotgun: {
    id: 'shotgun', name: 'Shotgun', gap: 0.45, pellets: 8, spread: 0.13, speed: 1700,
    r: [6, 9], chunkP: 0.2, chunk: [18, 28], reach: 7, muzzle: 72, kick: 1.7, flash: 1.5,
  },
  bazooka: {
    id: 'bazooka', name: 'Bazooka', gap: 0.75, pellets: 1, spread: 0, speed: 750,
    r: [20, 24], chunkP: 1, chunk: [36, 48], reach: 30, muzzle: 78, kick: 2, flash: 1.8, rocket: true,
  },
};

export const WEAPON_ORDER = ['pistol', 'uzi', 'shotgun', 'bazooka'];
