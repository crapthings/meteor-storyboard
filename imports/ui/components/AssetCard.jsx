import { useEffect, useRef, useState } from "react";
import { Button, ButtonGroup } from "@heroui/react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import Icon from "@mdi/react";
import { ALL_FORMATS, CanvasSink, Input, UrlSource } from "mediabunny";
import {
  mdiContentSave,
  mdiWandSparkles,
  mdiHistory,
  mdiImage,
  mdiImageEdit,
  mdiVideo,
  mdiMicrophone,
  mdiUpload,
} from "@mdi/js";
import WaveSurfer from "wavesurfer.js";

const UPLOAD_ACCEPT_BY_ROW = {
  "source-clip": "video/*",
  "source-image": "image/*",
  "edit-image": "image/*",
  "output-video": "video/*",
  audio: "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,video/mp4",
};

const getUploadAccept = (rowId) => UPLOAD_ACCEPT_BY_ROW[rowId] || "*/*";

const HEADER_ICON_BY_ROW = {
  "source-clip": mdiVideo,
  "source-image": mdiImage,
  "edit-image": mdiImageEdit,
  "output-video": mdiVideo,
  audio: mdiMicrophone,
};

const getHeaderIcon = (rowId) => HEADER_ICON_BY_ROW[rowId] || mdiImage;

const getWaveformDataUrl = (decodedData) => {
  if (!decodedData) return null;
  const channel = decodedData.getChannelData(0);
  if (!channel || !channel.length) return null;

  const width = 640;
  const height = 120;
  const padding = 10;
  const centerY = height / 2;
  const amplitude = (height - padding * 2) / 2;
  const step = Math.max(1, Math.floor(channel.length / width));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 1) {
    const start = x * step;
    const end = Math.min(channel.length, start + step);
    let min = 1;
    let max = -1;

    for (let i = start; i < end; i += 1) {
      const value = channel[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }

    const y1 = centerY + min * amplitude;
    const y2 = centerY + max * amplitude;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
};

const formatDurationSeconds = (value) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return `${Math.round(seconds)}s`;
};

const getVideoFpsFromElement = (video) => {
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return null;
  const quality =
    typeof video.getVideoPlaybackQuality === "function"
      ? video.getVideoPlaybackQuality()
      : null;
  const frameCandidates = [
    quality?.totalVideoFrames,
    video.webkitDecodedFrameCount,
    video.mozPresentedFrames,
    video.mozDecodedFrames,
  ].map((value) => Number(value));
  const frameCount = frameCandidates.find(
    (value) => Number.isFinite(value) && value > 0
  );
  if (!Number.isFinite(frameCount) || frameCount <= 0) return null;
  const fps = frameCount / video.duration;
  if (!Number.isFinite(fps) || fps <= 0) return null;
  return Math.round(fps * 100) / 100;
};

const canvasToDataUrl = (canvas) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }, "image/png");
  });

const getThumbnailDimensions = (videoTrack, maxSize = 320) => {
  const width = Number(videoTrack?.displayWidth || 0);
  const height = Number(videoTrack?.displayHeight || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: maxSize, height: maxSize };
  }
  if (width >= height) {
    return { width: maxSize, height: Math.max(1, Math.floor((maxSize * height) / width)) };
  }
  return { width: Math.max(1, Math.floor((maxSize * width) / height)), height: maxSize };
};

const generateThumbnailFromVideoUrl = async (videoUrl) => {
  if (!videoUrl) return null;
  const absoluteUrl =
    videoUrl.startsWith("http://") || videoUrl.startsWith("https://")
      ? videoUrl
      : `${window.location.origin}${videoUrl.startsWith("/") ? "" : "/"}${videoUrl}`;
  const input = new Input({
    source: new UrlSource(absoluteUrl),
    formats: ALL_FORMATS,
  });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) return null;
  if (videoTrack.codec === null) return null;
  const canDecode = await videoTrack.canDecode();
  if (!canDecode) return null;

  const firstTimestamp = await videoTrack.getFirstTimestamp();
  const duration = await videoTrack.computeDuration();
  const safeDuration =
    Number.isFinite(duration) && duration > 0 ? duration : 0;
  const timestamp = firstTimestamp + safeDuration * 0.25;
  const size = getThumbnailDimensions(videoTrack, 320);
  const dpr = window.devicePixelRatio || 1;
  const sink = new CanvasSink(videoTrack, {
    width: Math.max(1, Math.floor(size.width * dpr)),
    height: Math.max(1, Math.floor(size.height * dpr)),
    fit: "fill",
  });
  for await (const wrappedCanvas of sink.canvasesAtTimestamps([timestamp])) {
    if (!wrappedCanvas?.canvas) return null;
    return canvasToDataUrl(wrappedCanvas.canvas);
  }
  return null;
};

const withTimeout = async (promise, ms, label) => {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const AssetCard = ({
  shotId,
  row,
  asset,
  historyCount,
  onSave,
  onGenerate,
  onGenerateCurrent,
  onGenerateTailFrame,
  onGenerateStartEnd,
  onGenerateLipSync,
  onGenerateReference,
  hasReference,
  hasCurrent,
  hasSourceInput,
  hasTailFrame,
  hasStartEnd,
  hasLipSync,
  canDropAsset,
  isDropEnabled,
  onUpdateVideoMetadata,
  onOpenHistory,
  onUpload,
}) => {
  const fileInputRef = useRef(null);
  const [prompt, setPrompt] = useState(asset?.prompt || "");
  const waveformRef = useRef(null);
  const waveformInstanceRef = useRef(null);
  const [isWaveformUploading, setIsWaveformUploading] = useState(false);
  const [isThumbnailUploading, setIsThumbnailUploading] = useState(false);
  const metadataSyncedRef = useRef(new Set());
  const thumbnailAttemptedRef = useRef(new Set());
  const dropId = `slot:${shotId}:${row.id}`;
  const draggableId = `asset:${asset?._id || `${shotId}:${row.id}:empty`}`;
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: dropId,
    disabled: !isDropEnabled,
    data: {
      type: "asset-slot",
      shotId,
      rowId: row.id,
    },
  });
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragNodeRef,
    isDragging,
  } = useDraggable({
    id: draggableId,
    disabled: !asset?._id,
    data: {
      type: "asset",
      assetId: asset?._id || null,
      shotId,
      rowId: row.id,
    },
  });

  useEffect(() => {
    setPrompt(asset?.prompt || "");
  }, [asset?.prompt]);

  useEffect(() => {
    if (row.id !== "audio") return;
    if (!asset?.url) return;
    if (asset?.waveformUrl) return;
    if (!waveformRef.current) return;
    if (isWaveformUploading) return;

    const container = waveformRef.current;
    const wavesurfer = WaveSurfer.create({
      container,
      waveColor: "#94a3b8",
      progressColor: "#475569",
      height: 48,
      barWidth: 2,
      barGap: 2,
      url: asset.url,
    });
    waveformInstanceRef.current = wavesurfer;

    wavesurfer.on("ready", async () => {
      try {
        const decodedData = wavesurfer.getDecodedData();
        const dataUrl = getWaveformDataUrl(decodedData);
        if (!dataUrl) return;
        setIsWaveformUploading(true);
        await fetch("/api/assets/waveform", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assetId: asset._id,
            dataUrl,
          }),
        });
      } finally {
        setIsWaveformUploading(false);
        wavesurfer.destroy();
      }
    });

    return () => {
      wavesurfer.destroy();
    };
  }, [asset?._id, asset?.url, asset?.waveformUrl, isWaveformUploading, row.id]);

  useEffect(() => {
    if (row.id !== "source-clip" && row.id !== "output-video") return;
    if (!asset?.url) return;
    if (metadataSyncedRef.current.has(asset._id)) return;

    const video = document.createElement("video");
    video.src = asset.url;
    video.preload = "metadata";

    const handleLoadedMetadata = async () => {
      const duration = Number(video.duration);
      const width = Number(video.videoWidth || 0);
      const height = Number(video.videoHeight || 0);
      const fps = getVideoFpsFromElement(video);
      if (!Number.isFinite(duration) || duration <= 0) return;
      metadataSyncedRef.current.add(asset._id);
      if (typeof onUpdateVideoMetadata === "function") {
        await onUpdateVideoMetadata({
          duration,
          fps,
          width: Number.isFinite(width) && width > 0 ? width : null,
          height: Number.isFinite(height) && height > 0 ? height : null,
        });
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata, {
      once: true,
    });

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [asset?._id, asset?.url, onUpdateVideoMetadata, row.id]);

  useEffect(() => {
    if (row.id !== "source-clip" && row.id !== "output-video") return;
    if (!asset?.url) return;
    if (asset?.thumbnailUrl) return;
    if (!asset?._id) return;
    if (thumbnailAttemptedRef.current.has(asset._id)) return;
    let disposed = false;
    thumbnailAttemptedRef.current.add(asset._id);
    const run = async () => {
      try {
        setIsThumbnailUploading(true);
        const dataUrl = await withTimeout(
          generateThumbnailFromVideoUrl(asset.url),
          15000,
          "thumbnail extraction"
        );
        if (disposed || !dataUrl) return;
        const response = await withTimeout(
          fetch("/api/assets/thumbnail", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: asset._id,
              dataUrl,
            }),
          }),
          10000,
          "thumbnail upload"
        );
        if (!response?.ok) {
          throw new Error(`thumbnail upload failed: ${response?.status || "unknown"}`);
        }
      } catch (error) {
        // Keep UI responsive when thumbnail extraction fails (e.g. remote CORS video URL).
        console.error("thumbnail generation failed", error);
      } finally {
        if (!disposed) {
          setIsThumbnailUploading(false);
        }
      }
    };
    void run();
    return () => {
      disposed = true;
    };
  }, [asset?._id, asset?.thumbnailUrl, asset?.url, row.id]);

  const handleSave = () => {
    if (!row.hasPrompt) return;
    const nextPrompt = prompt.trim();
    onSave({ prompt: nextPrompt });
  };

  const handleGenerate = () => {
    if (!row.hasPrompt) return;
    const nextPrompt = prompt.trim();
    onGenerate({ prompt: nextPrompt });
  };

  const handleGenerateReference = () => {
    if (!row.hasPrompt || !hasReference) return;
    const nextPrompt = prompt.trim();
    onGenerateReference({ prompt: nextPrompt });
  };

  const handleGenerateCurrent = () => {
    if (!row.hasPrompt || !hasCurrent) return;
    const nextPrompt = prompt.trim();
    onGenerateCurrent({ prompt: nextPrompt });
  };

  const handleGenerateTailFrame = () => {
    if (!row.hasPrompt || !hasTailFrame) return;
    const nextPrompt = prompt.trim();
    onGenerateTailFrame({ prompt: nextPrompt });
  };

  const handleGenerateStartEnd = () => {
    if (!row.hasPrompt || !hasStartEnd) return;
    const nextPrompt = prompt.trim();
    onGenerateStartEnd({ prompt: nextPrompt });
  };

  const handleGenerateLipSync = () => {
    if (!row.hasPrompt || !hasLipSync) return;
    const nextPrompt = prompt.trim();
    onGenerateLipSync({ prompt: nextPrompt });
  };

  const status = asset?.status || "idle";
  const statusTone =
    status === "completed"
      ? "bg-neutral-900 text-neutral-50"
      : status === "processing"
        ? "bg-neutral-600 text-neutral-50"
        : status === "pending"
          ? "bg-neutral-300 text-neutral-900"
          : status === "error"
            ? "bg-neutral-900 text-neutral-50"
            : "bg-neutral-300 text-neutral-900";

  const headerIcon = getHeaderIcon(row.id);
  const saveIcon = mdiContentSave;
  const generateIcon = mdiWandSparkles;
  const isProcessing = status === "processing";
  const durationLabel =
    row.id === "audio" ? formatDurationSeconds(asset?.duration) : null;

  const handleUploadClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onUpload(file);
  };

  const dropClass = isOver
    ? canDropAsset
      ? "ring-2 ring-neutral-700"
      : "ring-2 ring-neutral-400"
    : "";

  return (
    <div
      ref={setDropNodeRef}
      className={`flex min-h-[120px] flex-col overflow-hidden bg-neutral-300 ${dropClass}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={getUploadAccept(row.id)}
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center justify-between bg-neutral-600 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-50">
        <span className="inline-flex items-center gap-2">
          <Icon path={headerIcon} size={0.8} />
          {durationLabel ? (
            <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-50">
              {durationLabel}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            isIconOnly
            variant="tertiary"
            aria-label="Upload asset"
            className="h-7 w-7 rounded-full bg-neutral-50 text-neutral-900"
            onPress={handleUploadClick}
          >
            <Icon path={mdiUpload} size={0.7} />
          </Button>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${statusTone}`}
          >
            {isProcessing ? (
              <>
                <span className="h-2.5 w-2.5 animate-spin rounded-full border border-neutral-50 border-t-transparent" />
                Processing
              </>
            ) : (
              status
            )}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-3">
        <button
          type="button"
          className={`overflow-hidden bg-neutral-50 text-left ${
            isDragging ? "opacity-70" : ""
          }`}
          onClick={onOpenHistory}
          ref={setDragNodeRef}
          {...dragListeners}
          {...dragAttributes}
        >
          {row.id === "audio" && asset?.url ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 bg-neutral-50 px-3">
              {asset?.waveformUrl ? (
                <img
                  src={asset.waveformUrl}
                  alt="Waveform preview"
                  className="h-12 w-full rounded-lg object-cover"
                />
              ) : (
                <div
                  ref={waveformRef}
                  className="h-12 w-full overflow-hidden bg-neutral-300"
                />
              )}
            </div>
          ) : row.id === "source-clip" || row.id === "output-video" ? (
            asset?.thumbnailUrl ? (
              <img
                src={asset.thumbnailUrl}
                alt={`${row.label} thumbnail`}
                className="h-32 w-full object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center bg-neutral-50 text-xs text-neutral-400">
                {isThumbnailUploading ? "Generating thumbnail..." : "No thumbnail yet"}
              </div>
            )
          ) : asset?.url ? (
            <img
              src={asset.url}
              alt={`${row.label} preview`}
              className="h-32 w-full object-cover"
            />
          ) : isProcessing ? (
            <div className="flex h-32 items-center justify-center gap-2 bg-neutral-50 text-xs text-neutral-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
              Processing...
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center bg-neutral-50 text-xs text-neutral-400">
              No preview yet
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-neutral-600">
            <span>Preview</span>
            <span className="inline-flex items-center gap-1">
              <Icon path={mdiHistory} size={0.7} />
              {historyCount > 0 ? `${historyCount} history` : "History"}
            </span>
          </div>
        </button>
        {row.hasPrompt ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="min-h-[70px] w-full resize-none bg-neutral-50 px-3 py-2 text-xs text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-600"
              placeholder="Enter prompt..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {row.id === "output-video" ? (
                <>
                  <ButtonGroup
                    size="sm"
                    variant="tertiary"
                    fullWidth
                    className="w-full bg-neutral-600 text-neutral-50"
                  >
                    <Button
                      className="h-7 bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                      onPress={handleSave}
                    >
                      save
                    </Button>
                    <Button
                      className="h-7 bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                      onPress={handleGenerate}
                      isDisabled={status === "processing" || status === "pending"}
                    >
                      T2V
                    </Button>
                    <Button
                      className="h-7 bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                      onPress={handleGenerateReference}
                      isDisabled={!hasReference}
                    >
                      R2V
                    </Button>
                  </ButtonGroup>
                  <ButtonGroup
                    size="sm"
                    variant="tertiary"
                    fullWidth
                    className="w-full bg-neutral-900 text-neutral-50"
                  >
                    <Button
                      className="h-7 bg-neutral-900 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                      onPress={handleGenerateTailFrame}
                      isDisabled={!hasTailFrame || status === "processing" || status === "pending"}
                    >
                      tail frame
                    </Button>
                    <Button
                      className="h-7 bg-neutral-900 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                      onPress={handleGenerateStartEnd}
                      isDisabled={!hasStartEnd || status === "processing" || status === "pending"}
                    >
                      start + end
                    </Button>
                  </ButtonGroup>
                </>
              ) : row.id === "audio" ? (
                <ButtonGroup
                  variant="tertiary"
                  size="sm"
                  className="bg-neutral-600 text-neutral-50"
                >
                  <Button
                    isIconOnly
                    aria-label="Save prompt"
                    className="h-7 w-7 min-w-7 bg-neutral-600 text-neutral-50"
                    onPress={handleSave}
                  >
                    <Icon path={saveIcon} size={0.7} />
                  </Button>
                  <Button
                    className="h-7 bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                    onPress={handleGenerate}
                    isDisabled={status === "processing" || status === "pending"}
                  >
                    T2S
                  </Button>
                  <Button
                    className="h-7 bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                    onPress={handleGenerateLipSync}
                    isDisabled={!hasLipSync || status === "processing" || status === "pending"}
                  >
                    LIP
                  </Button>
                </ButtonGroup>
              ) : row.id === "edit-image" ? (
                <ButtonGroup
                  variant="tertiary"
                  size="sm"
                  className="bg-neutral-600 text-neutral-50"
                >
                  <Button
                    isIconOnly
                    aria-label="Save prompt"
                    className="h-7 w-7 min-w-7 bg-neutral-600 text-neutral-50"
                    onPress={handleSave}
                  >
                    <Icon path={saveIcon} size={0.7} />
                  </Button>
                  <Button
                    className="h-7 bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                    onPress={handleGenerate}
                    isDisabled={!hasSourceInput || status === "processing" || status === "pending"}
                  >
                    source
                  </Button>
                  <Button
                    className="h-7 bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                    onPress={handleGenerateCurrent}
                    isDisabled={!hasCurrent || status === "processing" || status === "pending"}
                  >
                    current
                  </Button>
                </ButtonGroup>
              ) : row.id === "source-image" ? (
                <ButtonGroup
                  variant="tertiary"
                  size="sm"
                  className="bg-neutral-600 text-neutral-50"
                >
                  <Button
                    isIconOnly
                    aria-label="Save prompt"
                    className="h-7 w-7 min-w-7 bg-neutral-600 text-neutral-50"
                    onPress={handleSave}
                  >
                    <Icon path={saveIcon} size={0.7} />
                  </Button>
                  <Button
                    className="h-7 bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
                    onPress={handleGenerate}
                    isDisabled={status === "processing" || status === "pending"}
                  >
                    T2I
                  </Button>
                </ButtonGroup>
              ) : (
                <ButtonGroup
                  size="sm"
                  variant="tertiary"
                  className="bg-neutral-900 text-neutral-50"
                >
                  <Button
                    isIconOnly
                    aria-label="Generate asset"
                    className="h-7 w-7 min-w-7 bg-neutral-900 text-neutral-50"
                    onPress={handleGenerate}
                    isDisabled={status === "processing" || status === "pending"}
                  >
                    <Icon path={generateIcon} size={0.8} />
                  </Button>
                </ButtonGroup>
              )}
            </div>
          </div>
        ) : (
          row.id === "source-clip" ? null : (
            <div className="flex flex-1 items-center justify-center rounded-xl bg-neutral-50 text-[11px] text-neutral-600">
              No asset
            </div>
          )
        )}
      </div>
    </div>
  );
};
