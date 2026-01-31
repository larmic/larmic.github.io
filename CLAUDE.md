# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for Lars Michaelis (larmic.de) built with Hugo static site generator using the PaperMod theme (as a git submodule).

## Development Commands

```bash
# Start local development server with file watching and draft posts
hugo server -w -D

# Build for production (used in CI/CD)
hugo --minify
```

## Architecture

- **Static Site Generator**: Hugo with YAML configuration (`config.yml`)
- **Theme**: PaperMod (git submodule at `themes/PaperMod/`)
- **Languages**: German (default) and English (files with `.en.md` suffix)
- **Deployment**: GitHub Actions auto-deploys to GitHub Pages on push to main
- **Domain**: larmic.de (configured via `static/CNAME`)

## Content Structure

- `content/about.md` / `content/about.en.md` - Personal bio
- `content/videos/` - Technical video content (testing, architecture, event storming)
- `content/workshops/` - Workshop descriptions (DDD, hexagonal architecture)
- `content/impressum.md` - Legal page (required in Germany)

## Customizations

- `layouts/partials/footer.html` - Custom footer extending PaperMod theme with copyright and Impressum link

## Theme Submodule

The PaperMod theme is a git submodule. After cloning, initialize with:
```bash
git submodule update --init --recursive
```
