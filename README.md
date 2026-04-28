# mcli

A minimalist Minecraft launcher and asset manager.

## Features

- **Cache-first approach** — all assets are fetched from a local cache when available, reducing network usage and speeding up launches.
- **Automatic asset synchronization** — downloads game client, libraries, and assets from Mojang's servers.
- **Cross-platform** — supports Windows, macOS, and Linux (respects platform-specific library rules).
- **Minimal dependencies** — only requires Bun.

## Prerequisites

- [Bun](https://bun.sh) (v1.3+)

## Installation

Install globally with Bun:

```bash
bun install --global git+https://github.com/igorsaux/mcli.git
```

After installation, the `mcli` command will be available in your terminal.

## Usage

### Initialize a project

Creates a manifest file for a specific Minecraft version:

```bash
mcli init <version>
```

Example:

```bash
mcli init 26.1.2
```

### Synchronize assets

Downloads the game client, libraries, and assets to the current directory:

```bash
mcli sync
```

### Run Minecraft

Launches the game with the configured version:

```bash
mcli run
```

## Limitations

- **Old game versions may not work** — mcli is tested for recent versions and may have issues with older ones.
- **No mod support** — this is a basic launcher, no mod loaders or mod management.
