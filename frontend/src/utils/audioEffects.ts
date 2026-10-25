/**
 * Next-Gen Web Audio API Sound Effects Engine (Version 3.0)
 * Completely synthesized futuristic sci-fi acoustics & electric powertrain dynamics:
 * - Holographic crystal pin drops
 * - Quantum laser Dijkstra route lock
 * - Sub-bass hyper-torque warp departure
 * - Dynamic harmonic FM electric turbine hum
 * - Dual-tone crystal sonar turn ping
 * - Sparkling celestial arrival fanfare
 * Zero external MP3/audio files, zero CORS issues, instant 0-latency playback.
 */

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  
  // Continuous Electric Turbine Nodes
  private turbineOscCarrier: OscillatorNode | null = null;
  private turbineOscMod: OscillatorNode | null = null;
  private turbineModGain: GainNode | null = null;
  private turbineGain: GainNode | null = null;
  private turbineFilter: BiquadFilterNode | null = null;
  private isHumming: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopEngineHum();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Sound 1: Holographic Pin Drop / Node Selection
   * Ultra-crisp dual glass snap with resonant harmonic tail
   */
  public playPinDrop() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // High-pitched crystal ping
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1480, now);
    osc1.frequency.exponentialRampToValueAtTime(2960, now + 0.04);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2220, now);
    osc2.frequency.exponentialRampToValueAtTime(4440, now + 0.03);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.085);
    osc2.stop(now + 0.085);
  }

  /**
   * Sound 2: Quantum Route Lock / Dijkstra Shortest Path Computed
   * Cyber-scan ascending 4-tier harmonic laser lock
   */
  public playRouteFound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chord = [659.25, 830.61, 987.77, 1318.51, 1975.53]; // E5, G#5, B5, E6, B6
    
    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      const startTime = now + idx * 0.035;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.04, startTime + 0.12);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, startTime);
      filter.Q.setValueAtTime(6.0, startTime);

      gain.gain.setValueAtTime(0.09, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.17);
    });
  }

  /**
   * Sound 3: Sub-Bass Hyper-Torque Warp Departure
   * Deep bass power pulse + rising electric turbo spool-up
   */
  public playEngineStart() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Deep Sub-Bass Impact
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(95, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
    subGain.gain.setValueAtTime(0.22, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.39);

    // 2. Rising Turbine Warp Swell
    const warpOsc = this.ctx.createOscillator();
    const warpFilter = this.ctx.createBiquadFilter();
    const warpGain = this.ctx.createGain();

    warpOsc.type = 'triangle';
    warpOsc.frequency.setValueAtTime(140, now);
    warpOsc.frequency.exponentialRampToValueAtTime(560, now + 0.4);
    warpOsc.frequency.linearRampToValueAtTime(420, now + 0.6);

    warpFilter.type = 'bandpass';
    warpFilter.frequency.setValueAtTime(280, now);
    warpFilter.frequency.exponentialRampToValueAtTime(1800, now + 0.4);
    warpFilter.Q.setValueAtTime(3.8, now);

    warpGain.gain.setValueAtTime(0.01, now);
    warpGain.gain.linearRampToValueAtTime(0.18, now + 0.22);
    warpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    warpOsc.connect(warpFilter);
    warpFilter.connect(warpGain);
    warpGain.connect(this.ctx.destination);

    warpOsc.start(now);
    warpOsc.stop(now + 0.66);
  }

  /**
   * Sound 4: Smooth FM Electric Propulsion Turbine Hum
   * Pleasant, non-fatiguing harmonic modulation that dynamic pitch-shifts with speed
   */
  public startEngineHum(initialSpeedKmH: number = 60) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    if (this.isHumming && this.turbineGain) {
      this.updateEngineHum(initialSpeedKmH);
      return;
    }

    const now = this.ctx.currentTime;
    this.turbineOscCarrier = this.ctx.createOscillator();
    this.turbineOscMod = this.ctx.createOscillator();
    this.turbineModGain = this.ctx.createGain();
    this.turbineFilter = this.ctx.createBiquadFilter();
    this.turbineGain = this.ctx.createGain();

    // Carrier = pure electric sine
    this.turbineOscCarrier.type = 'sine';
    const baseFreq = 95 + (initialSpeedKmH / 100) * 115;
    this.turbineOscCarrier.frequency.setValueAtTime(baseFreq, now);

    // Modulator = subtle 8Hz harmonic shimmer
    this.turbineOscMod.type = 'sine';
    this.turbineOscMod.frequency.setValueAtTime(8, now);
    this.turbineModGain.gain.setValueAtTime(18, now);

    this.turbineOscMod.connect(this.turbineModGain);
    this.turbineModGain.connect(this.turbineOscCarrier.frequency);

    // Smooth low-pass filter
    this.turbineFilter.type = 'lowpass';
    this.turbineFilter.frequency.setValueAtTime(420, now);
    this.turbineFilter.Q.setValueAtTime(1.8, now);

    // Warm gain ramp
    this.turbineGain.gain.setValueAtTime(0.001, now);
    this.turbineGain.gain.linearRampToValueAtTime(0.075, now + 0.18);

    this.turbineOscCarrier.connect(this.turbineFilter);
    this.turbineFilter.connect(this.turbineGain);
    this.turbineGain.connect(this.ctx.destination);

    this.turbineOscCarrier.start(now);
    this.turbineOscMod.start(now);
    this.isHumming = true;
  }

  public updateEngineHum(speedKmH: number) {
    if (this.isMuted || !this.ctx || !this.turbineOscCarrier || !this.turbineGain || !this.isHumming) return;
    const now = this.ctx.currentTime;
    const clampedSpeed = Math.max(15, Math.min(speedKmH, 180));
    const targetFreq = 95 + clampedSpeed * 1.25;

    this.turbineOscCarrier.frequency.cancelScheduledValues(now);
    this.turbineOscCarrier.frequency.setTargetAtTime(targetFreq, now, 0.06);

    if (this.turbineFilter) {
      this.turbineFilter.frequency.setTargetAtTime(360 + clampedSpeed * 2.8, now, 0.06);
    }
  }

  public stopEngineHum() {
    if (!this.isHumming || !this.ctx || !this.turbineGain) return;
    this.isHumming = false;
    const now = this.ctx.currentTime;
    this.turbineGain.gain.cancelScheduledValues(now);
    this.turbineGain.gain.linearRampToValueAtTime(0.001, now + 0.12);

    const carrier = this.turbineOscCarrier;
    const mod = this.turbineOscMod;
    const gain = this.turbineGain;
    const filter = this.turbineFilter;
    const modGain = this.turbineModGain;

    this.turbineOscCarrier = null;
    this.turbineOscMod = null;
    this.turbineGain = null;
    this.turbineFilter = null;
    this.turbineModGain = null;

    setTimeout(() => {
      try {
        carrier?.stop();
        carrier?.disconnect();
        mod?.stop();
        mod?.disconnect();
        gain?.disconnect();
        filter?.disconnect();
        modGain?.disconnect();
      } catch {
        // already cleaned up
      }
    }, 140);
  }

  /**
   * Sound 5: Dual-Tone Crystal Sonar Turn Ping
   * Crisp spatial chirp whenever the vehicle executes a major road curve or intersection
   */
  public playTurnChime() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now); // E6
    osc1.frequency.exponentialRampToValueAtTime(1760.00, now + 0.05); // A6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2637.02, now + 0.02); // E7
    osc2.frequency.exponentialRampToValueAtTime(3520.00, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.02);
    osc1.stop(now + 0.13);
    osc2.stop(now + 0.13);
  }

  /**
   * Sound 6: Sparkling Celestial Arrival Fanfare
   * Triumphant harmonic arpeggio with shimmering decay celebrating zero-incident delivery!
   */
  public playArrivalFanfare() {
    if (this.isMuted) return;
    this.stopEngineHum();
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Soaring major 9th triumph arpeggio
    const fanfareNotes = [
      { f: 523.25, t: 0.00, d: 0.22, vol: 0.12 }, // C5
      { f: 659.25, t: 0.06, d: 0.24, vol: 0.13 }, // E5
      { f: 783.99, t: 0.12, d: 0.26, vol: 0.14 }, // G5
      { f: 987.77, t: 0.18, d: 0.30, vol: 0.15 }, // B5
      { f: 1046.50, t: 0.24, d: 0.45, vol: 0.18 }, // C6
      { f: 1318.51, t: 0.30, d: 0.50, vol: 0.16 }, // E6
      { f: 1567.98, t: 0.36, d: 0.65, vol: 0.19 }, // G6
      { f: 2093.00, t: 0.42, d: 0.85, vol: 0.20 }  // C7 (Grand finale shimmer)
    ];

    fanfareNotes.forEach(({ f, t, d, vol }) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.01, now + t + d);

      gain.gain.setValueAtTime(vol, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + d + 0.02);
    });
  }
}

export const soundEffects = new SoundEffectsEngine();
