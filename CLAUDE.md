# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Pages root repository (`xfpg21421.github.io`) serving as an entry-point landing page. It performs two functions:

1. **Google AdSense verification** — embeds the publisher meta tag and script for `ca-pub-6914086930663690`
2. **Immediate redirect** — sends all visitors to `/gb_great_news/` (the actual UK News Aggregator site) via `<meta http-equiv="refresh">`

## Deployment

There is no build process. This is a pure static HTML site deployed directly by GitHub Pages on every push to `main`. To deploy a change, commit and push — GitHub Pages picks it up automatically within ~1 minute.

```bash
git add index.html
git commit -m "..."
git push origin main
```

## Repository Structure

- `index.html` — the only content file; everything described above lives here
- `.claude/settings.local.json` — Claude Code local permissions

## Key Details

- The redirect target (`/gb_great_news/`) is served from the same GitHub Pages domain but lives in a **different repository**. Changes to the redirect destination only require editing the `url=` value in the `<meta http-equiv="refresh">` tag and the `<link rel="canonical">` href.
- The AdSense publisher ID (`ca-pub-6914086930663690`) appears in two places in `index.html`: the meta tag and the script `src`. Both must match if it ever changes.
