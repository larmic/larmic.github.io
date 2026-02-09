# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for Lars Michaelis (larmic.de) built with Hugo static site generator using the hugo-hero-theme (as a git submodule).

## Development Commands

```bash
# Start local development server with file watching and draft posts
hugo server -w -D

# Build for production (used in CI/CD)
hugo --minify
```

## Architecture

- **Static Site Generator**: Hugo with YAML configuration (`config.yml`)
- **Theme**: hugo-hero-theme (git submodule at `themes/hugo-hero-theme/`)
- **Language**: German
- **Deployment**: GitHub Actions auto-deploys to GitHub Pages on push to main
- **Domain**: larmic.de (configured via `static/CNAME`)

## Content Structure

- `content/_index.md` - Homepage
- `content/about.md` - Personal bio
- `content/videos/` - Technical video content (testcontainers, hexagonal architecture, event storming, unit vs integration testing)
- `content/workshops/` - Workshop descriptions (DDD, hexagonal architecture, event storming). All workshop content is rendered on the list page (`/workshops/`) with anchor IDs (`#workshop-<basename>`). Individual single pages redirect to the list page anchor via `layouts/workshops/single.html`.
- `content/impressum.md` - Legal page (required in Germany)

## Theme Submodule

The hugo-hero-theme is a git submodule. After cloning, initialize with:
```bash
git submodule update --init --recursive
```
