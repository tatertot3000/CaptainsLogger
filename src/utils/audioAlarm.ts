/**
 * Offline Marine Audio Alarm & Vibration Synthesizer
 * Uses the Web Audio API to generate high-urgency alternating tone alarms
 * without needing external MP3 audio files or internet connectivity.
 */

class MarineAudioAlarm {
  private audioCtx: AudioContext | null = null;
  private isRunning = false;
  private intervalId: number | null = null;
  private currentOsc: OscillatorNode | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public isPlaying(): boolean {
    return this.isRunning;
  }

  /**
   * Starts a continuous, high-urgency two-tone marine alarm chime (siren).
   * Pulses between 880 Hz (A5) and 1175 Hz (D6).
   */
  public startAlarm(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const ctx = this.getAudioContext();
      let toneHigh = false;

      const playPulse = () => {
        if (!this.isRunning) return;

        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(toneHigh ? 1175 : 880, ctx.currentTime);

          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.35);

          toneHigh = !toneHigh;

          // Haptic vibration pulse if supported by device
          if ('vibrate' in navigator) {
            navigator.vibrate(250);
          }
        } catch (e) {
          console.debug('Error pulsing alarm tone:', e);
        }
      };

      playPulse();
      this.intervalId = window.setInterval(playPulse, 400);
    } catch (e) {
      console.warn('Failed to start Web Audio alarm:', e);
    }
  }

  /**
   * Stops the active siren immediately and cancels vibration.
   */
  public stopAlarm(): void {
    this.isRunning = false;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.currentOsc) {
      try {
        this.currentOsc.stop();
      } catch {}
      this.currentOsc = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }

  /**
   * Plays a brief 0.5s test sound so skipper can verify speaker volume.
   */
  public playTestBeep(): void {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);

      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
    } catch (e) {
      console.warn('Failed to play test sound:', e);
    }
  }
}

export const marineAlarm = new MarineAudioAlarm();

