# AutoSplice

Open-source silence removal and multi-camera switching for Adobe Premiere Pro.

AutoSplice is a free alternative to AutoPod ($29/month). It automates two of the most time-consuming editing tasks for podcasters and video creators:

- **Jump Cut Editor** — Detects and removes silence from your footage
- **Multi-Camera Editor** — Automatically switches between camera angles based on who is speaking

## Features

### Jump Cut Editor
- Adjustable silence threshold (-20dB to -60dB)
- Minimum silence duration filtering (avoid micro-cuts)
- Configurable padding (buffer before/after speech)
- Delete or Disable mode (disable preserves clips for review)
- Visual preview before applying

### Multi-Camera Editor
- Speaker-to-camera mapping (up to 10 mics/cameras)
- Crosstalk sensitivity control
- Minimum cut duration (prevents jarring rapid switches)
- Optional wide shot insertion at configurable intervals
- Visual preview with color-coded camera assignments

## Installation

### Quick Install

1. Download `AutoSplice-v1.0.0.zip` from [GitHub Releases](https://github.com/devzaneai/autosplice/releases)
2. Unzip and run the install script:
   - **macOS:** `bash install.sh`
   - **Windows:** Double-click `install.bat`
3. Restart Adobe Premiere Pro
4. Go to **Window > Extensions > AutoSplice**

### Manual Install

Copy the extension files to your CEP extensions folder:
- **macOS:** `~/Library/Application Support/Adobe/CEP/extensions/autosplice/`
- **Windows:** `%APPDATA%\Adobe\CEP\extensions\autosplice\`

See [docs/INSTALL.md](docs/INSTALL.md) for detailed instructions.

## Usage

See [docs/USAGE.md](docs/USAGE.md) for a complete user guide.

**Quick start:**
1. Open your project in Premiere Pro
2. Open AutoSplice (Window > Extensions > AutoSplice)
3. Select the Jump Cut or Multi-Cam tab
4. Adjust settings (or use defaults)
5. Click **Analyze** to preview the edit
6. Click **Apply** to execute

All edits are undoable with Ctrl+Z / Cmd+Z.

## Compatibility

- Adobe Premiere Pro CC 2022 (v22.0) through 2025 (v25.x)
- macOS 12+ (Monterey), Apple Silicon and Intel
- Windows 10/11, x64

## Building from Source

```bash
git clone https://github.com/devzaneai/autosplice.git
cd autosplice
npm install
npm run build
npm test
```

For development with hot-reload:
```bash
npm run dev
```

## Tech Stack

- [Bolt CEP](https://github.com/hyperbrew/bolt-cep) — Extension framework
- React 19 + TypeScript — Panel UI
- FFmpeg — Audio extraction (bundled)
- ExtendScript (QE DOM) — Timeline operations

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

## License

MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- [Bolt CEP](https://github.com/hyperbrew/bolt-cep) by Hyper Brew for the extension framework
- [FFmpeg](https://ffmpeg.org/) for audio processing
- The creator community for feedback and inspiration
