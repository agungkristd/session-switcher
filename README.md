# Session Switcher

A browser extension to easily switch between multiple login sessions on the same website. Supports Chrome and Firefox.

## Features

- **Save Sessions:** Capture cookies and local storage for the current site.
- **Switch Sessions:** Instantly swap between saved accounts.
- **Management:** Rename, reorder, and delete sessions.
- **Private:** All data is stored locally in your browser.

## Development

This project uses [Bun](https://bun.com) for building and packaging.

### Prerequisites

- [Bun](https://bun.com) (v1.3.4+)

### Install Dependencies

```bash
bun install
```

### Development Mode

Run the following command to build in watch mode:

```bash
bun run dev
```

### Build for Production

**Chrome:**

```bash
bun run build
```

Artifacts will be in `dist/`.

**Firefox:**

```bash
bun run build:firefox
```

Artifacts will be in `dist-firefox/`.

### Package

To create a `.xpi` file for Firefox:

```bash
bun run package:firefox
```

The output file `session-switcher.xpi` will be in the project root.
