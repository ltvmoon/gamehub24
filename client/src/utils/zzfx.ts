/**
 * ZzFX - Zuper Zmall Zound Zynth - Micro Edition
 * MIT License - Copyright 2019 Frank Force
 * https://github.com/KilledByAPixel/ZzFX
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-empty */

const zzfxV = 0.3; // volume
let zzfxX: AudioContext | null = null; // audio context

/**
 * Generate and play a sound
 */
export const zzfx = (
  volume = 1,
  randomness = 0.05,
  frequency = 220,
  attack = 0,
  sustain = 0,
  release = 0.1,
  shape = 0,
  shapeCurve = 1,
  slide = 0,
  deltaSlide = 0,
  pitchJump = 0,
  pitchJumpTime = 0,
  repeatTime = 0,
  noise = 0,
  modulation = 0,
  bitCrush = 0,
  delay = 0,
  sustainVolume = 1,
  decay = 0,
  tremolo = 0,
  filter = 0
): AudioBufferSourceNode | null => {
  try {
    // Initialize audio context on first use (must be after a user interaction)
    if (!zzfxX) {
      zzfxX = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // init parameters
    const sampleRate = 44100;
    const PI2 = Math.PI * 2;
    const abs = Math.abs;
    const sign = (v: number) => (v < 0 ? -1 : 1);

    let startSlide = (slide *= (500 * PI2) / sampleRate / sampleRate);
    let startFrequency = (frequency *=
      (1 + randomness * 2 * Math.random() - randomness) * (PI2 / sampleRate));
    let modOffset = 0;
    let repeat = 0;
    let crush = 0;
    let jump = 1;
    let length: number;
    const b: number[] = [];
    let t = 0;
    let i = 0;
    let s = 0;
    let f: number;

    // source and buffer
    const source = zzfxX.createBufferSource();

    // biquad LP/HP filter
    const quality = 2;
    const w = PI2 * abs(filter) * 2 / sampleRate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / 2 / quality;
    const a0 = 1 + alpha;
    const a1 = (-2 * cos) / a0;
    const a2 = (1 - alpha) / a0;
    const b0 = (1 + sign(filter) * cos) / 2 / a0;
    const b1 = -(sign(filter) + cos) / a0;
    const b2 = b0;
    let x2 = 0;
    let x1 = 0;
    let y2 = 0;
    let y1 = 0;

    // scale by sample rate
    const minAttack = 9; // prevent pop if attack is 0
    attack = attack * sampleRate || minAttack;
    decay *= sampleRate;
    sustain *= sampleRate;
    release *= sampleRate;
    delay *= sampleRate;
    deltaSlide *= (500 * PI2) / sampleRate ** 3;
    modulation *= PI2 / sampleRate;
    pitchJump *= PI2 / sampleRate;
    pitchJumpTime *= sampleRate;
    repeatTime = (repeatTime * sampleRate) | 0;
    volume *= zzfxV;

    // generate waveform
    for (
      length = (attack + decay + sustain + release + delay) | 0;
      i < length;
      b[i++] = s * volume
    ) {
      if (!(++crush % ((bitCrush * 100) | 0))) {
        // bit crush
        s = shape
          ? shape > 1
            ? shape > 2
              ? shape > 3
                ? shape > 4
                  ? ((t / PI2) % 1 < shapeCurve / 2 ? 1 : -1) // 5 square duty
                  : Math.sin(t ** 3) // 4 noise
                : Math.max(Math.min(Math.tan(t), 1), -1) // 3 tan
              : 1 - (((2 * t) / PI2) % 2 + 2) % 2 // 2 saw
            : 1 - 4 * abs(Math.round(t / PI2) - t / PI2) // 1 triangle
          : Math.sin(t); // 0 sin

        s =
          (repeatTime
            ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) // tremolo
            : 1) *
          (shape > 4 ? s : sign(s) * abs(s) ** shapeCurve) * // shape curve
          (i < attack
            ? i / attack // attack
            : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume) // decay falloff
            : i < attack + decay + sustain
            ? sustainVolume // sustain volume
            : i < length - delay
            ? ((length - i - delay) / release) * sustainVolume // release falloff
            : 0); // post release

        s = delay
          ? s / 2 +
            (delay > i
              ? 0
              : (i < length - delay ? 1 : (length - i) / delay) *
                (b[(i - delay) | 0] / 2 / volume))
          : s; // sample delay

        if (filter) {
          // apply filter
          s = y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
        }
      }

      f = (frequency += slide += deltaSlide) * Math.cos(modulation * modOffset++); // frequency
      t += f + f * noise * Math.sin(i ** 5); // noise

      if (jump && ++jump > pitchJumpTime) {
        // pitch jump
        frequency += pitchJump; // apply pitch jump
        startFrequency += pitchJump; // also apply to start
        jump = 0; // stop pitch jump time
      }

      if (repeatTime && !(++repeat % repeatTime)) {
        // repeat
        frequency = startFrequency; // reset frequency
        slide = startSlide; // reset slide
        jump ||= 1; // reset pitch jump time
      }
    }

    // copy samples to buffer and play
    const buffer = zzfxX.createBuffer(1, b.length, sampleRate);
    buffer.getChannelData(0).set(b);
    source.buffer = buffer;
    source.connect(zzfxX.destination);
    source.start();
    return source;
  } catch (e) {
    console.warn("ZzFX Error:", e);
    return null;
  }
};

/**
 * Helper to play ZzFX using an array of parameters
 */
export const zzfxP = (...p: any[]) => zzfx(...(p as any));
