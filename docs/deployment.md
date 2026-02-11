# Deployment Guide

How to prepare your React Audio Unit plugin for distribution.

## Build for Release

```bash
rau build
```

This produces optimized binaries with the UI embedded. Output locations:

| Platform | Format     | Default Install Path                                 |
| -------- | ---------- | ---------------------------------------------------- |
| macOS    | AU         | `~/Library/Audio/Plug-Ins/Components/`               |
| macOS    | VST3       | `~/Library/Audio/Plug-Ins/VST3/`                     |
| macOS    | Standalone | `build/release/<Name>_artefacts/Release/Standalone/` |
| Windows  | VST3       | `C:\Program Files\Common Files\VST3\`                |
| Linux    | VST3       | `~/.vst3/`                                           |

## Platform-Specific Builds

```bash
rau build --mac      # macOS only (AU + VST3 + Standalone)
rau build --win      # Windows only (VST3 + Standalone)
rau build --linux    # Linux only (VST3 + Standalone)
```

## Validation

Always validate before distribution:

```bash
rau validate
```

This runs:
- **macOS:** `auval` for AudioUnit validation, VST3 bundle structure check
- **Windows:** VST3 structure validation
- **All platforms:** Steinberg `VST3Inspector` if available

### Manual DAW Testing Checklist

- [ ] Plugin loads without error in target DAW
- [ ] Audio passes through correctly
- [ ] Parameters respond to automation
- [ ] State saves and recalls correctly (close and reopen project)
- [ ] UI displays correctly at different scaling factors
- [ ] No audio glitches during parameter changes
- [ ] Plugin unloads cleanly (no crashes on close)

## macOS Code Signing

Apple requires code signing for distribution. JUCE plugins need signing of all formats.

### Prerequisites

- Apple Developer account ($99/year)
- Developer ID Application certificate
- Developer ID Installer certificate (for `.pkg`)

### Sign the plugin

```bash
# Sign AU
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  --options runtime \
  "build/release/MyPlugin_artefacts/Release/AU/My Plugin.component"

# Sign VST3
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  --options runtime \
  "build/release/MyPlugin_artefacts/Release/VST3/My Plugin.vst3"

# Sign Standalone
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  --options runtime \
  "build/release/MyPlugin_artefacts/Release/Standalone/My Plugin.app"
```

### Notarization

Apple requires notarization for apps distributed outside the App Store:

```bash
# Create a ZIP for notarization
ditto -c -k --keepParent "My Plugin.vst3" "MyPlugin-VST3.zip"

# Submit for notarization
xcrun notarytool submit "MyPlugin-VST3.zip" \
  --apple-id "you@email.com" \
  --team-id "TEAMID" \
  --password "app-specific-password" \
  --wait

# Staple the notarization ticket
xcrun stapler staple "My Plugin.vst3"
```

Repeat for each format (AU, VST3, Standalone).

## macOS Installer (.pkg)

Create a `.pkg` installer for easy distribution:

```bash
# Create a temporary install root
mkdir -p pkg-root/Library/Audio/Plug-Ins/Components
mkdir -p pkg-root/Library/Audio/Plug-Ins/VST3

cp -R "My Plugin.component" pkg-root/Library/Audio/Plug-Ins/Components/
cp -R "My Plugin.vst3" pkg-root/Library/Audio/Plug-Ins/VST3/

# Build the package
pkgbuild --root pkg-root \
  --identifier "com.yourcompany.myplugin" \
  --version "1.0.0" \
  --install-location "/" \
  "MyPlugin-1.0.0.pkg"

# Sign the package
productsign --sign "Developer ID Installer: Your Name (TEAMID)" \
  "MyPlugin-1.0.0.pkg" "MyPlugin-1.0.0-signed.pkg"

# Notarize the package
xcrun notarytool submit "MyPlugin-1.0.0-signed.pkg" \
  --apple-id "you@email.com" \
  --team-id "TEAMID" \
  --password "app-specific-password" \
  --wait

xcrun stapler staple "MyPlugin-1.0.0-signed.pkg"
```

## Windows Installer

### Prerequisites
- Visual Studio with MSVC
- [Inno Setup](https://jrsoftware.org/isinfo.php) or [WiX Toolset](https://wixtoolset.org/)

### Inno Setup Script (example)

```iss
[Setup]
AppName=My Plugin
AppVersion=1.0.0
DefaultDirName={autopf}\Common Files\VST3
OutputBaseFilename=MyPlugin-1.0.0-Setup

[Files]
Source: "build\release\MyPlugin_artefacts\Release\VST3\My Plugin.vst3\*"; \
  DestDir: "{app}\My Plugin.vst3"; Flags: recursesubdirs

[Icons]
Name: "{group}\My Plugin"; Filename: "{app}\My Plugin.vst3"
```

### Windows Code Signing

```powershell
signtool sign /f "certificate.pfx" /p "password" /tr http://timestamp.digicert.com /td sha256 "My Plugin.vst3"
```

## Linux Distribution

Linux plugins are typically distributed as:
- `.vst3` bundles (copy to `~/.vst3/`)
- `.deb` packages (Debian/Ubuntu)
- `.rpm` packages (Fedora/RHEL)

### .deb Package

```bash
mkdir -p myplugin-1.0.0/DEBIAN
mkdir -p myplugin-1.0.0/usr/lib/vst3

cat > myplugin-1.0.0/DEBIAN/control << EOF
Package: myplugin
Version: 1.0.0
Architecture: amd64
Maintainer: Your Name <you@email.com>
Description: My Plugin - Audio effect
EOF

cp -R "My Plugin.vst3" myplugin-1.0.0/usr/lib/vst3/

dpkg-deb --build myplugin-1.0.0
```

## CI/CD with GitHub Actions

Example workflow for building on all platforms:

```yaml
name: Build Plugin

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Install system dependencies (Linux)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libasound2-dev libcurl4-openssl-dev libfreetype6-dev \
            libwebkit2gtk-4.0-dev libx11-dev libxcomposite-dev \
            libxcursor-dev libxinerama-dev libxrandr-dev \
            libxrender-dev mesa-common-dev

      - name: Build plugin
        run: pnpm build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: plugin-${{ matrix.os }}
          path: build/release/*_artefacts/Release/**/*
```

## Distribution Checklist

- [ ] All formats build successfully
- [ ] `rau validate` passes
- [ ] Tested in at least 2 major DAWs per platform
- [ ] Code signed (macOS and Windows)
- [ ] Notarized (macOS)
- [ ] Installer created and tested
- [ ] README/documentation for end users
- [ ] Version number updated in `plugin.config.ts`
