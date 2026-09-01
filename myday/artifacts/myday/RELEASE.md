# MyDay macOS release

MyDay is packaged as an offline Electron application. The packaged renderer loads
from the bundled `file://` entry point and uses the context-isolated preload
bridge for every task, event, and tag operation. The Express server is only the
browser-preview adapter and is not included in the packaged application.

This repository is a pnpm workspace and uses pnpm catalogs and workspace links;
`npm install` is intentionally not a supported install path for the full
project. Use the pinned pnpm command sequence below.

## Build on macOS

Run these commands from the repository root on a Mac:

```sh
corepack enable
corepack prepare pnpm@10.6.5 --activate
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/myday run package:mac
```

The final DMG is written to:

```text
artifacts/myday/release/MyDay-0.0.0-arm64.dmg
```

On an Intel Mac, the architecture suffix is `x64` instead:

```text
artifacts/myday/release/MyDay-0.0.0-x64.dmg
```

The macOS build must run on macOS because electron-builder packages the
platform-specific Electron application and DMG.