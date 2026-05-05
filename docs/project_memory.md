# Project Memory — Modern Audio Enhancer

## Iteration: 1
## Date: 2026-04-19

## Original Prompt Summary

Build a Modern DJ Equalizer Dashboard with:
- Real-time FFT spectrum visualization (7 modes)
- 10-band equalizer (31Hz–16kHz)
- DJ FX control panel (6 knob controls)
- Audio playback system with YouTube support
- Neon-style UI with 60 FPS target
- Full directory structure: frontend/, backend/, services/, docs/, configs/, scripts/, tests/
- WSL2 + conda info-ai environment

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | React 18 + Vite + TS | Fast HMR, type safety |
| Visualization | Canvas 2D | Sufficient for 2D, simpler than WebGL |
| Audio processing | Web Audio API | Zero-latency, browser-native |
| State management | Zustand | Lightweight, minimal boilerplate |
| Backend | FastAPI + yt-dlp | Async, auto-docs, reliable YouTube extraction |
| Styling | TailwindCSS | Utility-first, neon theme via custom config |

## Audio Pipeline

Source → EQ(10× BiquadFilter) → BassBoost(Gain) → Sweep(BiquadFilter LP) → Echo(Delay+Feedback) → Reverb(Convolver+wet/dry) → Pan(StereoPanner) → Analyser → MasterGain → Destination

## Key Implementation Notes

- All audio parameter changes use `linearRampToValueAtTime(50ms)` to prevent clicks
- Particle mode capped at 300 particles for FPS stability
- Spectrogram uses `ImageData` direct pixel manipulation
- VU meters use 0.92 exponential decay for smooth animation
- Canvas resized via ResizeObserver + devicePixelRatio scaling
- YouTube URL validated on both frontend and backend
- Rate limited to 5 req/min on YouTube endpoint
- File uploads validated for MIME type + size (100MB max)

## Performance Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| Visualization FPS | ≥ 60 | TBD (needs testing) |
| Audio latency | < 10ms | TBD |
| UI response | < 16ms | TBD |
| Memory steady state | < 200MB | TBD |

## Known Issues / TODO

- [ ] Test and verify FPS under load
- [ ] Add touch support for mobile (knob/slider fallback)
- [ ] Implement MANUAL tab content
- [ ] Add WebSocket for real-time backend metrics
- [ ] Add more EQ presets from community
- [ ] Implement preset import/export
- [ ] Add keyboard shortcuts (space=play/pause, etc.)

## Self-Critique

1. **Bottleneck**: Particle mode with >300 particles may drop FPS on low-end hardware
2. **UX flaw**: Knob controls difficult on mobile/touch devices
3. **Scalability**: Single-user desktop app, not multi-tenant
4. **Risk**: yt-dlp breaks when YouTube changes API — need version pinning + update command
5. **Audio glitch risk**: Parameter changes without ramping cause clicks — mitigated with linearRamp
6. **Memory**: Spectrogram ImageData buffer not cleaned up on mode switch — potential leak
7. **Security**: Backend has no authentication — fine for local use, not for public deployment

## Debugging Checklist

- [ ] Audio context state: check `ctx.state` is 'running'
- [ ] AnalyserNode: verify `frequencyBinCount > 0`
- [ ] Canvas: verify `width/height > 0` after resize
- [ ] FPS: check RenderLoop.currentFps
- [ ] Network: verify backend health at `/api/health`
- [ ] YouTube: test with known-good URL first
- [ ] Console: check for Web Audio API errors
- [ ] Memory: monitor via Chrome DevTools → Memory tab

---

*Update this file every iteration with new decisions, issues, and changes.*
