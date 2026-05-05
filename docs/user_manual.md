# User Manual — Modern Audio Enhancer

## Getting Started

1. Start the application: `./scripts/dev.sh`
2. Open http://localhost:5173 in your browser (Chrome/Edge recommended)
3. The dashboard loads with "LOAD AUDIO TO ACTIVATE" displayed

## Loading Audio

### Local File

- **Drag & Drop**: Drag an audio/video file onto the "DROP MEDIA/MUSIC" zone
- **Click to Browse**: Click the drop zone to open a file picker
- Maximum file size: 500MB

**Supported formats**: MP3, WAV, OGG, FLAC, AAC, M4A, WebM, MP4, MKV, AVI, MOV, FLV, 3GP, AMR

### YouTube

1. Paste a YouTube URL into the "YOUTUBE URL" input field
2. Click "LOAD" or press Enter
3. The backend extracts the audio stream (may take 5-15 seconds)
4. Playback begins automatically

**Supported URL formats**:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- URLs with `?si=` sharing parameters are supported

## Top Bar

- **MODERN AUDIO ENHANCER**: Application title
- **WORKSPACE / MANUAL**: Tab switcher - MANUAL shows the full English usage guide
- **SNAP ON/OFF**: When ON, EQ sliders snap to 2dB increments
- **PRESET**: Dropdown with 7 EQ presets (Flat, Bass Boost, Treble Boost, Vocal, Rock, Electronic, Jazz)
- **SAVE**: Save current EQ values as a custom preset (stored in localStorage)
- **RESET**: Reset all EQ bands to 0dB
- **LATENCY**: Current audio processing latency in milliseconds
- **BUFFER**: FFT buffer size (2048)
- **DAC**: Audio output status (ACTIVE/OFF)

## Visualization Panel

Click any mode button to switch:

| Mode | Description |
|------|-------------|
| **FFT** | Vertical bar spectrum (default) |
| **WAVE** | Oscilloscope waveform |
| **RADIAL** | Circular spectrum radiating from center |
| **PARTICLE** | Reactive particles that spawn with audio energy |
| **STEREO** | Left/Right channel split bars |
| **SPECTRO** | Scrolling frequency heatmap |
| **VU** | Stereo VU level meters with dB scale |

FPS counter displayed in top-left corner of canvas.

## Equalizer

10 vertical sliders controlling frequency bands:

| Band | Frequency |
|------|-----------|
| 1 | 31 Hz |
| 2 | 62 Hz |
| 3 | 125 Hz |
| 4 | 250 Hz |
| 5 | 500 Hz |
| 6 | 1 kHz |
| 7 | 2 kHz |
| 8 | 4 kHz |
| 9 | 8 kHz |
| 10 | 16 kHz |

- **Drag** slider up/down to adjust gain (-12dB to +12dB)
- **Double-click** a slider to reset it to 0dB
- Green values = positive gain, Magenta = negative, Gray = 0
- With SNAP ON, values snap to 2dB increments

## DJ FX Panel

Compact rack controls:

| Knob | Range | Effect |
|------|-------|--------|
| **BASS** | 0-100 | Low-end lowshelf boost |
| **SWEEP** | 0-100 | Filter cutoff for LP/HP/Notch modes |
| **Q** | 0.2-12 | Filter resonance |
| **DRIVE** | 0-100 | Soft saturation wet/dry |
| **REVERB / TONE** | 0-100 | Reverb amount and high-frequency damping |
| **ECHO / TIME / FDBK** | 0-100 | Delay wet level, delay time, feedback |
| **PAN** | 0–100 | Stereo pan (L←→R) |
| **AUTO / RATE** | 0-100 / 0.1-8Hz | Auto-pan depth and LFO rate |
| **PITCH** | 0.25–4.0 | Playback speed multiplier |

- **Drag up/down** on knob to adjust
- **Double-click** to reset to default
- **RESET FX** resets only FX parameters
- Quick presets: Clean, Club Filter, Echo Wash, Wide Motion, Drive Lift, Space Build
- **FX CPU** bar shows estimated processing load

## Audio Player

Bottom bar with transport controls:

- **▶/⏸**: Play/Pause toggle
- **⟳**: Repeat/Loop toggle — when active (green), track loops automatically
- **Seek bar**: Click/drag to seek through track
- **Time display**: Current time / total duration
- **Track info**: Title and status (hidden on small screens)
- **VOL slider**: Master volume (0–100%)

## Tips

- Use Chrome or Edge for the best Web Audio API performance.
- Close other audio-using tabs to reduce latency.
- If YouTube extraction fails, update yt-dlp: `pip install -U yt-dlp`.
- Spectrogram mode scrolls continuously and is best for analyzing frequency content over time.
- Particle mode is most visually impressive with bass-heavy music.
- Video files (MP4, WebM, MKV) are supported and the audio track is extracted automatically.
- The layout auto-adjusts to screen size and works well on smaller monitors.
