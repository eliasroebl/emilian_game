export class SoundFX {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.ctx;
  }

  private beep(freq: number, duration: number, type: OscillatorType = 'square', vol = 0.15) {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  }

  jump()   { this.beep(320, 0.12, 'square', 0.12); }
  stomp()  { this.beep(180, 0.18, 'sawtooth', 0.18); this.beep(80, 0.12, 'square', 0.10); }
  coin()   { this.beep(880, 0.08, 'sine', 0.12); this.beep(1100, 0.08, 'sine', 0.10); }
  hit()    { this.beep(120, 0.15, 'sawtooth', 0.20); }
  kill()   { this.beep(220, 0.10, 'square', 0.15); this.beep(440, 0.10, 'sine', 0.12); }
  checkpoint() { this.beep(660, 0.08, 'sine', 0.12); this.beep(880, 0.12, 'sine', 0.12); }
  levelComplete() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.beep(f, 0.2, 'sine', 0.15), i * 100);
    });
  }
}

export const soundFX = new SoundFX();
