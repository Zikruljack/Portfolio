# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portfolio landing page for Muhammad Zikrullah ("Obong") — freelance full-stack developer. Static HTML single-page site served via GitHub Pages at muhammadzikrullah.com.

Also a monorepo parent; `obongcms/` is its own project (separate git repo).

## Commands

No build tools, bundlers, or package managers. Pure static HTML + CSS + JS.

- **Preview locally**: `python3 -m http.server 8000` (or any static file server)
- **Deploy**: push to `main` → GitHub Pages auto-deploys (CNAME: muhammadzikrullah.com)
- **Validate HTML**: `npx html-validate index.html` (optional, not part of CI)

## Architecture

### Portfolio (root)

- `index.html` — single-page site, all content in one file
  - Sections: Nav → Hero → Tentang → Keahlian → Jasa → Kontak → Footer
  - Tailwind CSS via CDN (no build step)
  - Color scheme: brand `#1A0033`, accent `#FF4500`
  - Scroll reveal via IntersectionObserver in `js/main.js`
- `css/style.css` — custom styles (card hover, nav underline, focus states, reveal animation)
- `js/main.js` — scroll reveal observer, navbar backdrop on scroll, smooth anchor scroll, reduced-motion guard
- `CNAME` — GitHub Pages custom domain config

### obongcms/ (separate project, separate git repo)

- `obongcms/backend/` — CodeIgniter 4 (PHP) backend API
- `obongcms/frontend/` — Go + templates frontend
- Refer to `obongcms/CLAUDE.md` and `obongcms/README.md` for details

### Content strategy

- 4 services: ObongCMS, Website Sekolah, POS, Aplikasi Mobile (Flutter)
- Each service priced in 3 tiers: Basic / Bisnis (terlaris) / Profesional
- Indonesian language throughout (target market: Indonesia)
