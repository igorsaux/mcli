# mcli

A minimalist Minecraft launcher and asset manager.

## Features

- **Cache-first approach** — all assets are fetched from a local cache when available, reducing network usage and speeding up launches
- **Automatic asset synchronization** — downloads game client, libraries, and assets from Mojang's servers
- **Cross-platform** — supports Windows, macOS, and Linux (respects platform-specific library rules)
- **Custom main class** — override the default main class for mod loaders
- **Additional libraries** — include custom libraries in the classpath

## Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Java](https://adoptium.net/) 17+ (required to run Minecraft)

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

## Configuration

The manifest file (`mcli.json`) supports the following options:

```json
{
  "minecraft": {
    "version": "26.1.2",
    "mainClass": "net.fabricmc.loader.impl.launch.knot.KnotClient",
    "libraries": [
      "path/to/custom.jar"
    ],
    "args": {
      "username": "Player",
      "uuid": "019dd51d-ffff-799e-906b-30e005c5db99",
      "accessToken": "your-token"
    }
  }
}
```

### Options

| Field | Type | Description |
|-------|------|-------------|
| `version` | `string` | Minecraft version (required) |
| `mainClass` | `string` | Override the default main class (e.g., for mod loaders) |
| `libraries` | `string[]` | Additional JAR files to add to the classpath |
| `args.username` | `string` | Player username |
| `args.uuid` | `string` | Player UUID |
| `args.accessToken` | `string` | Authentication token |

## Fabric Setup

To use Fabric, install it via the [Fabric Installer](https://fabricmc.net/use/installer/), then set the `mainClass` in your manifest:

```json
{
  "minecraft": {
    "version": "26.1.2",
    "mainClass": "net.fabricmc.loader.impl.launch.knot.KnotClient"
  }
}
```

## Limitations

- **Old game versions may not work** — mcli is tested with recent versions and may have compatibility issues with older ones
- **No mod support** — this is a basic launcher; no mod loaders or mod management
