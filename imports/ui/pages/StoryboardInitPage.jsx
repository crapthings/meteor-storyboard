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
import {
  AlertDialog,
  Button,
  Dropdown,
  Label,
  Modal,
} from "@heroui/react";
import { StoryboardsCollection } from "../../api/storyboards.js";
import { ShotsCollection } from "../../api/shots.js";
import { AssetsCollection } from "../../api/assets.js";
import { AssetCard } from "../components/AssetCard.jsx";
import { FAL_TEXT_TO_IMAGE_MODELS } from "../../configs/models/fal/text-to-image.js";
import { FAL_IMAGE_EDIT_MODELS } from "../../configs/models/fal/image-edit.js";
import { FAL_VIDEO_MODELS } from "../../configs/models/fal/video.js";
import { FAL_SPEECH_MODELS } from "../../configs/models/fal/speech.js";

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

const MODEL_PICKER_COLUMNS = [
  {
    id: "textToImage",
    label: "text to image",
    options: Object.values(FAL_TEXT_TO_IMAGE_MODELS),
    defaultModel: FAL_TEXT_TO_IMAGE_MODELS.default?.key,
  },
  {
    id: "imageEdit",
    label: "image edit",
    options: Object.values(FAL_IMAGE_EDIT_MODELS),
    defaultModel: FAL_IMAGE_EDIT_MODELS.default?.key,
  },
  {
    id: "textToVideo",
    label: "text to video",
    options: Object.values(FAL_VIDEO_MODELS).filter(
      (model) => model.task === "text_to_video"
    ),
    defaultModel: FAL_VIDEO_MODELS.textToVideo?.key,
  },
  {
    id: "imageToVideo",
    label: "image to video",
    options: Object.values(FAL_VIDEO_MODELS).filter(
      (model) => model.task === "image_to_video"
    ),
    defaultModel: FAL_VIDEO_MODELS.imageToVideo?.key,
  },
  {
    id: "speech",
    label: "speech",
    options: Object.values(FAL_SPEECH_MODELS),
    defaultModel: FAL_SPEECH_MODELS.default?.key,
  },
];

const getModelLabel = (model) => {
  if (!model?.modelId) return model?.key || "model";
  const parts = model.modelId.split("/");
  return parts.slice(-2).join("/");
};

const getAudioDurationInSeconds = (file) =>
  new Promise((resolve) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeAttribute("src");
      audio.load();
    };

    const handleLoaded = () => {
      const duration = Number(audio.duration);
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        resolve(null);
        return;
      }
      resolve(Math.round(duration));
    };

    const handleError = () => {
      cleanup();
      resolve(null);
    };

    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", handleLoaded, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.src = objectUrl;
  });

const ShotColumn = ({
  shot,
  children,
  onRename,
  onDelete,
}) => {
  const renameInputRef = useRef(null);
  const renameTriggerRef = useRef(null);
  const deleteTriggerRef = useRef(null);
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
      className={`flex w-[260px] min-w-[260px] shrink-0 flex-col bg-neutral-50 ${
        isOver ? "bg-neutral-300" : "bg-neutral-50"
      }`}
    >
      <div
        ref={setNodeRef}
        style={style}
        className={`relative flex flex-col gap-1 bg-neutral-600 px-4 py-3 text-neutral-50 ${
          isDragging ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div
            ref={setActivatorNodeRef}
            className="flex cursor-grab flex-col"
            {...listeners}
            {...attributes}
          >
            <span className="text-sm font-semibold text-neutral-50">
              {shot.name || "Shot"}
            </span>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-200">
              Drag to reorder
            </div>
          </div>
          <Dropdown>
            <Button
              isIconOnly
              variant="tertiary"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-50 text-neutral-900 transition hover:bg-neutral-300"
              aria-label="Shot menu"
              onPress={(event) => event?.stopPropagation?.()}
            >
              <span className="text-lg leading-none">⋯</span>
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={(key) => {
                  if (key === "rename") renameTriggerRef.current?.click();
                  if (key === "delete") deleteTriggerRef.current?.click();
                }}
              >
                <Dropdown.Item id="rename" textValue="Rename">
                  <Label>Rename</Label>
                </Dropdown.Item>
                <Dropdown.Item id="delete" textValue="Delete">
                  <Label>Delete</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>
      <Modal>
        <Modal.Trigger>
          <button ref={renameTriggerRef} type="button" className="hidden">
            Rename
          </button>
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[420px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  Rename this shot
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Shot name
                  </label>
                  <input
                    defaultValue={shot.name || "Shot"}
                    className="w-full bg-neutral-300 px-4 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-600"
                    type="text"
                    name="shot-name"
                    ref={renameInputRef}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button
                  slot="close"
                  variant="tertiary"
                  onPress={() => {
                    const nextName = renameInputRef.current?.value?.trim();
                    if (nextName) {
                      onRename(shot, nextName);
                    }
                  }}
                >
                  Save
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Modal>
        <Modal.Trigger>
          <button ref={deleteTriggerRef} type="button" className="hidden">
            Delete
          </button>
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[420px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  Delete this shot?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-neutral-600">
                  This will permanently remove the shot and its assets.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button slot="close" variant="tertiary" onPress={() => onDelete(shot)}>
                  Delete
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
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
        <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
          Name
        </label>
        <input
          className="bg-neutral-300 px-4 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-600"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Storyboard name"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
          Description
        </label>
        <textarea
          className="min-h-[120px] bg-neutral-300 px-4 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-600"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the storyboard content..."
        />
      </div>
      <div className="grid gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
          Aspect Ratio
        </label>
        <select
          className="bg-neutral-300 px-4 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-600"
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
          variant="tertiary"
          onPress={onClose}
          className="rounded-full px-5"
        >
          Cancel
        </Button>
        <Button
          variant="tertiary"
          type="submit"
          isDisabled={isSaving}
          className="rounded-full bg-neutral-900 px-5 text-neutral-50 hover:bg-neutral-600"
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
  const modelSelections = activeStoryboard?.modelSelections || {};

  const getSelectedModel = (columnId) => {
    const column = MODEL_PICKER_COLUMNS.find((item) => item.id === columnId);
    if (!column) return null;
    return modelSelections[columnId] || column.defaultModel || null;
  };

  const handleModelSelectionChange = async (columnId, value) => {
    if (!storyboardId) return;
    const next = {
      ...modelSelections,
      [columnId]: value,
    };
    await Meteor.callAsync("storyboards.update", {
      storyboardId,
      modelSelections: next,
    });
  };

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
        model: getSelectedModel("speech"),
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
        model: getSelectedModel("textToVideo"),
      });
      return;
    }
    if (rowId === "edit-image") {
      await Meteor.callAsync("assets.editFromActive", {
        storyboardId,
        shotId,
        rowId,
        sourceRowId: "source-image",
        model: getSelectedModel("imageEdit"),
        ...updates,
      });
      return;
    }
    await Meteor.callAsync("assets.generate", {
      storyboardId,
      shotId,
      rowId,
      model: getSelectedModel("textToImage"),
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
      model: getSelectedModel("imageToVideo"),
    });
  };

  const handleGenerateCurrentAsset = async (shotId, rowId, updates) => {
    if (!storyboardId) return;
    if (rowId !== "edit-image") return;
    await Meteor.callAsync("assets.editFromActive", {
      storyboardId,
      shotId,
      rowId,
      sourceRowId: "edit-image",
      model: getSelectedModel("imageEdit"),
      ...updates,
    });
  };

  const handleUploadAsset = async (shotId, rowId, file) => {
    if (!storyboardId || !file) return;
    const durationSeconds =
      rowId === "audio" ? await getAudioDurationInSeconds(file) : null;
    const response = await fetch("/api/assets/upload", {
      method: "POST",
      headers: {
        "x-storyboard-id": storyboardId,
        "x-shot-id": shotId,
        "x-row-id": rowId,
        ...(durationSeconds
          ? { "x-duration-seconds": String(durationSeconds) }
          : {}),
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
    if (response.ok) {
      const data = await response.json();
      if (!data?.assetId) return;
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
    if (!nextName || nextName.trim() === shot.name) return;
    await Meteor.callAsync("shots.update", {
      shotId: shot._id,
      name: nextName.trim(),
    });
  };

  const handleDeleteShot = async (shot) => {
    await Meteor.callAsync("shots.remove", { shotId: shot._id });
  };

  return (
    <div className="flex w-full flex-col gap-6 bg-neutral-50 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 bg-neutral-900 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-50">
              {activeStoryboard?.name || "Storyboard"}
            </h1>
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
            <div className="flex items-center gap-2 rounded-full bg-neutral-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-50">
              <span>Ratio</span>
              <div className="flex overflow-hidden rounded-full bg-neutral-50">
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
                        ? "bg-neutral-900 text-neutral-50"
                        : "text-neutral-700 hover:bg-neutral-300"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="tertiary"
              onPress={handleAddShot}
              className="rounded-full bg-neutral-50 px-5 text-neutral-900 hover:bg-neutral-300"
            >
              Add Shot
            </Button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-600 text-neutral-50 transition hover:bg-neutral-300 hover:text-neutral-900"
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
              <AlertDialog.Trigger className="flex items-center gap-2 rounded-full bg-neutral-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-50 transition hover:bg-neutral-300 hover:text-neutral-900">
                Clear Shots
              </AlertDialog.Trigger>
              <AlertDialog.Backdrop>
                <AlertDialog.Container>
                  <AlertDialog.Dialog className="sm:max-w-[420px]">
                    <AlertDialog.CloseTrigger />
                    <AlertDialog.Header>
                      <AlertDialog.Icon status="accent" />
                      <AlertDialog.Heading>
                        Clear all shots?
                      </AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p className="text-sm text-neutral-600">
                        This will permanently delete all shots and assets in this storyboard.
                        Type the storyboard name to confirm.
                      </p>
                      <input
                        className="mt-4 w-full bg-neutral-300 px-4 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-600"
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
                        variant="tertiary"
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

      {activeStoryboard ? (
        <section className="bg-neutral-200 p-2">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {MODEL_PICKER_COLUMNS.map((column) => (
              <div key={column.id} className="bg-neutral-50 p-2">
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">
                  {column.label}
                </label>
                <select
                  className="w-full bg-neutral-200 px-2 py-2 text-xs text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-600"
                  value={getSelectedModel(column.id) || ""}
                  onChange={(event) =>
                    handleModelSelectionChange(column.id, event.target.value)
                  }
                >
                  {column.options.map((model) => (
                    <option key={model.key} value={model.key}>
                      {getModelLabel(model)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 truncate text-[10px] text-neutral-500">
                  {
                    (column.options.find(
                      (option) =>
                        option.key === (getSelectedModel(column.id) || "")
                    ) || column.options[0])?.modelId
                  }
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isStoryboardsLoading() || isShotsLoading() || isAssetsLoading() ? (
        <div className="bg-neutral-300 px-6 py-10 text-sm text-neutral-700">
          Loading storyboard...
        </div>
      ) : !activeStoryboard ? (
        <div className="bg-neutral-300 px-6 py-10 text-sm text-neutral-700">
          Storyboard not found.
        </div>
      ) : (
        <div className="bg-neutral-300 p-2">
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {displayShots.length === 0 ? (
                <div className="w-[260px] min-w-[260px] bg-neutral-50 px-6 py-10 text-sm text-neutral-700">
                  No shots yet. Add one to start.
                </div>
              ) : (
                displayShots.map((shot) => (
                  <ShotColumn
                    key={shot._id}
                    shot={shot}
                    onRename={handleRenameShot}
                    onDelete={handleDeleteShot}
                  >
                    <div className="flex flex-col gap-2 p-2">
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
                            onGenerateCurrent={(updates) =>
                              handleGenerateCurrentAsset(shot._id, row.id, updates)
                            }
                            hasCurrent={Boolean(asset?._id)}
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
                <div className="w-[260px] min-w-[260px] bg-neutral-50">
                  <div className="bg-neutral-600 px-4 py-3">
                    <div className="text-sm font-semibold text-neutral-50">
                      {displayShots.find((shot) => shot._id === activeShotId)
                        ?.name || "Shot"}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-200">
                      Moving
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 p-2">
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
        </div>
      )}

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-neutral-900/40"
            onClick={() => setIsSettingsOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-neutral-50 p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-600">
                  Settings
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-900">
                  Storyboard settings
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500"
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
            className="absolute inset-0 bg-neutral-900/40"
            onClick={() => setHistoryTarget(null)}
          />
          <div className="relative w-full max-w-4xl rounded-3xl bg-neutral-50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-600">
                  History
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-900">
                  Asset history
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Current prompt:{" "}
                  <span className="font-semibold text-neutral-700">
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
                className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500"
              >
                Close
              </button>
            </div>
            {historyTarget.rowId === "audio" ? (
              <div className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-2xl bg-neutral-100 px-4 py-4">
                  {historySelectedId ? (
                    <audio controls className="w-full">
                      <source
                        src={assetsById.get(historySelectedId)?.url || ""}
                      />
                    </audio>
                  ) : (
                    <div className="flex h-16 items-center justify-center text-sm text-neutral-400">
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
                      className={`group overflow-hidden rounded-2xl bg-neutral-100 text-left transition ${
                        historySelectedId === asset._id
                          ? "ring-1 ring-neutral-400"
                          : ""
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
                        <div className="flex h-24 items-center justify-center text-sm text-neutral-400">
                          No waveform
                        </div>
                      )}
                      <div className="grid gap-2 px-3 py-3 text-xs text-neutral-600">
                        <div className="font-semibold text-neutral-900">
                          {asset.prompt || "No prompt"}
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600 opacity-0 transition group-hover:opacity-100">
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
                <div className="overflow-hidden rounded-2xl bg-neutral-900">
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
                    <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
                      No video selected
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-500">
                    Select a clip below to activate it or capture a frame.
                  </p>
                  <Button
                    variant="tertiary"
                    className="rounded-full bg-neutral-900 px-5 text-white hover:bg-neutral-800"
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
                      className={`group overflow-hidden rounded-2xl bg-neutral-100 text-left transition ${
                        historySelectedId === asset._id
                          ? "ring-1 ring-neutral-400"
                          : ""
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
                        <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
                          No thumbnail
                        </div>
                      )}
                      <div className="grid gap-2 px-3 py-3 text-xs text-neutral-600">
                        <div className="font-semibold text-neutral-900">
                          {asset.prompt || "No prompt"}
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600 opacity-0 transition group-hover:opacity-100">
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
                    className="group cursor-pointer overflow-hidden rounded-2xl bg-neutral-100 transition"
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
                      <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
                        No preview
                      </div>
                    )}
                    <div className="grid gap-2 px-3 py-3 text-xs text-neutral-600">
                      <div className="font-semibold text-neutral-900">
                        {asset.prompt || "No prompt"}
                      </div>
                      <div className="text-neutral-500">
                        {asset.meta?.width && asset.meta?.height
                          ? `${asset.meta.width}×${asset.meta.height}`
                          : "Unknown size"}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600 opacity-0 transition group-hover:opacity-100">
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
