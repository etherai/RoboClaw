# GitHub Actions

## Deploy to GitHub Pages

The `deploy.yml` workflow automatically deploys the website to GitHub Pages when changes are pushed to the main branch.

### Setup Instructions

1. Go to your repository Settings > Pages
2. Under "Build and deployment", select:
   - Source: **GitHub Actions**
3. The workflow will automatically run on every push to main

### What Gets Deployed

- The website is built as a static site (API routes are excluded)
- Only the marketing/documentation pages are deployed
- The site is served from the `out` directory after build

### Manual Deployment

You can manually trigger a deployment from the Actions tab by selecting "Deploy to GitHub Pages" and clicking "Run workflow".
