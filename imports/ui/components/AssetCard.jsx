import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import Icon from "@mdi/react";
import {
  mdiContentSave,
  mdiWandSparkles,
  mdiHistory,
  mdiImage,
  mdiImageEdit,
  mdiUpload,
  mdiFormatText,
} from "@mdi/js";
import WaveSurfer from "wavesurfer.js";
import { Input, ALL_FORMATS, UrlSource, CanvasSink } from "mediabunny";

export const AssetCard = ({
  row,
  asset,
  historyCount,
  onSave,
  onGenerate,
  onGenerateReference,
  hasReference,
  onOpenHistory,
  onUpload,
}) => {
  const fileInputRef = useRef(null);
  const [prompt, setPrompt] = useState(asset?.prompt || "");
  const waveformRef = useRef(null);
  const waveformInstanceRef = useRef(null);
  const [isWaveformUploading, setIsWaveformUploading] = useState(false);
  const [isThumbnailUploading, setIsThumbnailUploading] = useState(false);

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
      waveColor: "#34d399",
      progressColor: "#059669",
      height: 48,
      barWidth: 2,
      barGap: 2,
      url: asset.url,
    });
    waveformInstanceRef.current = wavesurfer;

    wavesurfer.on("ready", async () => {
      try {
        const shadow = container.shadowRoot;
        const canvas =
          shadow?.querySelector("canvas") || container.querySelector("canvas");
        if (!canvas) return;
        const dataUrl = canvas.toDataURL("image/png");
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
    if (asset?.thumbnailUrl) return;
    if (isThumbnailUploading) return;

    const video = document.createElement("video");
    video.src = asset.url;
    video.preload = "metadata";

    const handleLoadedMetadata = async () => {
      try {
        setIsThumbnailUploading(true);
        const input = new Input({
          source: new UrlSource(asset.url),
          formats: ALL_FORMATS,
        });
        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) return;
        if (videoTrack.codec === null) return;
        if (!(await videoTrack.canDecode())) return;

        const targetSize = 320;
        const width =
          videoTrack.displayWidth > videoTrack.displayHeight
            ? targetSize
            : Math.floor(
                (targetSize * videoTrack.displayWidth) /
                  videoTrack.displayHeight
              );
        const height =
          videoTrack.displayHeight > videoTrack.displayWidth
            ? targetSize
            : Math.floor(
                (targetSize * videoTrack.displayHeight) /
                  videoTrack.displayWidth
              );

        const sink = new CanvasSink(videoTrack, {
          width: Math.floor(width * window.devicePixelRatio),
          height: Math.floor(height * window.devicePixelRatio),
          fit: "fill",
        });
        const firstTimestamp = await videoTrack.getFirstTimestamp();
        for await (const wrappedCanvas of sink.canvasesAtTimestamps([
          firstTimestamp,
        ])) {
          if (!wrappedCanvas) return;
          const canvasElement = wrappedCanvas.canvas;
          const dataUrl = canvasElement.toDataURL("image/png");
          await fetch("/api/assets/thumbnail", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assetId: asset._id,
              dataUrl,
            }),
          });
          return;
        }
      } finally {
        setIsThumbnailUploading(false);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata, {
      once: true,
    });

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [asset?._id, asset?.thumbnailUrl, asset?.url, isThumbnailUploading, row.id]);

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

  const status = asset?.status || "idle";
  const statusTone =
    status === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "processing"
        ? "bg-amber-100 text-amber-700"
        : status === "pending"
          ? "bg-slate-100 text-slate-600"
          : status === "error"
            ? "bg-rose-100 text-rose-700"
            : "bg-slate-100 text-slate-600";

  const headerIcon =
    row.id === "source-image" ? mdiImage : row.id === "edit-image" ? mdiImageEdit : null;

  const actionIcon = mdiFormatText;

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

  return (
    <div className="flex min-h-[120px] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/70">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center justify-between border-b border-emerald-100 bg-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
        <span className="inline-flex items-center gap-2">
          {headerIcon ? <Icon path={headerIcon} size={0.7} /> : null}
          {row.label}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            isIconOnly
            variant="bordered"
            aria-label="Upload asset"
            className="h-7 w-7 rounded-full"
            onPress={handleUploadClick}
          >
            <Icon path={mdiUpload} size={0.7} />
          </Button>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${statusTone}`}
          >
            {status}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-3">
        <button
          type="button"
          className="overflow-hidden rounded-xl border border-emerald-100 bg-white text-left"
          onClick={onOpenHistory}
        >
          {row.id === "audio" && asset?.url ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 bg-emerald-50 px-3">
              {asset?.waveformUrl ? (
                <img
                  src={asset.waveformUrl}
                  alt="Waveform preview"
                  className="h-12 w-full rounded-lg object-cover"
                />
              ) : (
                <div
                  ref={waveformRef}
                  className="h-12 w-full overflow-hidden rounded-lg bg-white"
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
              <div className="flex h-32 items-center justify-center bg-emerald-50 text-xs text-emerald-400">
                {isThumbnailUploading ? "Generating thumbnail..." : "No thumbnail yet"}
              </div>
            )
          ) : asset?.url ? (
            <img
              src={asset.url}
              alt={`${row.label} preview`}
              className="h-32 w-full object-cover"
            />
          ) : (
            <div className="flex h-32 items-center justify-center bg-emerald-50 text-xs text-emerald-400">
              No preview yet
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-emerald-600">
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
              className="min-h-[70px] w-full resize-none rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              placeholder="Enter prompt..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="bordered"
                isIconOnly
                aria-label="Save prompt"
                className="rounded-full"
                onPress={handleSave}
              >
                <Icon path={actionIcon} size={0.8} />
              </Button>
              {row.id === "output-video" ? (
                <>
                  <Button
                    size="sm"
                    variant="tertiary"
                    className="rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                    onPress={handleGenerate}
                    isDisabled={status === "processing" || status === "pending"}
                  >
                    T2V
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    className="rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                    onPress={handleGenerateReference}
                    isDisabled={!hasReference}
                  >
                    R2V
                  </Button>
                </>
              ) : row.id === "audio" ? (
                <>
                  <Button
                    size="sm"
                    variant="tertiary"
                    className="rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                    onPress={handleGenerate}
                    isDisabled={status === "processing" || status === "pending"}
                  >
                    T2S
                  </Button>
                </>
              ) : row.id === "edit-image" ? (
                <Button
                  size="sm"
                  variant="tertiary"
                  className="rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                  onPress={handleGenerate}
                  isDisabled={status === "processing" || status === "pending"}
                >
                  I2IE
                </Button>
              ) : row.id === "source-image" ? (
                <Button
                  size="sm"
                  variant="tertiary"
                  className="rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                  onPress={handleGenerate}
                  isDisabled={status === "processing" || status === "pending"}
                >
                  T2I
                </Button>
              ) : (
                <Button
                  size="sm"
                  isIconOnly
                  aria-label="Generate asset"
                  className="rounded-full"
                  color="success"
                  onPress={handleGenerate}
                  isDisabled={status === "processing" || status === "pending"}
                >
                  <Icon path={actionIcon} size={0.8} />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-white/70 text-[11px] text-emerald-600">
            No asset
          </div>
        )}
      </div>
    </div>
  );
};
