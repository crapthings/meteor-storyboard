import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Meteor } from "meteor/meteor";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { useNavigate, useParams } from "react-router";
import {
  AlertDialog,
  Button,
  Dropdown,
  Label,
  ListBox,
  Modal,
  Select,
} from "@heroui/react";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  WavOutputFormat,
  Output,
} from "mediabunny";
import { StoryboardsCollection } from "../../api/storyboards.js";
import { ShotsCollection } from "../../api/shots.js";
import { AssetsCollection } from "../../api/assets.js";
import { AssetCard } from "../components/AssetCard.jsx";
import { FAL_TEXT_TO_IMAGE_MODELS } from "../../configs/models/fal/text-to-image.js";
import { FAL_IMAGE_EDIT_MODELS } from "../../configs/models/fal/image-edit.js";
import { FAL_IMAGE_TO_LIPSYNC_MODELS } from "../../configs/models/fal/image-to-lipsync.js";
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

const MEDIA_KIND_BY_ROW = {
  "source-clip": "video",
  "output-video": "video",
  "source-image": "image",
  "edit-image": "image",
  audio: "audio",
};

const getRowMediaKind = (rowId) => MEDIA_KIND_BY_ROW[rowId] || null;

const getAssetMediaKind = (asset) => {
  const contentType = asset?.meta?.content_type;
  if (typeof contentType === "string") {
    if (contentType.startsWith("image/")) return "image";
    if (contentType.startsWith("video/")) return "video";
    if (contentType.startsWith("audio/")) return "audio";
  }
  return getRowMediaKind(asset?.rowId);
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
      (model) =>
        model.task === "image_to_video" &&
        !model?.capabilities?.startEndFrame
    ),
    defaultModel: FAL_VIDEO_MODELS.imageToVideo?.key,
  },
  {
    id: "startEndVideo",
    label: "first/last frame video",
    options: Object.values(FAL_VIDEO_MODELS).filter(
      (model) =>
        model.task === "image_to_video" &&
        Boolean(model?.capabilities?.startEndFrame)
    ),
    defaultModel: FAL_VIDEO_MODELS.veo31FastFirstLastFrameToVideo?.key,
  },
  {
    id: "speech",
    label: "text to speech",
    options: Object.values(FAL_SPEECH_MODELS),
    defaultModel: FAL_SPEECH_MODELS.default?.key,
  },
  {
    id: "imageLipSync",
    label: "image to lipsync",
    options: Object.values(FAL_IMAGE_TO_LIPSYNC_MODELS),
    defaultModel: FAL_IMAGE_TO_LIPSYNC_MODELS.klingAvatarV2Standard?.key,
  },
];

const getModelLabel = (model) => {
  if (!model?.modelId) return model?.key || "model";
  return model.modelId;
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

const buildAudioFilenameFromVideo = (filename = "audio.mp4") => {
  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  return `${base}.wav`;
};

const extractAudioFromMp4File = async (file) => {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
  const output = new Output({
    format: new WavOutputFormat(),
    target: new BufferTarget(),
  });

  try {
    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      audio: { codec: "pcm-s16", forceTranscode: true },
      showWarnings: false,
    });
    if (!conversion.isValid) {
      throw new Error("Audio extraction is not supported in this browser environment.");
    }
    await conversion.execute();
    const buffer = output.target.buffer;
    return new File([buffer], buildAudioFilenameFromVideo(file.name), {
      type: "audio/wav",
    });
  } finally {
    if (typeof input.dispose === "function") {
      await input.dispose();
    }
  }
};

const createBlackFrameDataUrl = (aspectRatio = "16:9") => {
  const canvas = document.createElement("canvas");
  if (aspectRatio === "9:16") {
    canvas.width = 720;
    canvas.height = 1280;
  } else {
    canvas.width = 1280;
    canvas.height = 720;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

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
    id: `shot:${shot._id}`,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `shot:${shot._id}`,
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
  const navigate = useNavigate();
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
  const [activeAssetDragId, setActiveAssetDragId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historySelectedId, setHistorySelectedId] = useState(null);
  const historyVideoRef = useRef(null);
  const sourceVideoInputRef = useRef(null);
  const sourceImageInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [clearConfirmValue, setClearConfirmValue] = useState("");
  const [modelPickerQueryByColumn, setModelPickerQueryByColumn] = useState({});
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const getModelPickerQuery = (columnId) => modelPickerQueryByColumn[columnId] || "";

  const setModelPickerQuery = (columnId, value) => {
    setModelPickerQueryByColumn((current) => ({
      ...current,
      [columnId]: value,
    }));
  };

  const getFilteredModelOptions = (column) => {
    const query = getModelPickerQuery(column.id).trim().toLowerCase();
    if (!query) return column.options;
    return column.options.filter((option) => {
      const label = getModelLabel(option).toLowerCase();
      return label.includes(query);
    });
  };

  const normalizeSelectValue = (value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value[0] || null;
    return null;
  };

  const assetsById = useMemo(() => {
    return new Map(assets.map((asset) => [asset._id, asset]));
  }, [assets]);

  const resolveLinkedAsset = (asset, depth = 0) => {
    if (!asset) return asset;
    if (depth > 4) return asset;
    const linkedAssetId = asset.linkedAssetId || asset.duplicatedFromAssetId;
    if (!linkedAssetId) return asset;
    const linked = assetsById.get(linkedAssetId);
    if (!linked) return asset;
    const resolvedLinked = resolveLinkedAsset(linked, depth + 1);
    const hasUrl = typeof asset.url === "string" && asset.url.trim().length > 0;
    const hasThumbnail =
      typeof asset.thumbnailUrl === "string" && asset.thumbnailUrl.trim().length > 0;
    const hasWaveform =
      typeof asset.waveformUrl === "string" && asset.waveformUrl.trim().length > 0;

    return {
      ...resolvedLinked,
      ...asset,
      url: hasUrl ? asset.url : resolvedLinked?.url || "",
      thumbnailUrl: hasThumbnail
        ? asset.thumbnailUrl
        : resolvedLinked?.thumbnailUrl || "",
      waveformUrl: hasWaveform
        ? asset.waveformUrl
        : resolvedLinked?.waveformUrl || "",
      meta:
        asset?.meta && Object.keys(asset.meta).length > 0
          ? asset.meta
          : resolvedLinked?.meta || {},
    };
  };

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

  const activeDraggedAsset = activeAssetDragId
    ? assetsById.get(activeAssetDragId) || null
    : null;

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
    const activeId = String(event?.active?.id || "");
    if (!activeId) return;
    if (activeId.startsWith("asset:")) {
      setActiveAssetDragId(activeId.replace("asset:", ""));
      return;
    }
    if (activeId.startsWith("shot:")) {
      setActiveShotId(activeId.replace("shot:", ""));
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    const activeId = String(active?.id || "");
    const overId = String(over?.id || "");

    if (activeId.startsWith("asset:")) {
      setActiveAssetDragId(null);
      if (!overId.startsWith("slot:")) return;

      const sourceAssetId = activeId.replace("asset:", "");
      const targetParts = overId.split(":");
      const targetShotId = targetParts[1];
      const targetRowId = targetParts[2];
      if (!sourceAssetId || !targetShotId || !targetRowId) return;

      const sourceAsset = assetsById.get(sourceAssetId);
      if (!sourceAsset) return;
      if (sourceAsset.shotId === targetShotId && sourceAsset.rowId === targetRowId) {
        return;
      }
      const sourceKind = getAssetMediaKind(sourceAsset);
      const targetKind = getRowMediaKind(targetRowId);
      if (!sourceKind || !targetKind || sourceKind !== targetKind) return;

      await Meteor.callAsync("assets.duplicate", {
        storyboardId,
        sourceAssetId,
        targetShotId,
        targetRowId,
      });
      return;
    }

    setActiveShotId(null);
    if (!over) return;
    if (!active?.id || !over?.id) return;
    if (active.id === over.id) return;
    if (!activeId.startsWith("shot:") || !overId.startsWith("shot:")) return;
    const activeShot = activeId.replace("shot:", "");
    const overShot = overId.replace("shot:", "");
    const activeIndex = displayShots.findIndex((shot) => shot._id === activeShot);
    const overIndex = displayShots.findIndex((shot) => shot._id === overShot);
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

  const handleGenerateLipSyncAsset = async (shotId, rowId, updates) => {
    if (!storyboardId) return;
    if (rowId !== "audio") return;
    await Meteor.callAsync("assets.lipSyncImage", {
      storyboardId,
      shotId,
      prompt: updates.prompt,
      model: getSelectedModel("imageLipSync"),
    });
  };

  const handleUploadAsset = async (shotId, rowId, file) => {
    if (!storyboardId || !file) return;
    let uploadFile = file;
    if (
      rowId === "audio" &&
      typeof file.type === "string" &&
      file.type.toLowerCase() === "video/mp4"
    ) {
      uploadFile = await extractAudioFromMp4File(file);
    }
    const durationSeconds =
      rowId === "audio" ? await getAudioDurationInSeconds(uploadFile) : null;
    const response = await fetch("/api/assets/upload", {
      method: "POST",
      headers: {
        "x-storyboard-id": storyboardId,
        "x-shot-id": shotId,
        "x-row-id": rowId,
        ...(durationSeconds
          ? { "x-duration-seconds": String(durationSeconds) }
          : {}),
        "Content-Type": uploadFile.type || "application/octet-stream",
      },
      body: uploadFile,
    });
    if (response.ok) {
      const data = await response.json();
      if (!data?.assetId) return;
    }
  };

  const handleUpdateVideoMetadata = async (shotId, rowId, payload = {}) => {
    const shot = shots.find((item) => item._id === shotId);
    if (!shot) return;
    const asset = getActiveAsset(shot, rowId);
    if (!asset?._id) return;

    const duration = Number(payload.duration);
    const width = Number(payload.width);
    const height = Number(payload.height);
    const fps = Number(payload.fps);
    const nextMeta = {
      ...(asset.meta || {}),
      ...(Number.isFinite(width) && width > 0 ? { width } : {}),
      ...(Number.isFinite(height) && height > 0 ? { height } : {}),
      ...(Number.isFinite(duration) && duration > 0
        ? { duration_seconds: Math.round(duration) }
        : {}),
      ...(Number.isFinite(fps) && fps > 0 ? { fps } : {}),
    };

    await Meteor.callAsync("assets.update", {
      assetId: asset._id,
      meta: nextMeta,
      ...(Number.isFinite(duration) && duration > 0
        ? { duration: Math.round(duration) }
        : {}),
    });
  };

  const getActiveAsset = (shot, rowId) => {
    const activeField = ACTIVE_FIELD_BY_ROW[rowId];
    const activeId = activeField ? shot?.[activeField] : null;
    if (activeId && assetsById.has(activeId)) {
      return resolveLinkedAsset(assetsById.get(activeId));
    }
    const list = assetsByShotRowList.get(`${shot._id}:${rowId}`) || [];
    return resolveLinkedAsset(list[0] || null);
  };

  const getPrimaryImageAsset = (shot) => {
    if (!shot) return null;
    return getActiveAsset(shot, "edit-image") || getActiveAsset(shot, "source-image");
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

  const handleGenerateTailFrameVideo = async (shotId, updates) => {
    if (!storyboardId) return;
    const shot = shots.find((item) => item._id === shotId);
    if (!shot) return;
    const endAsset = getPrimaryImageAsset(shot);
    if (!endAsset?.url) return;

    const blackFrameDataUrl = createBlackFrameDataUrl(
      activeStoryboard?.aspectRatio || "16:9"
    );
    if (!blackFrameDataUrl) return;

    await Meteor.callAsync("assets.referenceToVideo", {
      storyboardId,
      shotId,
      rowId: "output-video",
      prompt: updates.prompt,
      model: getSelectedModel("startEndVideo"),
      image: blackFrameDataUrl,
      endImage: endAsset.url,
    });
  };

  const handleGenerateStartEndVideo = async (shotId, updates) => {
    if (!storyboardId) return;
    const shotIndex = displayShots.findIndex((item) => item._id === shotId);
    if (shotIndex < 0) return;
    const currentShot = displayShots[shotIndex];
    const nextShot = displayShots[shotIndex + 1];
    if (!currentShot || !nextShot) return;

    const startAsset = getPrimaryImageAsset(currentShot);
    const endAsset = getPrimaryImageAsset(nextShot);
    if (!startAsset?.url || !endAsset?.url) return;

    await Meteor.callAsync("assets.referenceToVideo", {
      storyboardId,
      shotId,
      rowId: "output-video",
      prompt: updates.prompt,
      model: getSelectedModel("startEndVideo"),
      image: startAsset.url,
      endImage: endAsset.url,
    });
  };

  const getHistoryAssets = (target) => {
    if (!target) return [];
    const list = assetsByShotRowList.get(`${target.shotId}:${target.rowId}`) || [];
    return list.map((asset) => resolveLinkedAsset(asset));
  };

  const getHistoryActiveAsset = (target) => {
    if (!target) return null;
    const shot = shots.find((item) => item._id === target.shotId);
    if (!shot) return null;
    return getActiveAsset(shot, target.rowId);
  };

  const handleDeleteHistoryAsset = async ({ shotId, rowId, assetId }) => {
    const shot = shots.find((item) => item._id === shotId);
    if (!shot) return;
    const current = getActiveAsset(shot, rowId);
    if (current?._id === assetId) return;

    await Meteor.callAsync("assets.remove", { assetId });
    if (historySelectedId === assetId) {
      setHistorySelectedId(current?._id || null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 bg-neutral-50 p-2">
      <header className="flex flex-col gap-2 bg-neutral-900 p-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="tertiary"
              size="sm"
              className="h-8 rounded-full bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50"
              onPress={() => navigate("/")}
            >
              Back
            </Button>
            <h1 className="text-xl font-semibold text-neutral-50">
              {activeStoryboard?.name || "Storyboard"}
            </h1>
          </div>
        <div className="flex items-center gap-2">
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
              size="sm"
              onPress={handleAddShot}
              className="h-8 rounded-full bg-neutral-50 px-3 text-[10px] text-neutral-900 hover:bg-neutral-300"
            >
              Add Shot
            </Button>
            <div className="flex h-8 items-center gap-2 rounded-full bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50">
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
                    className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition ${
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
              size="sm"
              className="h-8 rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
              onPress={() => sourceVideoInputRef.current?.click()}
              isDisabled={isImporting}
            >
              Import Source Video
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              className="h-8 rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
              onPress={() => sourceImageInputRef.current?.click()}
              isDisabled={isImporting}
            >
              Import Source Image
            </Button>
            <AlertDialog>
              <AlertDialog.Trigger className="flex h-8 items-center gap-2 rounded-full bg-neutral-600 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-50 transition hover:bg-neutral-300 hover:text-neutral-900">
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
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-600 text-neutral-50 transition hover:bg-neutral-300 hover:text-neutral-900"
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
          </div>
        </div>
      </header>

      {activeStoryboard ? (
        <section className="bg-neutral-200 p-2">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            {MODEL_PICKER_COLUMNS.map((column) => (
              <div key={column.id} className="bg-neutral-50 p-2">
                <Select
                  className="w-full"
                  value={getSelectedModel(column.id) || column.defaultModel || null}
                  onChange={(value) => {
                    const nextValue = normalizeSelectValue(value);
                    if (nextValue) {
                      handleModelSelectionChange(column.id, nextValue);
                    }
                  }}
                  placeholder="Select model"
                >
                  <Label>{column.label}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <div className="p-2">
                      <input
                        type="text"
                        value={getModelPickerQuery(column.id)}
                        onChange={(event) =>
                          setModelPickerQuery(column.id, event.target.value)
                        }
                        placeholder="Search model..."
                        className="w-full bg-neutral-200 px-2 py-1 text-xs text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-600"
                      />
                    </div>
                    <ListBox>
                      {getFilteredModelOptions(column).map((model) => (
                        <ListBox.Item
                          key={model.key}
                          id={model.key}
                          textValue={getModelLabel(model)}
                        >
                          {getModelLabel(model)}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
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
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
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
                        const shotIndex = displayShots.findIndex(
                          (item) => item._id === shot._id
                        );
                        const nextShot =
                          shotIndex >= 0 ? displayShots[shotIndex + 1] : null;
                        const hasTailFrame =
                          row.id === "output-video"
                            ? Boolean(getPrimaryImageAsset(shot)?._id)
                            : false;
                        const hasStartEnd =
                          row.id === "output-video"
                            ? Boolean(getPrimaryImageAsset(shot)?._id) &&
                              Boolean(getPrimaryImageAsset(nextShot)?._id)
                            : false;
                        const audioInputAsset = getActiveAsset(shot, "audio");
                        const lipSyncImageAsset = getPrimaryImageAsset(shot);
                        const hasLipSync =
                          row.id === "audio"
                            ? Boolean(audioInputAsset?.url) &&
                              Boolean(lipSyncImageAsset?.url)
                            : false;
                        const sourceImageAsset = getActiveAsset(shot, "source-image");
                        const hasSourceImageInput =
                          row.id === "edit-image"
                            ? Boolean(sourceImageAsset?.url) &&
                              getAssetMediaKind(sourceImageAsset) === "image"
                            : false;
                        const isSameDropSlot = activeDraggedAsset
                          ? activeDraggedAsset.shotId === shot._id &&
                            activeDraggedAsset.rowId === row.id
                          : false;
                        const canDropAsset =
                          activeDraggedAsset
                            ? getAssetMediaKind(activeDraggedAsset) ===
                                getRowMediaKind(row.id) && !isSameDropSlot
                            : false;
                        return (
                          <AssetCard
                            key={row.id}
                            shotId={shot._id}
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
                            onGenerateLipSync={(updates) =>
                              handleGenerateLipSyncAsset(shot._id, row.id, updates)
                            }
                            onGenerateTailFrame={(updates) =>
                              handleGenerateTailFrameVideo(shot._id, updates)
                            }
                            onGenerateStartEnd={(updates) =>
                              handleGenerateStartEndVideo(shot._id, updates)
                            }
                            hasReference={Boolean(referenceAsset)}
                            hasTailFrame={hasTailFrame}
                            hasStartEnd={hasStartEnd}
                            hasLipSync={hasLipSync}
                            hasSourceInput={hasSourceImageInput}
                            canDropAsset={canDropAsset}
                            isDropEnabled={Boolean(activeDraggedAsset)}
                            onUpdateVideoMetadata={(payload) =>
                              handleUpdateVideoMetadata(shot._id, row.id, payload)
                            }
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
                        shotId={activeShotId}
                        row={row}
                        asset={null}
                        onSave={() => {}}
                        onGenerate={() => {}}
                        onGenerateCurrent={() => {}}
                        onGenerateTailFrame={() => {}}
                        onGenerateStartEnd={() => {}}
                        onGenerateReference={() => {}}
                        onGenerateLipSync={() => {}}
                        hasReference={false}
                        hasCurrent={false}
                        hasSourceInput={false}
                        hasTailFrame={false}
                        hasStartEnd={false}
                        hasLipSync={false}
                        canDropAsset={false}
                        isDropEnabled={false}
                        onUpdateVideoMetadata={() => {}}
                        onOpenHistory={() => {}}
                        onUpload={() => {}}
                      />
                    ))}
                  </div>
                </div>
              ) : activeDraggedAsset ? (
                <div className="w-[260px] min-w-[260px] overflow-hidden bg-neutral-50 shadow-sm">
                  <div className="bg-neutral-600 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-50">
                    {ROWS.find((row) => row.id === activeDraggedAsset.rowId)?.label || "asset"}
                  </div>
                  {getAssetMediaKind(activeDraggedAsset) === "audio" ? (
                    activeDraggedAsset.waveformUrl ? (
                      <img
                        src={activeDraggedAsset.waveformUrl}
                        alt="Audio ghost"
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center bg-neutral-200 text-xs text-neutral-500">
                        Audio
                      </div>
                    )
                  ) : getAssetMediaKind(activeDraggedAsset) === "video" ? (
                    activeDraggedAsset.thumbnailUrl ? (
                      <img
                        src={activeDraggedAsset.thumbnailUrl}
                        alt="Video ghost"
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center bg-neutral-200 text-xs text-neutral-500">
                        Video
                      </div>
                    )
                  ) : activeDraggedAsset.url ? (
                    <img
                      src={activeDraggedAsset.url}
                      alt="Image ghost"
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-neutral-200 text-xs text-neutral-500">
                      Image
                    </div>
                  )}
                  <div className="truncate px-3 py-2 text-[11px] text-neutral-700">
                    {activeDraggedAsset.prompt || "No prompt"}
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
          <div className="relative w-full max-w-5xl bg-neutral-50 p-4 sm:p-5">
            {(() => {
              const historyAssets = getHistoryAssets(historyTarget);
              const activeAsset = getHistoryActiveAsset(historyTarget);
              const activeAssetId = activeAsset?._id || null;
              const isVideoRow =
                historyTarget.rowId === "source-clip" ||
                historyTarget.rowId === "output-video";
              const isAudioRow = historyTarget.rowId === "audio";

              return (
                <>
                  <div className="flex items-start justify-between gap-3 bg-neutral-200 p-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">
                        Asset Preview
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-neutral-900">
                        Active asset
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {isVideoRow ? (
                        <Button
                          variant="tertiary"
                          className="rounded-full bg-neutral-900 px-3 text-xs text-neutral-50"
                          onPress={handleCaptureFrame}
                        >
                          Capture frame
                        </Button>
                      ) : null}
                      <Button
                        variant="tertiary"
                        className="rounded-full bg-neutral-300 px-3 text-xs text-neutral-700"
                        onPress={() => setHistoryTarget(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 bg-neutral-100 p-3">
                    {isAudioRow ? (
                      activeAsset?.url ? (
                        <audio controls className="w-full">
                          <source src={activeAsset.url} />
                        </audio>
                      ) : (
                        <div className="flex h-20 items-center justify-center text-sm text-neutral-500">
                          No active audio
                        </div>
                      )
                    ) : isVideoRow ? (
                      activeAsset?.url ? (
                        <video
                          ref={historyVideoRef}
                          src={activeAsset.url}
                          controls
                          className="h-72 w-full bg-neutral-900 object-contain"
                        />
                      ) : (
                        <div className="flex h-72 items-center justify-center text-sm text-neutral-500">
                          No active video
                        </div>
                      )
                    ) : activeAsset?.url ? (
                      <img
                        src={activeAsset.url}
                        alt="Active asset"
                        className="h-72 w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-72 items-center justify-center text-sm text-neutral-500">
                        No active image
                      </div>
                    )}
                  </div>

                  <div className="mt-2 bg-neutral-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-700">
                        History Assets
                      </h3>
                      <span className="text-xs text-neutral-500">
                        {historyAssets.length} item(s)
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {historyAssets.map((asset) => {
                        const isActive = activeAssetId === asset._id;
                        return (
                          <div
                            key={asset._id}
                            className={`cursor-pointer bg-neutral-50 p-2 ${
                              isActive ? "ring-1 ring-neutral-700" : ""
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
                            {isAudioRow ? (
                              asset.waveformUrl ? (
                                <img
                                  src={asset.waveformUrl}
                                  alt="Audio waveform"
                                  className="h-20 w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-20 items-center justify-center bg-neutral-200 text-xs text-neutral-500">
                                  No waveform
                                </div>
                              )
                            ) : isVideoRow ? (
                              asset.thumbnailUrl ? (
                                <img
                                  src={asset.thumbnailUrl}
                                  alt="Video thumbnail"
                                  className="h-20 w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-20 items-center justify-center bg-neutral-200 text-xs text-neutral-500">
                                  No thumbnail
                                </div>
                              )
                            ) : asset.url ? (
                              <img
                                src={asset.url}
                                alt="Image history"
                                className="h-20 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-20 items-center justify-center bg-neutral-200 text-xs text-neutral-500">
                                No preview
                              </div>
                            )}

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="truncate text-xs text-neutral-700">
                                {asset.prompt || "No prompt"}
                              </span>
                              {!isActive ? (
                                <Button
                                  size="sm"
                                  variant="tertiary"
                                  className="rounded-full bg-neutral-900 px-2 text-[10px] text-neutral-50"
                                  onPress={(event) => {
                                    event?.stopPropagation?.();
                                    handleDeleteHistoryAsset({
                                      shotId: historyTarget.shotId,
                                      rowId: historyTarget.rowId,
                                      assetId: asset._id,
                                    });
                                  }}
                                >
                                  Delete
                                </Button>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-600">
                                  Active
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
};
