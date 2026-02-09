import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Meteor } from "meteor/meteor";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { useParams } from "react-router";
import { AlertDialog, Button } from "@heroui/react";
import { StoryboardsCollection } from "../../api/storyboards.js";
import { ShotsCollection } from "../../api/shots.js";
import { AssetsCollection } from "../../api/assets.js";
import { AssetCard } from "../components/AssetCard.jsx";

const ROWS = [
  {
    id: "source-clip",
    label: "source video",
    hint: "Original video source",
    hasPrompt: false,
  },
  {
    id: "source-image",
    label: "source image",
    hint: "Frames extracted from the source video",
    hasPrompt: true,
  },
  {
    id: "edit-image",
    label: "edited image",
    hint: "Image-to-image based on the source image",
    hasPrompt: true,
  },
  {
    id: "output-video",
    label: "to video",
    hint: "Source material for video generation",
    hasPrompt: true,
  },
  {
    id: "audio",
    label: "audio",
    hint: "Voiceover / TTS audio",
    hasPrompt: true,
  },
];

const ACTIVE_FIELD_BY_ROW = {
  "source-clip": "activeSourceVideoId",
  "source-image": "activeSourceImageId",
  "edit-image": "activeEditedImageId",
  "output-video": "activeOutputVideoId",
  audio: "activeSourceAudioId",
};

const ShotColumn = ({
  shot,
  children,
  isMenuOpen,
  onToggleMenu,
  onRename,
  onDelete,
}) => {
  const renameInputRef = useRef(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: shot._id,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: shot._id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setDropRef}
      className={`flex min-w-[240px] flex-col rounded-3xl border bg-white shadow-sm ${
        isOver ? "border-emerald-300" : "border-slate-200"
      }`}
    >
      <div
        ref={setNodeRef}
        style={style}
        className={`relative flex flex-col gap-1 rounded-t-3xl border-b border-slate-200 bg-emerald-50 px-4 py-3 ${
          isDragging ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div
            ref={setActivatorNodeRef}
            className="flex cursor-grab flex-col"
            {...listeners}
            {...attributes}
          >
            <span className="text-sm font-semibold text-slate-900">
              {shot.name || "Shot"}
            </span>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-600">
              Drag to reorder
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleMenu(shot._id);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-100 bg-white/80 text-emerald-600 shadow-sm transition hover:border-emerald-300"
            aria-label="Shot menu"
          >
            <span className="text-lg leading-none">⋯</span>
          </button>
        </div>
        {isMenuOpen ? (
          <div
            className="absolute right-3 top-12 z-20 w-32 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-xl"
            onClick={(event) => event.stopPropagation()}
            onMouseLeave={() => onToggleMenu(null)}
          >
            <AlertDialog>
              <AlertDialog.Trigger className="w-full rounded-xl px-3 py-2 text-left text-slate-700 transition hover:bg-emerald-50">
                Rename
              </AlertDialog.Trigger>
              <AlertDialog.Backdrop>
                <AlertDialog.Container>
                  <AlertDialog.Dialog className="sm:max-w-[420px]">
                    <AlertDialog.CloseTrigger />
                    <AlertDialog.Header>
                      <AlertDialog.Icon status="accent" />
                      <AlertDialog.Heading>
                        Rename this shot
                      </AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <div className="grid gap-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Shot name
                        </label>
                        <input
                          defaultValue={shot.name || "Shot"}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                          type="text"
                          name="shot-name"
                          ref={renameInputRef}
                        />
                      </div>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button slot="close" variant="tertiary">
                        Cancel
                      </Button>
                      <Button
                        slot="close"
                        onPress={(event) => {
                          const nextName = renameInputRef.current?.value?.trim();
                          if (nextName) {
                            onRename(shot, nextName);
                          }
                        }}
                      >
                        Save
                      </Button>
                    </AlertDialog.Footer>
                  </AlertDialog.Dialog>
                </AlertDialog.Container>
              </AlertDialog.Backdrop>
            </AlertDialog>
            <AlertDialog>
              <AlertDialog.Trigger className="w-full rounded-xl px-3 py-2 text-left text-rose-600 transition hover:bg-rose-50">
                Delete
              </AlertDialog.Trigger>
              <AlertDialog.Backdrop>
                <AlertDialog.Container>
                  <AlertDialog.Dialog className="sm:max-w-[420px]">
                    <AlertDialog.CloseTrigger />
                    <AlertDialog.Header>
                      <AlertDialog.Icon status="danger" />
                      <AlertDialog.Heading>
                        Delete this shot?
                      </AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p className="text-sm text-slate-600">
                        This will permanently remove the shot and its assets.
                      </p>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button slot="close" variant="tertiary">
                        Cancel
                      </Button>
                      <Button
                        slot="close"
                        variant="danger"
                        onPress={() => onDelete(shot)}
                      >
                        Delete
                      </Button>
                    </AlertDialog.Footer>
                  </AlertDialog.Dialog>
                </AlertDialog.Container>
              </AlertDialog.Backdrop>
            </AlertDialog>
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
};

const StoryboardPropsForm = ({ storyboard, onClose }) => {
  const [name, setName] = useState(storyboard?.name || "");
  const [description, setDescription] = useState(
    storyboard?.description || ""
  );
  const [aspectRatio, setAspectRatio] = useState(
    storyboard?.aspectRatio || "16:9"
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(storyboard?.name || "");
    setDescription(storyboard?.description || "");
    setAspectRatio(storyboard?.aspectRatio || "16:9");
  }, [storyboard?._id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!storyboard?._id || isSaving) return;
    setIsSaving(true);
    try {
      await Meteor.callAsync("storyboards.update", {
        storyboardId: storyboard._id,
        name,
        description,
        aspectRatio,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Name
        </label>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Storyboard name"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Description
        </label>
        <textarea
          className="min-h-[120px] rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the storyboard content..."
        />
      </div>
      <div className="grid gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Aspect Ratio
        </label>
        <select
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
          value={aspectRatio}
          onChange={(event) => setAspectRatio(event.target.value)}
        >
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
        </select>
      </div>
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="bordered"
          onPress={onClose}
          className="rounded-full px-5"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isDisabled={isSaving}
          className="rounded-full px-5"
          color="success"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
};

export const StoryboardInitPage = () => {
  const { storyboardId } = useParams();
  const isStoryboardsLoading = useSubscribe("storyboards");
  const isShotsLoading = useSubscribe("shots", storyboardId);
  const isAssetsLoading = useSubscribe("assets", storyboardId);
  const storyboards = useFind(() =>
    StoryboardsCollection.find({}, { sort: { order: 1 } })
  );
  const shots = useFind(() =>
    ShotsCollection.find({ storyboardId }, { sort: { order: 1, createdAt: 1 } })
  );
  const assets = useFind(() =>
    AssetsCollection.find({ storyboardId }, { sort: { createdAt: 1 } })
  );
  const [orderedIds, setOrderedIds] = useState(null);
  const [activeShotId, setActiveShotId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openMenuShotId, setOpenMenuShotId] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historySelectedId, setHistorySelectedId] = useState(null);
  const historyVideoRef = useRef(null);
  const sourceVideoInputRef = useRef(null);
  const sourceImageInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [clearConfirmValue, setClearConfirmValue] = useState("");

  const activeStoryboard = storyboards.find(
    (storyboard) => storyboard._id === storyboardId
  );

  const assetsById = useMemo(() => {
    return new Map(assets.map((asset) => [asset._id, asset]));
  }, [assets]);

  const assetsByShotRowList = useMemo(() => {
    const lookup = new Map();
    for (const asset of assets) {
      const key = `${asset.shotId}:${asset.rowId}`;
      const list = lookup.get(key) || [];
      list.push(asset);
      lookup.set(key, list);
    }
    for (const [key, list] of lookup.entries()) {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      lookup.set(key, list);
    }
    return lookup;
  }, [assets]);

  const displayShots = useMemo(() => {
    if (!orderedIds) return shots;
    const lookup = new Map(shots.map((shot) => [shot._id, shot]));
    return orderedIds.map((id) => lookup.get(id)).filter(Boolean);
  }, [orderedIds, shots]);

  useEffect(() => {
    if (!orderedIds) return;
    const currentIds = shots.map((shot) => shot._id).join("|");
    const desiredIds = orderedIds.join("|");
    if (currentIds === desiredIds) {
      setOrderedIds(null);
    }
  }, [orderedIds, shots]);

  const handleAddShot = async () => {
    if (!storyboardId) return;
    await Meteor.callAsync("shots.create", { storyboardId });
  };

  const createShotAndUpload = async (rowId, file, index) => {
    const shotId = await Meteor.callAsync("shots.create", {
      storyboardId,
      name: `Shot ${shots.length + index + 1}`,
      order: shots.length + index,
    });
    await handleUploadAsset(shotId, rowId, file);
  };

  const handleImportSourceVideo = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !storyboardId) return;
    setIsImporting(true);
    try {
      await Promise.all(
        files.map((file, index) =>
          createShotAndUpload("source-clip", file, index)
        )
      );
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handleImportSourceImage = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !storyboardId) return;
    setIsImporting(true);
    try {
      await Promise.all(
        files.map((file, index) =>
          createShotAndUpload("source-image", file, index)
        )
      );
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handleDragStart = (event) => {
    if (event?.active?.id) {
      setActiveShotId(event.active.id);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveShotId(null);
    if (!over) return;
    if (!active?.id || !over?.id) return;
    if (active.id === over.id) return;
    const activeIndex = displayShots.findIndex((shot) => shot._id === active.id);
    const overIndex = displayShots.findIndex((shot) => shot._id === over.id);
    if (activeIndex === -1 || overIndex === -1) return;

    const nextShots = [...displayShots];
    const [moved] = nextShots.splice(activeIndex, 1);
    nextShots.splice(overIndex, 0, moved);
    const nextIds = nextShots.map((shot) => shot._id);
    setOrderedIds(nextIds);

    await Meteor.callAsync("shots.reorder", {
      storyboardId,
      orderedIds: nextIds,
    });
  };

  const handleSaveAsset = async (shotId, rowId, updates) => {
    if (!storyboardId) return;
    const shot = shots.find((item) => item._id === shotId);
    if (!shot) return;
    const existing = getActiveAsset(shot, rowId);
    if (existing) {
      await Meteor.callAsync("assets.update", {
        assetId: existing._id,
        ...updates,
      });
    } else {
      await Meteor.callAsync("assets.create", {
        storyboardId,
        shotId,
        rowId,
        ...updates,
      });
    }
  };

  const handleGenerateAsset = async (shotId, rowId, updates) => {
    if (!storyboardId) return;
    if (rowId === "audio") {
      await Meteor.callAsync("assets.tts", {
        storyboardId,
        shotId,
        rowId,
        ...updates,
      });
      return;
    }
    if (rowId === "output-video") {
      await Meteor.callAsync("assets.textToVideo", {
        storyboardId,
        shotId,
        rowId,
        prompt: updates.prompt,
      });
      return;
    }
    if (rowId === "edit-image") {
      await Meteor.callAsync("assets.editFromActive", {
        storyboardId,
        shotId,
        rowId,
        sourceRowId: "source-image",
        ...updates,
      });
      return;
    }
    await Meteor.callAsync("assets.generate", {
      storyboardId,
      shotId,
      rowId,
      ...updates,
    });
  };

  const handleGenerateReferenceAsset = async (shotId, rowId, updates) => {
    if (!storyboardId) return;
    if (rowId !== "output-video") return;
    await Meteor.callAsync("assets.referenceToVideo", {
      storyboardId,
      shotId,
      rowId,
      prompt: updates.prompt,
    });
  };

  const handleUploadAsset = async (shotId, rowId, file) => {
    if (!storyboardId || !file) return;
    const response = await fetch("/api/assets/upload", {
      method: "POST",
      headers: {
        "x-storyboard-id": storyboardId,
        "x-shot-id": shotId,
        "x-row-id": rowId,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.assetId) {
        await Meteor.callAsync("assets.setActive", {
          shotId,
          rowId,
          assetId: data.assetId,
        });
      }
    }
  };

  const getActiveAsset = (shot, rowId) => {
    const activeField = ACTIVE_FIELD_BY_ROW[rowId];
    const activeId = activeField ? shot?.[activeField] : null;
    if (activeId && assetsById.has(activeId)) {
      return assetsById.get(activeId);
    }
    const list = assetsByShotRowList.get(`${shot._id}:${rowId}`) || [];
    return list[0] || null;
  };

  const handleSetActiveAsset = async (shotId, rowId, assetId) => {
    await Meteor.callAsync("assets.setActive", {
      shotId,
      rowId,
      assetId,
    });
  };

  useEffect(() => {
    if (!historyTarget) return;
    const shot = shots.find((item) => item._id === historyTarget.shotId);
    if (!shot) return;
    const current = getActiveAsset(shot, historyTarget.rowId);
    setHistorySelectedId(current?._id || null);
  }, [historyTarget, shots]);

  const handleCaptureFrame = async () => {
    if (!historyTarget || !storyboardId) return;
    if (!historyVideoRef.current) return;
    const video = historyVideoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return;

    const formData = new FormData();
    formData.append("file", blob, "frame.png");
    await fetch("/api/assets/upload", {
      method: "POST",
      headers: {
        "x-storyboard-id": storyboardId,
        "x-shot-id": historyTarget.shotId,
        "x-row-id": "source-image",
      },
      body: formData,
    });
  };

  const handleRenameShot = async (shot, nextName) => {
    if (!nextName || nextName.trim() === shot.name) {
      setOpenMenuShotId(null);
      return;
    }
    await Meteor.callAsync("shots.update", {
      shotId: shot._id,
      name: nextName.trim(),
    });
    setOpenMenuShotId(null);
  };

  const handleDeleteShot = async (shot) => {
    await Meteor.callAsync("shots.remove", { shotId: shot._id });
    setOpenMenuShotId(null);
  };

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
              Storyboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              {activeStoryboard?.name || "Storyboard"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {activeStoryboard?.description ||
                "Draft the structure before attaching real assets."}
            </p>
          </div>
        <div className="flex items-center gap-3">
            <input
              ref={sourceVideoInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={handleImportSourceVideo}
            />
            <input
              ref={sourceImageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImportSourceImage}
            />
            <Button
              variant="tertiary"
              className="rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
              onPress={() => sourceVideoInputRef.current?.click()}
              isDisabled={isImporting}
            >
              Import Source Video
            </Button>
            <Button
              variant="tertiary"
              className="rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
              onPress={() => sourceImageInputRef.current?.click()}
              isDisabled={isImporting}
            >
              Import Source Image
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              <span>Ratio</span>
              <div className="flex overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                {["16:9", "9:16"].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() =>
                      Meteor.callAsync("storyboards.update", {
                        storyboardId,
                        aspectRatio: ratio,
                      })
                    }
                    className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                      (activeStoryboard?.aspectRatio || "16:9") === ratio
                        ? "bg-emerald-600 text-white"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onPress={handleAddShot}
              className="rounded-full px-5"
              color="success"
            >
              Add Shot
            </Button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-600"
              aria-label="Storyboard settings"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.4 15a1.6 1.6 0 0 0 .32 1.74l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15 19.4a1.6 1.6 0 0 0-1 .29 1.6 1.6 0 0 0-.66 1.3V21a2 2 0 1 1-4 0v-.01a1.6 1.6 0 0 0-1.66-1.59 1.6 1.6 0 0 0-1 .29l-.06.06A2 2 0 1 1 3.8 18.8l.06-.06A1.6 1.6 0 0 0 4.1 17a1.6 1.6 0 0 0-.29-1 1.6 1.6 0 0 0-1.3-.66H2.5a2 2 0 1 1 0-4h.01A1.6 1.6 0 0 0 4.1 9.7a1.6 1.6 0 0 0-.29-1l-.06-.06A2 2 0 1 1 6.6 5.8l.06.06A1.6 1.6 0 0 0 8.3 6.1a1.6 1.6 0 0 0 1-.29 1.6 1.6 0 0 0 .66-1.3V4.5a2 2 0 1 1 4 0v.01a1.6 1.6 0 0 0 1.66 1.59 1.6 1.6 0 0 0 1-.29l.06-.06A2 2 0 1 1 20.2 8.2l-.06.06a1.6 1.6 0 0 0-.29 1 1.6 1.6 0 0 0 .29 1 1.6 1.6 0 0 0 1.3.66H22a2 2 0 1 1 0 4h-.01a1.6 1.6 0 0 0-1.59 1.66Z"
                />
              </svg>
            </button>
            <AlertDialog>
              <AlertDialog.Trigger className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 shadow-sm transition hover:border-rose-200">
                Clear Shots
              </AlertDialog.Trigger>
              <AlertDialog.Backdrop>
                <AlertDialog.Container>
                  <AlertDialog.Dialog className="sm:max-w-[420px]">
                    <AlertDialog.CloseTrigger />
                    <AlertDialog.Header>
                      <AlertDialog.Icon status="danger" />
                      <AlertDialog.Heading>
                        Clear all shots?
                      </AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p className="text-sm text-slate-600">
                        This will permanently delete all shots and assets in this storyboard.
                        Type the storyboard name to confirm.
                      </p>
                      <input
                        className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                        placeholder={activeStoryboard?.name || "Storyboard name"}
                        value={clearConfirmValue}
                        onChange={(event) => setClearConfirmValue(event.target.value)}
                      />
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button slot="close" variant="tertiary">
                        Cancel
                      </Button>
                      <Button
                        slot="close"
                        variant="danger"
                        isDisabled={
                          clearConfirmValue.trim() !== (activeStoryboard?.name || "")
                        }
                        onPress={async () => {
                          await Meteor.callAsync("shots.clear", {
                            storyboardId,
                          });
                          setClearConfirmValue("");
                        }}
                      >
                        Delete All
                      </Button>
                    </AlertDialog.Footer>
                  </AlertDialog.Dialog>
                </AlertDialog.Container>
              </AlertDialog.Backdrop>
            </AlertDialog>
          </div>
        </div>
      </header>

      {isStoryboardsLoading() || isShotsLoading() || isAssetsLoading() ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Loading storyboard...
        </div>
      ) : !activeStoryboard ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
          Storyboard not found.
        </div>
      ) : (
        <>
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {displayShots.length === 0 ? (
                <div className="min-w-[240px] rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">
                  No shots yet. Add one to start.
                </div>
              ) : (
                displayShots.map((shot) => (
                  <ShotColumn
                    key={shot._id}
                    shot={shot}
                    isMenuOpen={openMenuShotId === shot._id}
                    onToggleMenu={(id) => setOpenMenuShotId(id)}
                    onRename={handleRenameShot}
                    onDelete={handleDeleteShot}
                  >
                    <div className="flex flex-col gap-3 p-4">
                      {ROWS.map((row) => {
                        const asset = getActiveAsset(shot, row.id);
                        const historyKey = `${shot._id}:${row.id}`;
                        const historyList = assetsByShotRowList.get(historyKey) || [];
                        const referenceAsset =
                          row.id === "output-video"
                            ? getActiveAsset(shot, "edit-image") ||
                              getActiveAsset(shot, "source-image")
                            : null;
                        return (
                          <AssetCard
                            key={row.id}
                            row={row}
                            asset={asset}
                            historyCount={historyList.length}
                            onSave={(updates) =>
                              handleSaveAsset(shot._id, row.id, updates)
                            }
                            onGenerate={(updates) =>
                              handleGenerateAsset(shot._id, row.id, updates)
                            }
                            onGenerateReference={(updates) =>
                              handleGenerateReferenceAsset(shot._id, row.id, updates)
                            }
                            hasReference={Boolean(referenceAsset)}
                            onOpenHistory={() =>
                              setHistoryTarget({
                                shotId: shot._id,
                                rowId: row.id,
                              })
                            }
                            onUpload={(file) =>
                              handleUploadAsset(shot._id, row.id, file)
                            }
                          />
                        );
                      })}
                    </div>
                  </ShotColumn>
                ))
              )}
            </div>
            <DragOverlay>
              {activeShotId ? (
                <div className="min-w-[240px] rounded-3xl border-2 border-dashed border-emerald-300 bg-white/90 shadow-xl">
                  <div className="rounded-t-3xl border-b border-slate-200 bg-emerald-50 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {displayShots.find((shot) => shot._id === activeShotId)
                        ?.name || "Shot"}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-600">
                      Moving
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    {ROWS.map((row) => (
                      <AssetCard
                        key={row.id}
                        row={row}
                        asset={null}
                        onSave={() => {}}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setIsSettingsOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                  Settings
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  Storyboard settings
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Close
              </button>
            </div>
            <StoryboardPropsForm
              storyboard={activeStoryboard}
              onClose={() => setIsSettingsOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {historyTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setHistoryTarget(null)}
          />
          <div className="relative w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                  History
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  Asset history
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Current prompt:{" "}
                  <span className="font-semibold text-slate-700">
                    {(() => {
                      const shot = shots.find(
                        (item) => item._id === historyTarget.shotId
                      );
                      if (!shot) return "—";
                      const current = getActiveAsset(
                        shot,
                        historyTarget.rowId
                      );
                      return current?.prompt || "—";
                    })()}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Close
              </button>
            </div>
            {historyTarget.rowId === "audio" ? (
              <div className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-emerald-50 px-4 py-4">
                  {historySelectedId ? (
                    <audio controls className="w-full">
                      <source
                        src={assetsById.get(historySelectedId)?.url || ""}
                      />
                    </audio>
                  ) : (
                    <div className="flex h-16 items-center justify-center text-sm text-slate-400">
                      No audio selected
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(assetsByShotRowList.get(
                    `${historyTarget.shotId}:${historyTarget.rowId}`
                  ) || []).map((asset) => (
                    <button
                      key={asset._id}
                      type="button"
                      className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${
                        historySelectedId === asset._id
                          ? "border-emerald-400"
                          : "border-slate-200"
                      }`}
                      onClick={() => {
                        setHistorySelectedId(asset._id);
                        handleSetActiveAsset(
                          historyTarget.shotId,
                          historyTarget.rowId,
                          asset._id
                        );
                      }}
                    >
                      {asset.waveformUrl ? (
                        <img
                          src={asset.waveformUrl}
                          alt="Audio waveform"
                          className="h-24 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-24 items-center justify-center text-sm text-slate-400">
                          No waveform
                        </div>
                      )}
                      <div className="grid gap-2 px-3 py-3 text-xs text-slate-600">
                        <div className="font-semibold text-slate-900">
                          {asset.prompt || "No prompt"}
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 opacity-0 transition group-hover:opacity-100">
                          Set active
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : historyTarget.rowId === "source-clip" ||
              historyTarget.rowId === "output-video" ? (
              <div className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
                  {historySelectedId ? (
                    <video
                      ref={historyVideoRef}
                      src={
                        assetsById.get(historySelectedId)?.url ||
                        assetsById.get(historySelectedId)?.thumbnailUrl ||
                        ""
                      }
                      controls
                      className="h-64 w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                      No video selected
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Select a clip below to activate it or capture a frame.
                  </p>
                  <Button
                    className="rounded-full px-5"
                    color="success"
                    onPress={handleCaptureFrame}
                  >
                    Capture current frame → source image
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(assetsByShotRowList.get(
                    `${historyTarget.shotId}:${historyTarget.rowId}`
                  ) || []).map((asset) => (
                    <button
                      key={asset._id}
                      type="button"
                      className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${
                        historySelectedId === asset._id
                          ? "border-emerald-400"
                          : "border-slate-200"
                      }`}
                      onClick={() => {
                        setHistorySelectedId(asset._id);
                        handleSetActiveAsset(
                          historyTarget.shotId,
                          historyTarget.rowId,
                          asset._id
                        );
                      }}
                    >
                      {asset.thumbnailUrl ? (
                        <img
                          src={asset.thumbnailUrl}
                          alt="Video thumbnail"
                          className="h-32 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                          No thumbnail
                        </div>
                      )}
                      <div className="grid gap-2 px-3 py-3 text-xs text-slate-600">
                        <div className="font-semibold text-slate-900">
                          {asset.prompt || "No prompt"}
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 opacity-0 transition group-hover:opacity-100">
                          Set active
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(assetsByShotRowList.get(
                  `${historyTarget.shotId}:${historyTarget.rowId}`
                ) || []).map((asset) => (
                  <div
                    key={asset._id}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                    onClick={() =>
                      handleSetActiveAsset(
                        historyTarget.shotId,
                        historyTarget.rowId,
                        asset._id
                      )
                    }
                  >
                    {asset.url ? (
                      <img
                        src={asset.url}
                        alt="Asset history"
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                        No preview
                      </div>
                    )}
                    <div className="grid gap-2 px-3 py-3 text-xs text-slate-600">
                      <div className="font-semibold text-slate-900">
                        {asset.prompt || "No prompt"}
                      </div>
                      <div className="text-slate-500">
                        {asset.meta?.width && asset.meta?.height
                          ? `${asset.meta.width}×${asset.meta.height}`
                          : "Unknown size"}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 opacity-0 transition group-hover:opacity-100">
                        Set active
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
