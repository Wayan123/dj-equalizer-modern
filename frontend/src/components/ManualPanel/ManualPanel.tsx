import React from 'react';

interface Section {
  title: string;
  content: string[];
}

const sections: Section[] = [
  {
    title: '1. Loading Audio',
    content: [
      'Drag and drop: drop an audio or video file into the Input Zone.',
      'Supported formats: MP3, WAV, OGG, FLAC, AAC, M4A, WebM, MP4, MKV, AVI, MOV, FLV, 3GP, and AMR.',
      'Maximum file size: 500 MB.',
      'YouTube: paste a YouTube URL, then click LOAD or press Enter.',
      'YouTube audio is streamed through the backend proxy to bypass browser CORS limits.',
      'Playlist: save tracks into the local SQLite database. PLAY ALL starts the stored queue.',
      'Search: search YouTube by title, then use PLAY ALL SEARCH to queue every result.',
      'Video preview: local MP4, WebM, and MKV files appear in the sidebar preview.',
    ],
  },
  {
    title: '2. 10-Band Equalizer',
    content: [
      'Ten vertical sliders control the bands from 31 Hz to 16 kHz.',
      'Gain range: -12 dB to +12 dB.',
      'Band layout: 31 Hz, 62 Hz, 125 Hz, 250 Hz, 500 Hz, 1 kHz, 2 kHz, 4 kHz, 8 kHz, and 16 kHz.',
      'Each band uses a BiquadFilterNode: lowshelf at 31 Hz, highshelf at 16 kHz, and peaking filters for the middle bands.',
      'Snap mode rounds EQ changes to 2 dB steps.',
      'Double-click any slider to reset it to 0 dB.',
      'All band moves use a 50 ms linear ramp to avoid zipper noise.',
    ],
  },
  {
    title: '3. Audio Enhancer',
    content: [
      'Input Gain controls the pre-EQ signal level.',
      'Noise Gate reduces content below the RMS threshold.',
      'Compressor manages the dynamic range with threshold, ratio, attack, and release controls.',
      'Limiter acts as the final safety ceiling and prevents clipping.',
      'Exciter adds harmonic brightness with a soft-clip wave shaper and dry/wet mix.',
      'Stereo Width uses mid/side processing to narrow or widen the stereo image.',
      'Meters report RMS, Peak, LUFS, Gain Reduction, and Stereo Width in real time.',
    ],
  },
  {
    title: '4. DJ FX',
    content: [
      'Bass boost adds low-shelf energy without raising the entire spectrum.',
      'Sweep switches between low-pass, high-pass, and notch filter modes.',
      'Q controls the resonance around the sweep cutoff.',
      'Drive adds soft saturation with a wet/dry blend.',
      'Echo controls delay time, wet amount, and feedback amount.',
      'Reverb uses a convolution response with tone damping.',
      'Pan moves the track from left to right.',
      'Auto Pan adds LFO motion on top of the manual pan position.',
      'Pitch changes playback speed from 0.25x to 4.0x.',
      'RESET FX restores only the FX rack and leaves EQ and enhancer settings untouched.',
    ],
  },
  {
    title: '5. Visualization Modes',
    content: [
      'FFT shows a real-time frequency spectrum.',
      'WAVE draws an oscilloscope-style waveform.',
      'RADIAL renders the spectrum in a circular layout.',
      'PARTICLE spawns reactive particles based on audio energy.',
      'STEREO compares left and right channel energy side by side.',
      'SPECTRO displays a scrolling spectrogram heatmap.',
      'VU shows stereo level meters with peak and decay behavior.',
    ],
  },
  {
    title: '6. Preset Manager',
    content: [
      'DSP presets include Music, Movie, Voice Clarity, Podcast, Bass Boost, and Night Mode.',
      'Each DSP preset stores EQ, compressor, limiter, exciter, width, gate, and input settings.',
      'Custom presets can be saved into localStorage.',
      'Use SAVE to store the current preset, EXPORT to download JSON, and IMPORT to restore a preset file.',
      'Delete removes a custom preset from local storage.',
      'EQ-only presets include Flat, Bass Boost, Treble Boost, Vocal, Rock, Electronic, and Jazz.',
      'The top-bar PRESET menu lists DSP, EQ, and custom presets together.',
    ],
  },
  {
    title: '7. Audio Player',
    content: [
      'Play and pause are tied to the shared AudioContext and auto-resume when needed.',
      'Repeat loops the current track.',
      'The seek bar jumps to any point in the current track.',
      'Volume controls the master output from 0% to 100%.',
      'The queue advances automatically after the current track ends.',
    ],
  },
  {
    title: '8. Top Bar and Navigation',
    content: [
      'Main tabs: EQ, ENHANCER, FX, VISUALIZER, and PRESETS.',
      'Utility tabs: MANUAL, FFT, and SETTINGS.',
      'SNAP toggles 2 dB snapping for the EQ.',
      'PRESET opens the combined preset dropdown.',
      'SAVE and RESET manage the current EQ state.',
      'The status strip shows RMS, LUFS, Gain Reduction, Latency, Buffer Size, and DAC status.',
    ],
  },
  {
    title: '9. DSP Pipeline',
    content: [
      'Signal flow: Source -> Input Gain -> Noise Gate -> EQ -> Compressor -> Limiter -> Exciter -> Stereo Widener -> Bass Boost -> Sweep Filter -> Drive -> Echo -> Reverb -> Pan -> Analyser -> Master Gain -> Destination.',
      'Input Gain and Noise Gate are the first control stage before spectral shaping.',
      'The compressor and limiter keep the track under control before enhancement and effects.',
      'The analyser feeds both the visualization canvas and the output meters.',
      'Every animated parameter change uses a 50 ms linear ramp to reduce clicks and zipper noise.',
    ],
  },
  {
    title: '10. Settings',
    content: [
      'UI theme options include Original, Neon Cyan, Neon Magenta, Neon Green, Gold, Retro Amber, and Ultra Violet.',
      'Visualizer variants include Standard, Dense, Outline, Filled, and Glow Only.',
      'Settings also surface runtime status and desktop-specific audio options.',
    ],
  },
  {
    title: '11. Tips and Troubleshooting',
    content: [
      'Chrome or Edge gives the best Web Audio API performance.',
      'Close other tabs that are using audio to reduce latency.',
      'If YouTube fails, update yt-dlp, try another video, or restart the backend.',
      'If FPS drops, shrink the window, switch to VU or WAVE mode, or close other heavy tabs.',
      'If there is no sound, check DAC status, volume level, and whether the page has been clicked.',
      'Custom presets persist in localStorage and survive refreshes.',
      'The default backend runs on port 8800 and the frontend on port 5173.',
    ],
  },
];

export const ManualPanel: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-lg sm:text-xl font-mono font-bold text-neon-cyan neon-text mb-1">
          User Manual
        </h2>
        <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-5 tracking-wide">
          MODERN AUDIO ENHANCER - High-Performance DSP System v3.0.0-PRO
        </p>

        <div className="grid gap-4 sm:gap-5">
          {sections.map((section) => (
            <div key={section.title} className="bg-dark-800/60 rounded-lg p-3 sm:p-4 border border-dark-500/30 hover:border-dark-500/50 transition-colors">
              <h3 className="text-sm sm:text-base font-mono font-semibold text-neon-green neon-text-green mb-2 flex items-center gap-2">
                <span className="inline-block w-1 h-4 bg-neon-green/60 rounded-full" />
                {section.title}
              </h3>
              <ul className="space-y-1.5">
                {section.content.map((item, i) => (
                  <li key={i} className="text-[11px] sm:text-xs font-mono text-gray-300 leading-relaxed bg-dark-900/30 rounded px-2 py-1 border-l-2 border-neon-cyan/30">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
