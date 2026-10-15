// Records the round as a short vertical video (for Reels / TikTok / Stories).
// Each frame the game canvas is copied onto a smaller canvas with a score bar
// and a Sayem Dreams watermark, and that canvas is recorded with the sound.

import { audioStream } from './audio.js';
import { BRAND } from './brand.js';

const WIDTH = 540;
const TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
const DISPLAY = 'Bungee, Impact, "Arial Black", sans-serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function canRecord() {
  return typeof MediaRecorder !== 'undefined'
    && !!HTMLCanvasElement.prototype.captureStream
    && TYPES.some(t => MediaRecorder.isTypeSupported?.(t));
}

export class Clip {
  constructor(stage) {
    this.stage = stage;
    this.rec = null;
  }

  start() {
    this.cancel();
    if (!canRecord()) return;
    const ratio = this.stage.height / this.stage.width;
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = Math.min(Math.round(WIDTH * ratio / 2) * 2, 960);
    this.g = this.canvas.getContext('2d');

    const stream = this.canvas.captureStream(30);
    const audio = audioStream();
    audio?.getAudioTracks().forEach(t => stream.addTrack(t));
    this.type = TYPES.find(t => MediaRecorder.isTypeSupported(t));
    this.chunks = [];
    try {
      this.rec = new MediaRecorder(stream, { mimeType: this.type, videoBitsPerSecond: 2_500_000 });
    } catch {
      this.rec = null;
      return;
    }
    this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
  }

  // Called by the game after it draws each frame.
  frame(game) {
    if (!this.rec) return;
    const g = this.g, W = this.canvas.width, H = this.canvas.height;
    const sh = this.stage.height * W / this.stage.width;
    g.drawImage(this.stage, 0, (H - sh) / 2, W, sh);

    // top bar: score + timer
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(0, 0, W, 64);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = '#ffd23f';
    g.font = `24px ${DISPLAY}`;
    g.fillText('PROFILE DESTROYER', 16, 33);
    g.textAlign = 'right';
    g.fillStyle = '#fff';
    g.fillText(`${game.percent()}%`, W - 70, 33);
    g.fillStyle = game.time <= 5 ? '#ff3b3b' : '#fff';
    g.fillText(String(Math.max(0, Math.ceil(game.time))), W - 16, 33);

    // final score stamp
    if (game.state === 'end') {
      g.save();
      g.translate(W / 2, H * 0.42);
      g.rotate(-0.08);
      g.textAlign = 'center';
      g.font = `58px ${DISPLAY}`;
      g.lineWidth = 10;
      g.lineJoin = 'round';
      g.strokeStyle = '#000';
      const text = `${game.percent()}% DESTROYED`;
      const s = Math.min(1, (W - 30) / g.measureText(text).width);
      g.scale(s, s);
      g.strokeText(text, 0, 0);
      g.fillStyle = '#ff3b3b';
      g.fillText(text, 0, 0);
      g.restore();
    }

    // watermark
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(0, H - 44, W, 44);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = `700 18px ${SANS}`;
    g.fillText(`Follow ${BRAND.facebookShort}  ·  ▶ YouTube ${BRAND.youtubeHandle}`, W / 2, H - 22);
  }

  // Resolves with the finished video file, or null if recording isn't available.
  stop() {
    const rec = this.rec;
    this.rec = null;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise(resolve => {
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.type.split(';')[0] });
        resolve(blob.size > 1000 ? blob : null);
      };
      rec.stop();
    });
  }

  cancel() {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    this.rec = null;
  }
}
