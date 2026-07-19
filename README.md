# sardin-ventures.github.io

Official static site for sardin-ventures.

- Studio homepage: `index.html`
- RUNZ press kit: `runz/index.html`
- OHJATA project page: `ohjata/index.html`

GitHub Pages publishes this repository at:

https://sardin-ventures.github.io/

## Edit the RUNZ publisher pitch

The pitch has a local visual editor for adding, editing, duplicating, and
deleting text without touching HTML.

Double-click `tools\pitch-editor\start.cmd`, or run this from PowerShell:

```powershell
.\tools\pitch-editor\start.cmd
```

The editor opens at `http://127.0.0.1:4173`. Click outlined text in the live
preview and type directly into the page. Use **Add text after**, **Duplicate
block**, or **Delete** for structural changes, then choose **Save pitch** (or
press `Ctrl+S`).

Saving updates `runz/pitch/index.html` and creates a timestamped local backup
under `tools/pitch-editor/.backups/`. Backups are ignored by Git.
