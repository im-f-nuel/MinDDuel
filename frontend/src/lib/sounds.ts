class SoundEngine {
  private ctx: AudioContext | null = null

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new window.AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.18) {
    try {
      const ctx = this.context()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch {
      // AudioContext not available (SSR / user blocked)
    }
  }

  correct() {
    this.tone(523, 0.12)
    setTimeout(() => this.tone(659, 0.16), 110)
    setTimeout(() => this.tone(784, 0.22), 220)
  }

  wrong() {
    this.tone(220, 0.22, 'sawtooth', 0.14)
    setTimeout(() => this.tone(180, 0.28, 'sawtooth', 0.10), 200)
  }

  place() {
    this.tone(440, 0.08, 'sine', 0.10)
  }

  win() {
    ;[523, 659, 784, 1047].forEach((freq, i) =>
      setTimeout(() => this.tone(freq, 0.22), i * 100),
    )
  }

  lose() {
    this.tone(330, 0.18, 'triangle', 0.14)
    setTimeout(() => this.tone(262, 0.28, 'triangle', 0.10), 200)
  }

  timeout() {
    this.tone(330, 0.30, 'sine', 0.12)
    setTimeout(() => this.tone(262, 0.40, 'sine', 0.08), 280)
  }
}

export const sounds = new SoundEngine()
