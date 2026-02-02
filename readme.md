# larmic.de

Personal website built with [Hugo](https://gohugo.io/) using the [hugo-hero-theme](https://github.com/zerostaticthemes/hugo-hero-theme).

## Development

```bash
# Start local server with drafts
hugo server -w -D

# Build for production
hugo --minify
```

## Theme Management

The theme is included as a Git submodule at `themes/hugo-hero-theme/`.

### Automatic Updates via Renovate

[Renovate](https://docs.renovatebot.com/) monitors the theme repository for new releases:

- **When a new tag is released**: Renovate creates a PR automatically
- **Minor/Patch updates**: Auto-merged (no action needed)
- **Major updates**: Require manual review and merge

### After Merging a Renovate PR

No manual action required. The CI/CD pipeline:
1. Pulls the updated submodule
2. Builds the site with `hugo --minify`
3. Deploys to GitHub Pages

### Manual Theme Update (if needed)

```bash
cd themes/hugo-hero-theme
git fetch --tags
git checkout <new-tag>
cd ../..
git add themes/hugo-hero-theme
git commit -m "Update hugo-hero-theme to <new-tag>"
git push
```

## Deployment

Automatic via GitHub Actions on push to `main`. Site is published to [larmic.de](https://larmic.de).
