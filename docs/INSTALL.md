# AutoSplice Installation Guide

## Prerequisites

- Adobe Premiere Pro CC 2022 or later
- macOS 12+ (Monterey) or Windows 10/11

## Option 1: Download Release (Recommended)

1. Go to [GitHub Releases](https://github.com/autosplice/autosplice/releases)
2. Download `AutoSplice-v1.0.0.zip`
3. Unzip the archive
4. Run the install script:
   - **macOS:** Open Terminal, navigate to the unzipped folder, run `bash install.sh`
   - **Windows:** Double-click `install.bat`
5. Restart Adobe Premiere Pro
6. Go to **Window > Extensions > AutoSplice**

## Option 2: Manual Install

1. Download or build the extension (see "Building from Source" below)
2. Copy the extension files to:
   - **macOS:** `~/Library/Application Support/Adobe/CEP/extensions/autosplice/`
   - **Windows:** `C:\Users\<your-username>\AppData\Roaming\Adobe\CEP\extensions\autosplice\`
3. Restart Premiere Pro

## Option 3: Build from Source

```bash
git clone https://github.com/autosplice/autosplice.git
cd autosplice
npm install
npm run build
```

Then either run the install script or manually copy `dist/cep/` to the extensions folder.

## Enabling Unsigned Extensions (Development)

If you're building from source, you need to enable CEP debug mode:

1. Install the [aescripts ZXP Installer](https://aescripts.com/learn/zxp-installer/)
2. Go to Settings > Debug > Enable Debugging
3. Restart Premiere Pro

Or enable manually:
- **macOS:** Run in Terminal:
  ```bash
  defaults write com.adobe.CSXS.11 PlayerDebugMode 1
  ```
- **Windows:** Add a registry key:
  ```
  HKEY_CURRENT_USER\SOFTWARE\Adobe\CSXS.11
  Key: PlayerDebugMode
  Type: String
  Value: 1
  ```

## Troubleshooting

### AutoSplice doesn't appear in Extensions menu
- Verify the files are in the correct extensions folder
- Make sure PlayerDebugMode is enabled (for source builds)
- Restart Premiere Pro completely (not just close/reopen a project)

### "FFmpeg not found" error
- The FFmpeg binary should be included in the `bin/` folder of the extension
- If missing, download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html) and place the binary in the extension's `bin/` folder

### Panel is blank or shows errors
- Open Chrome DevTools for the panel: navigate to `localhost:8860` in Chrome
- Check the console for error messages
- Ensure you're running a supported version of Premiere Pro
