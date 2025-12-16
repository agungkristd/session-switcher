# Session Switcher

A browser extension to easily switch between multiple login sessions on the same website. Supports Chrome and Firefox.

## Features

- **Save Sessions:** Capture cookies and local storage for the current site.
- **Switch Sessions:** Instantly swap between saved accounts.
- **Management:** Rename, reorder, and delete sessions.
- **Private:** All data is stored locally in your browser.

## Installation

You can install the extension without building it yourself by downloading the latest release.

### Chrome / Edge / Brave

1.  Go to the [Releases](../../releases) page.
2.  Download `chrome-extension.zip`.
3.  Unzip the file.
4.  Open your browser's extension management page (e.g., `chrome://extensions`).
5.  Enable **Developer Mode**.
6.  Click **Load Unpacked** and select the unzipped folder.

### Firefox

1.  Go to the [Releases](../../releases) page.
2.  Download `session-switcher.xpi`.
3.  Open Firefox and go to `about:addons`.
4.  Click the gear icon and select **Install Add-on From File...** (or drag and drop the `.xpi` file).

## Building from Source

If you want to build the extension yourself or contribute, follow these steps.

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
