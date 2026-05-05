import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Equation {
  latex: string;
  variables?: { name: string; desc: string }[];
}

interface TechSection {
  title: string;
  description: string;
  equations: Equation[];
  notes?: string[];
}

function renderMath(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      trust: true,
    });
  } catch {
    return `<code>${latex}</code>`;
  }
}

const sections: TechSection[] = [
  {
    title: '1. Fast Fourier Transform (FFT)',
    description: 'FFT converts a signal from the time domain into the frequency domain. The Cooley-Tukey radix-2 algorithm recursively splits an N-point DFT into two N/2-point DFTs.',
    equations: [
      {
        latex: 'X[k] = \\sum_{n=0}^{N-1} x[n] \\cdot e^{-j\\frac{2\\pi kn}{N}}',
        variables: [
          { name: 'X[k]', desc: 'the k-th frequency component' },
          { name: 'x[n]', desc: 'the n-th time sample' },
          { name: 'N', desc: 'number of samples' },
          { name: 'k', desc: 'frequency index' },
        ],
      },
      {
        latex: 'X[k] = E[k] + e^{-j\\frac{2\\pi k}{N}} \\cdot O[k]',
        variables: [
          { name: 'E[k]', desc: 'DFT of even samples' },
          { name: 'O[k]', desc: 'DFT of odd samples' },
        ],
      },
      {
        latex: '\\Delta f = \\frac{f_s}{N}',
        variables: [
          { name: '\\Delta f', desc: 'bin width, about 21.5 Hz at f_s=44100 Hz and N=2048' },
          { name: 'f_s', desc: 'sample rate' },
        ],
      },
      {
        latex: 'y = 20 \\cdot \\log_{10}\\!\\left(\\frac{|X[k]|}{|X_{\\max}|}\\right)',
        variables: [
          { name: 'y', desc: 'relative magnitude in dB (0-255 scale)' },
        ],
      },
      {
        latex: 's[k] = \\alpha \\cdot x[k] + (1 - \\alpha) \\cdot s[k-1]',
        variables: [
          { name: '\\alpha', desc: 'smoothingTimeConstant = 0.8' },
          { name: 's[k]', desc: 'smoothed output value' },
        ],
      },
    ],
    notes: [
      'Complexity: O(N log2 N) versus O(N^2) for a direct DFT.',
      'AnalyserNode fftSize = 2048, which produces frequencyBinCount = 1024 bins.',
      'getByteFrequencyData() returns a Uint8Array(1024) with values from 0 to 255.',
    ],
  },
  {
    title: '2. Biquad Filter (EQ Bands)',
    description: 'Each EQ band uses a BiquadFilterNode with a transfer function in the z-domain.',
    equations: [
      {
        latex: 'H(z) = \\frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}',
        variables: [
          { name: 'b_0, b_1, b_2', desc: 'numerator coefficients' },
          { name: 'a_1, a_2', desc: 'denominator coefficients' },
        ],
      },
      {
        latex: 'H_{\\text{lowshelf}}(s) = A \\cdot \\frac{s^2 + \\frac{\\sqrt{A}}{Q} s + A}{A \\cdot s^2 + \\frac{\\sqrt{A}}{Q} s + 1}',
        variables: [
          { name: 'A', desc: '= 10^{\\text{gain}/40}' },
          { name: 'Q', desc: 'quality factor = 1.4' },
        ],
      },
      {
        latex: 'H_{\\text{peaking}}(s) = \\frac{1 + \\frac{A}{Q} s + s^2}{1 + \\frac{1}{AQ} s + s^2}',
        variables: [
          { name: 'A', desc: '= 10^{\\text{gain}/40}' },
          { name: 'Q', desc: 'quality factor = 1.4' },
        ],
      },
      {
        latex: 'H_{\\text{highshelf}}(s) = A \\cdot \\frac{A s^2 + \\frac{\\sqrt{A}}{Q} s + 1}{s^2 + \\frac{\\sqrt{A}}{Q} s + A}',
        variables: [
          { name: 'A', desc: '= 10^{\\text{gain}/40}' },
          { name: 'Q', desc: 'quality factor = 1.4' },
        ],
      },
      {
        latex: '\\text{BW} = \\frac{f_c}{Q}',
        variables: [
          { name: '\\text{BW}', desc: '-3 dB bandwidth' },
          { name: 'f_c', desc: 'center frequency' },
        ],
      },
    ],
    notes: [
      'Gain transitions use linearRampToValueAtTime(target, t + 50 ms) to avoid zipper noise.',
    ],
  },
  {
    title: '3. Convolution Reverb',
    description: 'Reverb uses a ConvolverNode to convolve the input signal with an impulse response (IR).',
    equations: [
      {
        latex: 'y[n] = (x * h)[n] = \\sum_{k=0}^{M-1} h[k] \\cdot x[n-k]',
        variables: [
          { name: 'h[k]', desc: 'impulse response (IR)' },
          { name: 'x[n]', desc: 'input signal' },
          { name: 'M', desc: 'length of the impulse response' },
        ],
      },
      {
        latex: 'h[k] = \\text{rand}(-1,\\,1) \\cdot \\left(1 - \\frac{k}{M}\\right)^{\\text{decay}}, \\quad \\text{decay} = 2',
        variables: [
          { name: 'h[k]', desc: 'synthetic impulse response' },
          { name: '\\text{decay}', desc: 'decay exponent = 2.0' },
        ],
      },
      {
        latex: 'Y(f) = X(f) \\cdot H(f)',
        variables: [
          { name: 'Y(f)', desc: 'frequency-domain output' },
          { name: 'X(f)', desc: 'FFT of the input signal' },
          { name: 'H(f)', desc: 'FFT of the impulse response' },
        ],
      },
      {
        latex: '\\text{Out} = \\left(1 - \\frac{\\text{wet}}{2}\\right) \\cdot \\text{Dry} + \\text{wet} \\cdot \\text{Wet}',
        variables: [
          { name: '\\text{wet}', desc: 'wet/dry mix, 0 to 1' },
        ],
      },
    ],
  },
  {
    title: '4. Delay / Echo',
    description: 'Echo uses a DelayNode with a feedback loop. The signal is delayed and fed back recursively.',
    equations: [
      {
        latex: 'y[n] = x[n] + \\beta \\cdot y[n - D]',
        variables: [
          { name: 'D', desc: 'delay time in samples' },
          { name: '\\beta', desc: 'feedback gain, 0 to 0.6' },
        ],
      },
      {
        latex: 't_{\\text{delay}} = \\frac{\\text{value}}{100} \\times 0.8 \\;\\text{s}',
        variables: [
          { name: 't_{\\text{delay}}', desc: '0 ms to 800 ms' },
        ],
      },
      {
        latex: '\\beta = \\frac{\\text{value}}{100} \\times 0.6',
        variables: [
          { name: '\\beta', desc: '0% to 60% feedback' },
        ],
      },
      {
        latex: '\\text{buffer} = f_s \\times t_{\\text{delay}}',
        variables: [
          { name: 'f_s', desc: 'sample rate, 44100 Hz' },
        ],
      },
    ],
    notes: [
      'Beta must stay below 1 to keep the feedback loop bounded.',
      'At beta = 0.6, each echo is 60% of the previous one and several repeats remain audible.',
      'DelayNode maxDelayTime = 2.0 s, implemented with a circular buffer.',
      'The wet and dry paths remain parallel, so the dry signal stays intact.',
    ],
  },
  {
    title: '5. Low-Pass Filter (Sweep)',
    description: 'Sweep uses a BiquadFilterNode in lowpass mode. It passes frequencies below the cutoff and attenuates frequencies above it.',
    equations: [
      {
        latex: 'H(s) = \\frac{1}{s^2 + \\frac{s}{Q} + 1}',
        variables: [
          { name: 'Q', desc: 'quality factor = 1.0 (warm resonance)' },
        ],
      },
      {
        latex: 'f_c = 200 \\times \\left(\\frac{20000}{200}\\right)^{\\frac{\\text{value}}{100}}',
        variables: [
          { name: 'f_c', desc: 'cutoff frequency on a logarithmic scale' },
          { name: '\\text{value}', desc: '0 to 100, where 0 -> 200 Hz and 100 -> 20 kHz' },
        ],
      },
      {
        latex: '|H(f)|^2 = \\frac{1}{1 + \\left(\\frac{f}{f_c}\\right)^{2n}}, \\quad n = 1',
        variables: [
          { name: 'n', desc: 'filter order, n=1 gives a second-order slope at -12 dB/octave' },
          { name: 'f = f_c', desc: '|H| = -3 dB half-power point' },
        ],
      },
    ],
    notes: [
      'The logarithmic sweep matches human pitch perception better than a linear ramp.',
      'Q > 3 produces a stronger resonance peak near the cutoff.',
      'Q < 0.7 creates a gentler roll-off.',
    ],
  },
  {
    title: '6. Stereo Panning (Equal-Power)',
    description: 'Pan uses StereoPannerNode with an equal-power panning law so the volume does not dip when the image moves to center.',
    equations: [
      {
        latex: 'L = \\cos(\\theta), \\quad R = \\sin(\\theta), \\quad \\theta = (\\text{pan}+1) \\times \\frac{\\pi}{4}',
        variables: [
          { name: '\\text{pan}', desc: '-1 for left and +1 for right' },
          { name: '\\theta', desc: 'panning angle' },
        ],
      },
      {
        latex: '\\text{pan} = -1 \\Rightarrow \\theta = 0 \\Rightarrow L=1,\\; R=0',
        variables: [],
      },
      {
        latex: '\\text{pan} = 0 \\Rightarrow \\theta = \\frac{\\pi}{4} \\Rightarrow L = \\cos 45° = \\frac{1}{\\sqrt{2}},\\; R = \\sin 45° = \\frac{1}{\\sqrt{2}}',
        variables: [],
      },
      {
        latex: '\\text{pan} = +1 \\Rightarrow \\theta = \\frac{\\pi}{2} \\Rightarrow L=0,\\; R=1',
        variables: [],
      },
      {
        latex: 'L^2 + R^2 = \\cos^2\\theta + \\sin^2\\theta = 1 \\quad \\text{(total power stays consistent)}',
        variables: [],
      },
    ],
    notes: [
      'Value mapping: pan = (value/50) - 1, so 0 to 100 maps to -1 to +1.',
    ],
  },
  {
    title: '7. Spectrogram (STFT)',
    description: 'The spectrogram shows how frequency content evolves over time. Color encodes magnitude: cyan for low values, then green, yellow, and magenta for higher values.',
    equations: [
      {
        latex: 'S[n,k] = \\left| \\text{STFT}\\{x\\}[n,k] \\right|^2',
        variables: [
          { name: 'S[n,k]', desc: 'spectrogram power at time n and frequency k' },
        ],
      },
      {
        latex: '\\text{STFT}\\{x\\}[n,k] = \\sum_{m=0}^{N-1} x[n+m] \\cdot w[m] \\cdot e^{-j\\frac{2\\pi k m}{N}}',
        variables: [
          { name: 'w[m]', desc: 'window function, Hanning by default' },
          { name: 'N', desc: 'FFT size = 2048' },
        ],
      },
      {
        latex: '\\Delta f = \\frac{f_s}{N}, \\quad \\Delta t = \\frac{N}{f_s}',
        variables: [
          { name: '\\Delta f', desc: 'frequency resolution, about 21.5 Hz' },
          { name: '\\Delta t', desc: 'time resolution, about 46.4 ms' },
        ],
      },
    ],
    notes: [
      'The drawImage shift approach is O(1) per frame, much faster than moving pixels individually.',
      'The color lookup table is precomputed as 256 x 3 bytes at startup.',
      'An offscreen canvas is used for double-buffering and efficient column shifting.',
    ],
  },
  {
    title: '8. VU Multi-Band Meter',
    description: 'The VU meter displays 48 frequency bands in two rows, simulating left and right channels with peak hold and dB calculation.',
    equations: [
      {
        latex: '\\text{level}[b] = \\frac{1}{N_b} \\sum_{i \\in \\text{band}[b]} \\text{frequencyData}[i]',
        variables: [
          { name: 'N_b', desc: 'number of bins per band, about 21' },
          { name: 'b', desc: 'band index, 0 to 47' },
        ],
      },
      {
        latex: '\\text{smooth}[b] = \\max\\!\\left(\\text{level}[b],\\; \\text{smooth}[b] \\times 0.88\\right)',
        variables: [
          { name: '0.88', desc: 'decay factor, about 133 ms at 60 fps' },
        ],
      },
      {
        latex: '\\text{dB} = 20 \\cdot \\log_{10}\\!\\left(\\max(\\text{level},\\; 0.001)\\right)',
        variables: [
          { name: '\\text{dB}', desc: 'level in dBFS' },
          { name: '-20\\,\\text{dB}', desc: '10% of maximum' },
          { name: '-40\\,\\text{dB}', desc: '1% of maximum' },
        ],
      },
    ],
    notes: [
      'Peak hold lasts about 30 frames, or roughly 500 ms, before decay starts.',
      'Color coding: green under 50%, yellow between 50% and 75%, red above 75%.',
      'Red approaches digital clipping near 0 dBFS.',
    ],
  },
  {
    title: '9. Dynamic Compressor',
    description: 'The compressor reduces dynamic range: loud signals are pushed down while quiet signals stay closer to their original level. It uses the Web Audio DynamicsCompressorNode.',
    equations: [
      {
        latex: 'y[n] = \\begin{cases} x[n] & \\text{if } x[n] < T \\\\ T + \\frac{x[n] - T}{R} & \\text{if } x[n] \\geq T \\end{cases}',
        variables: [
          { name: 'T', desc: 'threshold in dB' },
          { name: 'R', desc: 'ratio, from 1:1 to 20:1' },
        ],
      },
      {
        latex: 'G_{\\text{attack}} = e^{-1/(\\tau_a \\cdot f_s)}, \\quad G_{\\text{release}} = e^{-1/(\\tau_r \\cdot f_s)}',
        variables: [
          { name: '\\tau_a', desc: 'attack time constant, 0 to 500 ms' },
          { name: '\\tau_r', desc: 'release time constant, 10 to 1000 ms' },
        ],
      },
      {
        latex: '\\text{GR}(t) = T - 20\\log_{10}\\!\\left(\\frac{|y(t)|}{|x(t)|}\\right)',
        variables: [
          { name: '\\text{GR}', desc: 'gain reduction in dB, shown on the meter' },
        ],
      },
    ],
    notes: [
      'The limiter is a dedicated compressor with ratio=20, attack=1 ms, and a hard ceiling.',
      'A 6 dB soft knee smooths the transition around the threshold.',
    ],
  },
  {
    title: '10. Harmonic Exciter (WaveShaper)',
    description: 'The exciter adds harmonics using a WaveShaperNode with a soft-clip curve. Those extra harmonics add brightness and presence.',
    equations: [
      {
        latex: 'y = x + \\frac{3}{4} \\cdot \\alpha \\cdot x^3',
        variables: [
          { name: '\\alpha', desc: 'drive amount, from 0 to 1' },
          { name: 'x', desc: 'normalized input signal in [-1, 1]' },
        ],
      },
      {
        latex: '\\text{Out} = (1 - w) \\cdot x_{\\text{dry}} + w \\cdot y_{\\text{shaped}}',
        variables: [
          { name: 'w', desc: 'wet/dry mix, equal to exciter/100' },
        ],
      },
    ],
    notes: [
      'The cubic soft-clip curve introduces odd harmonics such as the 3rd, 5th, and 7th.',
      'Dry and wet signals are routed in parallel so the original tone remains available.',
    ],
  },
  {
    title: '11. Stereo Widener (Mid/Side Processing)',
    description: 'Stereo widening uses Mid/Side processing. Side-channel gain controls the width of the stereo image.',
    equations: [
      {
        latex: 'M = \\frac{L + R}{2}, \\quad S = \\frac{L - R}{2}',
        variables: [
          { name: 'M', desc: 'mid signal, or mono center' },
          { name: 'S', desc: 'side signal, or stereo difference' },
        ],
      },
      {
        latex: "S' = S \\cdot g_s, \\quad g_s = \\frac{\\text{width}}{50}",
        variables: [
          { name: 'g_s', desc: 'side gain, where 0 = mono, 1 = normal, and 2 = extra wide' },
          { name: '\\text{width}', desc: 'knob value from 0 to 100' },
        ],
      },
      {
        latex: "L' = M + S', \\quad R' = M - S'",
        variables: [
          { name: "L'", desc: 'left output' },
          { name: "R'", desc: 'right output' },
        ],
      },
      {
        latex: '\\text{StereoWidth} = \\frac{|S|}{|M|} \\times 100\\%',
        variables: [
          { name: '\\text{StereoWidth}', desc: 'real-time stereo width meter, in percent' },
        ],
      },
    ],
    notes: [
      'width=0 gives g_s=0, so S\'=0 and the output becomes mono.',
      'width=50 gives g_s=1, which is normal stereo.',
      'width=100 gives g_s=2, which makes the sides twice as loud.',
    ],
  },
  {
    title: '12. Audio Metering (RMS, LUFS, Peak)',
    description: 'Real-time metering measures the audio level. RMS is root mean square, LUFS is loudness unit full scale, and Peak is the maximum sample value.',
    equations: [
      {
        latex: '\\text{RMS} = \\sqrt{\\frac{1}{N} \\sum_{i=0}^{N-1} x[i]^2}',
        variables: [
          { name: 'N', desc: 'samples per frame, usually fftSize' },
          { name: 'x[i]', desc: 'sample amplitude' },
        ],
      },
      {
        latex: '\\text{RMS}_{\\text{dB}} = 20 \\cdot \\log_{10}\\!\\left(\\frac{\\text{RMS}}{1.0}\\right)',
        variables: [
          { name: '\\text{RMS}_{\\text{dB}}', desc: 'RMS in dBFS, where 0 equals full scale' },
        ],
      },
      {
        latex: '\\text{LUFS} \\approx \\text{RMS}_{\\text{dB}} - 0.691',
        variables: [
          { name: '\\text{LUFS}', desc: 'approximate loudness, using a simplified K-weighting model' },
        ],
      },
      {
        latex: '\\text{Peak}_{\\text{dB}} = 20 \\cdot \\log_{10}\\!\\left(\\max_{i}|x[i]|\\right)',
        variables: [
          { name: '\\text{Peak}_{\\text{dB}}', desc: 'peak level in dBFS' },
        ],
      },
    ],
    notes: [
      'Meter updates run at 4 Hz, or once every 250 ms.',
      'RMS and LUFS use float time-domain data for higher precision.',
      'Gain reduction is read from the compressor.reduction property.',
    ],
  },
  {
    title: '13. Web Audio API Architecture',
    description: 'AudioContext is the entry point to the Web Audio API. It creates and manages the audio processing graph.',
    equations: [
      {
        latex: 'f_s \\in \\{44100,\\; 48000\\} \\;\\text{Hz}',
        variables: [
          { name: 'f_s', desc: 'sample rate, depending on the audio hardware' },
        ],
      },
      {
        latex: '\\text{frequencyBinCount} = \\frac{\\text{fftSize}}{2} = \\frac{2048}{2} = 1024',
        variables: [
          { name: '\\text{fftSize}', desc: 'must be a power of two, here 2^{11}' },
        ],
      },
      {
        latex: '\\text{gain}(t) = \\text{gain}(t_0) + \\frac{\\text{target} - \\text{gain}(t_0)}{t_1 - t_0} \\cdot (t - t_0)',
        variables: [
          { name: 't_0', desc: 'start time for the ramp' },
          { name: 't_1', desc: 'end time for the ramp, or t_0 + 50 ms' },
        ],
      },
    ],
    notes: [
      'MediaElementAudioSourceNode can only be created once for a given HTMLAudioElement.',
      'getByteFrequencyData() returns a Uint8Array(1024) with log-scaled dB values from 0 to 255.',
      'getByteTimeDomainData() returns a Uint8Array(1024), where 128 represents silence.',
      'ConvolverNode computes the convolution through FFT, multiply, and inverse FFT.',
      'DelayNode uses a circular buffer and supports up to 2 seconds of delay.',
    ],
  },
  {
    title: '14. Canvas Rendering and DPR Scaling',
    description: 'The canvas uses the Device Pixel Ratio (DPR) so the visualization stays sharp on HiDPI screens.',
    equations: [
      {
        latex: 'w_{\\text{phys}} = w_{\\text{css}} \\times \\text{DPR}',
        variables: [
          { name: 'w_{\\text{phys}}', desc: 'canvas.width in physical pixels' },
          { name: 'w_{\\text{css}}', desc: 'canvas.style.width in CSS pixels' },
          { name: '\\text{DPR}', desc: 'window.devicePixelRatio, such as 1x, 2x, or 3x' },
        ],
      },
      {
        latex: '\\text{ctx.setTransform}(\\text{DPR},\\; 0,\\; 0,\\; \\text{DPR},\\; 0,\\; 0)',
        variables: [
          { name: '\\text{DPR}', desc: 'all drawing coordinates stay in CSS pixels' },
        ],
      },
    ],
    notes: [
      'The render loop is driven by requestAnimationFrame and targets 60 fps.',
      'ResizeObserver keeps the canvas sized correctly without polling.',
      'The spectrogram path uses an offscreen canvas for double-buffering and fast shifting.',
    ],
  },
];

const FFTPanel: React.FC = () => {
  const renderedSections = useMemo(() =>
    sections.map((section) => ({
      ...section,
      renderedEquations: section.equations.map((eq) => ({
        ...eq,
        html: renderMath(eq.latex, true),
        renderedVars: eq.variables?.map((v) => ({
          ...v,
          nameHtml: renderMath(v.name, false),
        })),
      })),
    })),
  []);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
      <h2 className="text-lg sm:text-xl font-mono font-bold text-neon-magenta neon-text-magenta mb-4">
        Theory and Technical Equations
      </h2>
      <div className="grid gap-4 sm:gap-5">
        {renderedSections.map((section) => (
          <div key={section.title} className="bg-dark-800/60 rounded-lg p-3 sm:p-4 border border-dark-500/30">
            <h3 className="text-sm sm:text-base font-mono font-semibold text-neon-cyan mb-2">
              {section.title}
            </h3>
            <p className="text-[11px] sm:text-xs font-mono text-gray-400 mb-3 leading-relaxed">
              {section.description}
            </p>

            {section.renderedEquations.map((eq, i) => (
              <div key={i} className="mb-3">
                <div
                  className="overflow-x-auto py-2 px-1 bg-dark-900/40 rounded border border-dark-500/20"
                  dangerouslySetInnerHTML={{ __html: eq.html }}
                />
                {eq.renderedVars && eq.renderedVars.length > 0 && (
                  <ul className="mt-1.5 ml-2 space-y-0.5">
                    {eq.renderedVars.map((v, j) => (
                      <li key={j} className="text-[10px] sm:text-[11px] font-mono text-gray-400 flex items-start gap-1.5">
                        <span className="text-gray-500">•</span>
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          <span dangerouslySetInnerHTML={{ __html: v.nameHtml }} />
                          <span className="text-gray-500">=</span>
                          <span>{v.desc}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {section.notes && section.notes.length > 0 && (
              <ul className="mt-2 space-y-0.5 border-t border-dark-500/20 pt-2">
                {section.notes.map((note, i) => (
                  <li key={i} className="text-[10px] sm:text-[11px] font-mono text-gray-500 leading-relaxed">
                    • {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export { FFTPanel };
