# Contributing

Thanks for improving Modern Audio Enhancer.

## Before You Start

- Keep all user-facing copy in English.
- Preserve the DSP order unless a change explicitly needs to modify it.
- Keep web and desktop behavior aligned unless the platform abstraction requires a difference.
- Check for secrets, keys, local paths, or private data before committing.

## Local Checks

```bash
./scripts/diagnose.sh
```

If you only changed docs or assets, still open the app and verify the affected screen or workflow.

## Pull Requests

- Keep changes small and reviewable.
- Mention whether the change affects web, desktop, or both.
- Call out any new security or compatibility tradeoffs.

## Asset Rules

- Use descriptive English file names.
- Prefer GIF previews in README files when a loopable demo helps the user understand the feature.
- Keep source recordings only when they are useful for re-encoding or future edits.
