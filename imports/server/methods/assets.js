import { Meteor } from 'meteor/meteor'
import { AssetsCollection } from '/imports/api/assets'
import { ShotsCollection } from '/imports/api/shots'
import { falSubscribe, falStorageUpload } from '/imports/server/fal/client'
import { ASSET_TASKS } from '/imports/configs/tasks/assets'
import { runAssetTask } from '/imports/server/ai/run-task'

const ACTIVE_FIELD_BY_ROW = {
  'source-clip': 'activeSourceVideoId',
  'source-image': 'activeSourceImageId',
  'edit-image': 'activeEditedImageId',
  'output-video': 'activeOutputVideoId',
  audio: 'activeSourceAudioId'
}

const getActiveField = (rowId) => ACTIVE_FIELD_BY_ROW[rowId]

const findActiveAssetByRow = async ({ shotId, rowId }) => {
  const activeField = getActiveField(rowId)
  if (!activeField) return null
  const shot = await ShotsCollection.findOneAsync(shotId)
  const assetId = shot?.[activeField]
  if (!assetId) return null
  return AssetsCollection.findOneAsync(assetId)
}

const toAbsoluteUrl = (url) => {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const root =
    process.env.ROOT_URL ||
    Meteor.absoluteUrl().replace(/\/$/, '')
  if (url.startsWith('/')) return `${root}${url}`
  return `${root}/${url}`
}

const uploadFromUrl = async (url) => {
  const absoluteUrl = toAbsoluteUrl(url)
  const response = await fetch(absoluteUrl)
  if (!response.ok) {
    throw new Meteor.Error('assets.edit.fetchFailed', 'Failed to fetch source.')
  }
  const contentType =
    response.headers.get('content-type') || 'application/octet-stream'
  const arrayBuffer = await response.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: contentType })
  return falStorageUpload(blob)
}

const setActiveAsset = async ({ shotId, rowId, assetId }) => {
  const activeField = getActiveField(rowId)
  if (!activeField) return
  await ShotsCollection.updateAsync(shotId, {
    $set: { [activeField]: assetId, updatedAt: new Date() }
  })
}

const createPendingAsset = async ({ storyboardId, shotId, rowId, prompt }) => {
  const assetId = await AssetsCollection.insertAsync({
    storyboardId,
    shotId,
    rowId,
    prompt: String(prompt).trim(),
    status: 'pending',
    createdAt: new Date()
  })
  await setActiveAsset({ shotId, rowId, assetId })
  return assetId
}

const markAssetStatus = async (assetId, status, extra = {}) => {
  await AssetsCollection.updateAsync(assetId, {
    $set: { status, updatedAt: new Date(), ...extra }
  })
}

const saveGeneratedAsset = async ({ assetId, prompt, image }) => {
  await AssetsCollection.updateAsync(assetId, {
    $set: {
      prompt: String(prompt).trim(),
      url: image.url,
      meta: {
        content_type: image.content_type,
        file_name: image.file_name,
        file_size: image.file_size,
        width: image.width,
        height: image.height
      },
      status: 'completed',
      updatedAt: new Date()
    }
  })
}

const saveGeneratedAudio = async ({ assetId, prompt, audio }) => {
  await AssetsCollection.updateAsync(assetId, {
    $set: {
      prompt: String(prompt).trim(),
      url: audio.url,
      meta: {
        content_type: audio.content_type,
        file_name: audio.file_name,
        file_size: audio.file_size,
        duration_ms: audio.duration_ms
      },
      status: 'completed',
      updatedAt: new Date()
    }
  })
}

const saveGeneratedVideo = async ({ assetId, prompt, video }) => {
  await AssetsCollection.updateAsync(assetId, {
    $set: {
      prompt: String(prompt).trim(),
      url: video.url,
      meta: {
        content_type: video.content_type,
        file_name: video.file_name,
        file_size: video.file_size,
        width: video.width,
        height: video.height
      },
      status: 'completed',
      updatedAt: new Date()
    }
  })
}

const normalizeDataUri = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const trimmed = value.trim()
  if (trimmed.startsWith('data:')) return trimmed
  return `data:image/png;base64,${trimmed}`
}

Meteor.methods({
  async 'assets.create' ({ storyboardId, shotId, rowId, prompt, url, meta }) {
    if (!storyboardId || !shotId || !rowId) {
      throw new Meteor.Error('assets.create.invalid', 'Invalid payload.')
    }

    return AssetsCollection.insertAsync({
      storyboardId,
      shotId,
      rowId,
      prompt: typeof prompt === 'string' ? prompt.trim() : '',
      url: typeof url === 'string' ? url.trim() : '',
      meta: meta || {},
      createdAt: new Date()
    })
  },
  async 'assets.update' ({ assetId, prompt, url, meta }) {
    if (!assetId) {
      throw new Meteor.Error('assets.update.invalid', 'Invalid payload.')
    }

    const updates = {}
    if (typeof prompt === 'string') updates.prompt = prompt.trim()
    if (typeof url === 'string') updates.url = url.trim()
    if (meta && typeof meta === 'object') updates.meta = meta
    updates.updatedAt = new Date()

    await AssetsCollection.updateAsync(assetId, { $set: updates })
  },
  async 'assets.remove' ({ assetId }) {
    if (!assetId) {
      throw new Meteor.Error('assets.remove.invalid', 'Invalid payload.')
    }
    await AssetsCollection.removeAsync(assetId)
  },
  async 'assets.setActive' ({ shotId, rowId, assetId }) {
    if (!shotId || !rowId || !assetId) {
      throw new Meteor.Error('assets.setActive.invalid', 'Invalid payload.')
    }

    const asset = await AssetsCollection.findOneAsync({
      _id: assetId,
      shotId,
      rowId
    })
    if (!asset) {
      throw new Meteor.Error('assets.setActive.missing', 'Asset not found.')
    }

    const activeField = ACTIVE_FIELD_BY_ROW[rowId]
    if (!activeField) {
      throw new Meteor.Error('assets.setActive.invalidRow', 'Invalid rowId.')
    }

    await ShotsCollection.updateAsync(shotId, {
      $set: { [activeField]: assetId, updatedAt: new Date() }
    })
  },
  async 'assets.generate' ({ storyboardId, shotId, rowId, prompt, model, aspectRatio, resolution }) {
    if (!storyboardId || !shotId || !rowId || !prompt) {
      throw new Meteor.Error('assets.generate.invalid', 'Invalid payload.')
    }

    const normalizedPrompt = String(prompt).trim()
    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt: normalizedPrompt })
    await markAssetStatus(assetId, 'processing')

    try {
      const generated = await runAssetTask({
        task: ASSET_TASKS.TEXT_TO_IMAGE,
        model,
        shotId,
        params: {
          prompt: normalizedPrompt,
          aspectRatio,
          resolution
        },
        falSubscribe
      })
      await saveGeneratedAsset({ assetId, prompt: normalizedPrompt, image: generated.asset })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'generation-failed'
      })
      throw error
    }
  },
  async 'assets.edit' ({ storyboardId, shotId, rowId, prompt, imageBase64s, model }) {
    if (!storyboardId || !shotId || !rowId || !prompt) {
      throw new Meteor.Error('assets.edit.invalid', 'Invalid payload.')
    }
    if (!Array.isArray(imageBase64s) || imageBase64s.length === 0) {
      throw new Meteor.Error('assets.edit.invalidImages', 'Missing images.')
    }

    const imageUrls = imageBase64s
      .map(normalizeDataUri)
      .filter(Boolean)
    if (imageUrls.length === 0) {
      throw new Meteor.Error('assets.edit.invalidImages', 'Invalid images.')
    }

    const normalizedPrompt = String(prompt).trim()
    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt: normalizedPrompt })
    await markAssetStatus(assetId, 'processing')

    try {
      const generated = await runAssetTask({
        task: ASSET_TASKS.IMAGE_EDIT,
        model,
        shotId,
        params: {
          prompt: normalizedPrompt,
          images: imageUrls
        },
        falSubscribe
      })
      await saveGeneratedAsset({ assetId, prompt: normalizedPrompt, image: generated.asset })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'edit-failed'
      })
      throw error
    }
  },
  async 'assets.editFromActive' ({ storyboardId, shotId, rowId, sourceRowId, prompt, model }) {
    if (!storyboardId || !shotId || !rowId || !prompt || !sourceRowId) {
      throw new Meteor.Error('assets.editFromActive.invalid', 'Invalid payload.')
    }

    const sourceAsset = await findActiveAssetByRow({ shotId, rowId: sourceRowId })
    if (!sourceAsset && !getActiveField(sourceRowId)) {
      throw new Meteor.Error('assets.editFromActive.invalidRow', 'Invalid source row.')
    }
    if (!sourceAsset?._id) {
      throw new Meteor.Error('assets.editFromActive.missing', 'Missing source asset.')
    }
    if (!sourceAsset?.url) {
      throw new Meteor.Error('assets.editFromActive.missing', 'Missing source URL.')
    }

    const normalizedPrompt = String(prompt).trim()
    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt: normalizedPrompt })
    await markAssetStatus(assetId, 'processing')

    try {
      const generated = await runAssetTask({
        task: ASSET_TASKS.IMAGE_EDIT,
        model,
        shotId,
        preferredImageRows: [sourceRowId],
        params: {
          prompt: normalizedPrompt
        },
        findActiveAssetByRow,
        uploadFromUrl,
        falSubscribe
      })
      await saveGeneratedAsset({ assetId, prompt: normalizedPrompt, image: generated.asset })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'edit-failed'
      })
      throw error
    }
  },
  async 'assets.tts' ({ storyboardId, shotId, rowId, prompt, model }) {
    if (!storyboardId || !shotId || !rowId || !prompt) {
      throw new Meteor.Error('assets.tts.invalid', 'Invalid payload.')
    }

    const normalizedPrompt = String(prompt).trim()
    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt: normalizedPrompt })
    await markAssetStatus(assetId, 'processing')

    try {
      const generated = await runAssetTask({
        task: ASSET_TASKS.TTS,
        model,
        shotId,
        params: {
          prompt: normalizedPrompt
        },
        falSubscribe
      })
      await saveGeneratedAudio({ assetId, prompt: normalizedPrompt, audio: generated.asset })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'tts-failed'
      })
      throw error
    }
  },
  async 'assets.textToVideo' ({ storyboardId, shotId, rowId, prompt, model, aspectRatio, duration }) {
    if (!storyboardId || !shotId || !rowId || !prompt) {
      throw new Meteor.Error('assets.textToVideo.invalid', 'Invalid payload.')
    }

    const normalizedPrompt = String(prompt).trim()
    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt: normalizedPrompt })
    await markAssetStatus(assetId, 'processing')

    try {
      const generated = await runAssetTask({
        task: ASSET_TASKS.TEXT_TO_VIDEO,
        model,
        shotId,
        params: {
          prompt: normalizedPrompt,
          aspectRatio,
          duration
        },
        falSubscribe
      })
      await saveGeneratedVideo({ assetId, prompt: normalizedPrompt, video: generated.asset })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'text-to-video-failed'
      })
      throw error
    }
  },
  async 'assets.referenceToVideo' ({ storyboardId, shotId, rowId, prompt, model, aspectRatio, duration, resolution, audio, seed, image, imageUrl, images, imageUrls }) {
    if (!storyboardId || !shotId || !rowId || !prompt) {
      throw new Meteor.Error('assets.referenceToVideo.invalid', 'Invalid payload.')
    }

    const normalizedPrompt = String(prompt).trim()
    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt: normalizedPrompt })
    await markAssetStatus(assetId, 'processing')

    try {
      const generated = await runAssetTask({
        task: ASSET_TASKS.IMAGE_TO_VIDEO,
        model,
        shotId,
        preferredImageRows: ['edit-image', 'source-image'],
        params: {
          prompt: normalizedPrompt,
          aspectRatio,
          duration,
          resolution,
          audio,
          seed,
          image,
          imageUrl,
          images,
          imageUrls
        },
        findActiveAssetByRow,
        uploadFromUrl,
        falSubscribe
      })
      await saveGeneratedVideo({ assetId, prompt: normalizedPrompt, video: generated.asset })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'reference-to-video-failed'
      })
      throw error
    }
  }
})
