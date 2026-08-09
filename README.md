# jsonresume-theme-Raphael

A small, dependency-free web app that turns [JSON Resume](https://jsonresume.org/schema/)
content into a clean, **print-friendly** and **ATS-friendly** HTML resume — right in
your browser. It can load your resume directly from a **GitHub Gist**, a raw JSON
URL, an uploaded file, or pasted JSON.

## Features

- **Load from a Gist** — paste a Gist link or ID and the app fetches your
  `resume.json` (or the first JSON file) via the public GitHub API.
- **Load from a URL** — point it at any raw JSON Resume file.
- **Upload or paste** — no network needed; everything runs client-side.
- **Print / Save as PDF** — a dedicated print stylesheet produces a tidy,
  single-column A4/Letter layout with no UI chrome.
- **ATS-friendly** — semantic HTML (`<h1>`–`<h3>`, real lists, standard section
  headings like *Experience*, *Education*, *Skills*) that applicant-tracking
  systems parse reliably.
- **Deep links** — loading a Gist updates the URL (`?gist=<id>` / `?url=<url>`)
  so you can bookmark or share a live resume link.
- **Privacy** — your data is processed entirely in the browser and never uploaded
  anywhere.

## Usage

Open the hosted app (see below), then either:

1. Paste a **Gist URL/ID** or a **raw JSON URL** and click **Load resume**, or
2. Click **Upload file** to pick a local `resume.json`, or
3. Click **Paste JSON** to paste content directly, or
4. Click **Load sample** to preview with example data.

Then use **Print / Save PDF** to export.

### Deep linking

- `?gist=<gist-id>` — load a specific Gist on page load.
- `?url=<raw-json-url>` — load a resume from any URL on page load.

## JSON Resume format

The app follows the open [JSON Resume schema](https://jsonresume.org/schema/) and
renders these sections when present: `basics` (with `location` and `profiles`),
`work`, `education`, `projects`, `skills`, `volunteer`, `awards`, `certificates`,
`publications`, `languages`, `interests`, and `references`. See
[`sample-resume.json`](sample-resume.json) for a complete example.

## Running locally

Because the app fetches files (the sample and Gists), serve it over HTTP rather
than opening `index.html` from disk:

```bash
# Python 3
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works.

## Deploying to GitHub Pages

This repository includes a workflow at
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that publishes the
site whenever you push to `main`.

1. In the repository settings, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main`. The site will be available at
   `https://<user>.github.io/<repository>/`.

The included `.nojekyll` file ensures all assets are served as-is.

## Project structure

```
index.html              # App shell and controls
assets/css/style.css    # Screen + print styles
assets/js/render.js     # JSON Resume -> semantic HTML renderer
assets/js/app.js        # Loading (Gist/URL/file/paste), routing, printing
sample-resume.json      # Example resume
.github/workflows/deploy.yml  # GitHub Pages deployment
```

## License

MIT
