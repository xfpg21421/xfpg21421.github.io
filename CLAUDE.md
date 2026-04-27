# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Pages user site (`xfpg21421.github.io`) — a single-file static homepage that displays live prediction market data. It has two responsibilities:

1. **Polymarket Breaking News feed** — fetches the top 20 trending events from Polymarket's public API on every page load and renders them as market cards
2. **Google AdSense verification** — embeds the publisher meta tag and script for `ca-pub-6914086930663690`

A footer link points visitors to `/gb_great_news/` (the UK News Aggregator, served from a separate repository).

## Deployment

No build process. Push to `main` and GitHub Pages deploys within ~1 minute.

```bash
git add index.html
git commit -m "..."
git push origin main
```

## Architecture

Everything lives in `index.html` — styles, markup, and JavaScript in one file. There are no dependencies, bundlers, or frameworks.

**Data flow:**

```
Polymarket Gamma API
  GET https://gamma-api.polymarket.com/events
      ?limit=20&active=true&closed=false&order=volume24hr&ascending=false
  → array of event objects
  → buildCard(event) renders each as a .card div
  → injected into #grid
```

**Key API fields used per event:**

| Field | Used for |
|---|---|
| `title` | Card heading |
| `slug` | `https://polymarket.com/event/{slug}` link |
| `image` | Card cover photo |
| `tags[].label` | Tag pills (first 3) |
| `volume24hr` | Displayed as 24h volume |
| `markets[].outcomes` | Outcome labels (JSON string, parsed) |
| `markets[].outcomePrices` | Probabilities (JSON string, parsed) |

**Market rendering logic (`buildCard`):**
- Single-market events with `["Yes","No"]` outcomes → green Yes / red No buttons
- Single-market events with other outcome names → indigo buttons, labels truncated to 14 chars
- Multi-market events (e.g. "Who will win?") → top 2 markets sorted by `outcomePrices[0]` descending

## Key Details

- The AdSense publisher ID (`ca-pub-6914086930663690`) appears in two places: the `<meta name="google-adsense-account">` tag and the `<script src>`. Both must match if it ever changes.
- `/gb_great_news/` lives in a **different repository** on the same GitHub Pages domain. Nothing in this repo controls it.
- There is no auto-redirect; the page is a real landing page now (the old `<meta http-equiv="refresh">` was removed).
