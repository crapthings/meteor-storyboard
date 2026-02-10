# Storyboard Studio

A full-stack Meteor app for building multi-step storyboards with AI-assisted assets.  
Design shots, generate or upload media, and keep a clean, versioned history per asset type.

---

## Highlights

- **Shot-based storyboard editing** with reorderable columns (drag to reorder).
- **Five asset lanes per shot**: source video, source image, edited image, output video, audio.
- **Active asset tracking**: each shot tracks the currently active asset for each lane.
- **History view**: browse past generations/uploads and set any asset active.
- **AI generation (fal.ai)**:
  - Text-to-image (source image)
  - Image editing (edited image)
  - Text-to-video (output video)
  - Reference-to-video (output video using edited/source image)
  - Text-to-speech (audio)
- **Upload pipeline** for images, videos, and audio (stored in `public/assets`).
- **Automatic thumbnails** for videos and waveform thumbnails for audio.
- **HeroUI + Tailwind** UI with icon-only and compact action controls.

---

## Architecture Overview

- **Collections**
  - `storyboards`
  - `shots`
  - `assets`
- **Reactive data**
  - Meteor pub/sub for storyboards, shots, assets
  - Active asset fields live on the shot (`activeSourceVideoId`, etc.)
- **Server**
  - Methods split by domain in `imports/server/methods/`
  - Upload routes in `imports/server/routes/`
- **Client**
  - Per-shot asset components with prompt and action controls
  - History modal per asset type

---

## Getting Started

```bash
meteor run
```

### Environment / Settings

The app expects `FAL_KEY` to be available on the server.

Use **Meteor settings** and set your asset path:

```json
{
  "FAL_KEY": "YOUR_KEY",
  "ASSETS_FOLDER": "/absolute/path/to/assets",
  "ASSETS_URL_PREFIX": "/assets"
}
```

Notes:
- `ASSETS_FOLDER` (or `ASSETS_STATIC_DIR`) controls where uploaded files are stored.
- `ASSETS_URL_PREFIX` (or `ASSETS_STATIC_PREFIX`) controls the public static URL prefix.

Run with:

```bash
meteor run --settings settings.json
```

---

## Core UX

### Storyboard

- Create storyboards from the home screen.
- Adjust global aspect ratio (`16:9`, `9:16`) at the top header.
- Rename and manage shots from the shot menu.

### Shots & Assets

- Each shot contains 5 asset lanes:
  - **Source Video**
  - **Source Image** (T2I)
  - **Edited Image** (I2IE)
  - **Output Video** (T2V / R2V)
  - **Audio** (T2S)
- Prompted lanes include submit actions.
- Upload assets to any lane (icon button in header).
- History modal allows selecting active assets and specialized UI:
  - Video preview + activation list
  - Audio player + activation list

---

## AI Generation

### Models

- **Text to Image**: `fal-ai/z-image/turbo`
- **Image Edit**: `fal-ai/nano-banana-pro/edit`
- **Text to Video**: `fal-ai/bytedance/seedance/v1/lite/text-to-video`
- **Reference to Video**: `fal-ai/bytedance/seedance/v1/lite/reference-to-video`
- **Text to Speech**: `fal-ai/minimax/speech-2.8-turbo`

All generations:

- Create a **pending** asset
- Move to **processing**
- Update to **completed** or **error**

---

## API Routes (Server)

- `POST /api/assets/upload`
  - Upload file to `ASSETS_FOLDER`, create new asset, set active
- `POST /api/assets/thumbnail`
  - Store video thumbnail for a given asset
- `POST /api/assets/waveform`
  - Store audio waveform image for a given asset

---

## Roadmap (planned / upcoming)

- Multi-shot templates and batch creation
- Cross-storyboard asset library and reuse
- Multi-reference image to video (1–4 inputs)
- Full timeline export (EDL / JSON)
- Batch render queue + background status
- Custom voice settings for TTS
- Storyboard versioning and change history
- Team collaboration with roles and approvals

---

## Development Notes

- Tailwind is used **inline** for all styling.
- Storyboard UI is full-width and optimized for horizontal scroll.
- Local file uploads are saved under `public/assets` (or `ASSETS_FOLDER`) and served from `ASSETS_URL_PREFIX`.

---

## License

Private / internal. Replace with your preferred license.
