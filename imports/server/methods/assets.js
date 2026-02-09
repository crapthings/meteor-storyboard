import { Meteor } from 'meteor/meteor'
import { AssetsCollection } from '/imports/api/assets'
import { ShotsCollection } from '/imports/api/shots'
import { falSubscribe, falStorageUpload } from '/imports/server/fal/client'

const ACTIVE_FIELD_BY_ROW = {
  'source-clip': 'activeSourceVideoId',
  'source-image': 'activeSourceImageId',
  'edit-image': 'activeEditedImageId',
  'output-video': 'activeOutputVideoId',
  audio: 'activeSourceAudioId'
}

const getActiveField = (rowId) => ACTIVE_FIELD_BY_ROW[rowId]

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

const getActiveAssetByRow = async ({ shotId, rowId }) => {
  const activeField = getActiveField(rowId)
  if (!activeField) return null
  const shot = await ShotsCollection.findOneAsync(shotId)
  const assetId = shot?.[activeField]
  if (!assetId) return null
  return AssetsCollection.findOneAsync(assetId)
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
  async 'assets.generate' ({ storyboardId, shotId, rowId, prompt, model }) {
    if (!storyboardId || !shotId || !rowId || !prompt) {
      throw new Meteor.Error('assets.generate.invalid', 'Invalid payload.')
    }

    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt })
    await markAssetStatus(assetId, 'processing')

    const modelId = model || 'fal-ai/z-image/turbo'
    try {
      const result = await falSubscribe(modelId, {
        prompt: String(prompt).trim()
      })

      const image = result?.data?.images?.[0]
      if (!image?.url) {
        throw new Meteor.Error('assets.generate.failed', 'No image URL returned.')
      }

      await saveGeneratedAsset({ assetId, prompt, image })
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

    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt })
    await markAssetStatus(assetId, 'processing')

    const modelId = model || 'fal-ai/nano-banana-pro/edit'
    try {
      const result = await falSubscribe(modelId, {
        prompt: String(prompt).trim(),
        image_urls: imageUrls
      })

      const image = result?.data?.images?.[0]
      if (!image?.url) {
        throw new Meteor.Error('assets.edit.failed', 'No image URL returned.')
      }

      await saveGeneratedAsset({ assetId, prompt, image })
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

    const activeField = getActiveField(sourceRowId)
    if (!activeField) {
      throw new Meteor.Error('assets.editFromActive.invalidRow', 'Invalid source row.')
    }

    const shot = await ShotsCollection.findOneAsync(shotId)
    const sourceAssetId = shot?.[activeField]
    if (!sourceAssetId) {
      throw new Meteor.Error('assets.editFromActive.missing', 'Missing source asset.')
    }

    const sourceAsset = await AssetsCollection.findOneAsync(sourceAssetId)
    if (!sourceAsset?.url) {
      throw new Meteor.Error('assets.editFromActive.missing', 'Missing source URL.')
    }

    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt })
    await markAssetStatus(assetId, 'processing')

    try {
      const uploadedUrl = await uploadFromUrl(sourceAsset.url)

      const modelId = model || 'fal-ai/nano-banana-pro/edit'
      const result = await falSubscribe(modelId, {
        prompt: String(prompt).trim(),
        image_urls: [uploadedUrl]
      })

      const image = result?.data?.images?.[0]
      if (!image?.url) {
        throw new Meteor.Error('assets.edit.failed', 'No image URL returned.')
      }

      await saveGeneratedAsset({ assetId, prompt, image })
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

    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt })
    await markAssetStatus(assetId, 'processing')

    const modelId = model || 'fal-ai/minimax/speech-2.8-turbo'
    try {
      const result = await falSubscribe(modelId, {
        prompt: String(prompt).trim(),
        output_format: 'url'
      })

      const audio = result?.data?.audio
      if (!audio?.url) {
        throw new Meteor.Error('assets.tts.failed', 'No audio URL returned.')
      }

      await saveGeneratedAudio({ assetId, prompt, audio })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'tts-failed'
      })
      throw error
    }
  },
  async 'assets.textToVideo' ({ storyboardId, shotId, rowId, prompt, model }) {
    if (!storyboardId || !shotId || !rowId || !prompt) {
      throw new Meteor.Error('assets.textToVideo.invalid', 'Invalid payload.')
    }

    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt })
    await markAssetStatus(assetId, 'processing')

    const modelId = model || 'fal-ai/bytedance/seedance/v1/lite/text-to-video'
    try {
      const result = await falSubscribe(modelId, {
        prompt: String(prompt).trim()
      })

      const video = result?.data?.video || result?.video
      if (!video?.url) {
        throw new Meteor.Error('assets.textToVideo.failed', 'No video URL returned.')
      }

      await saveGeneratedVideo({ assetId, prompt, video })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'text-to-video-failed'
      })
      throw error
    }
  },
  async 'assets.referenceToVideo' ({ storyboardId, shotId, rowId, prompt, model }) {
    if (!storyboardId || !shotId || !rowId || !prompt) {
      throw new Meteor.Error('assets.referenceToVideo.invalid', 'Invalid payload.')
    }

    const edited = await getActiveAssetByRow({ shotId, rowId: 'edit-image' })
    const source = await getActiveAssetByRow({ shotId, rowId: 'source-image' })
    const referenceAsset = edited?.url ? edited : source
    if (!referenceAsset?.url) {
      throw new Meteor.Error('assets.referenceToVideo.missing', 'Missing reference image.')
    }

    const assetId = await createPendingAsset({ storyboardId, shotId, rowId, prompt })
    await markAssetStatus(assetId, 'processing')

    try {
      const referenceUrl = await uploadFromUrl(referenceAsset.url)
      const modelId = model || 'fal-ai/bytedance/seedance/v1/lite/reference-to-video'
      const result = await falSubscribe(modelId, {
        prompt: String(prompt).trim(),
        reference_image_urls: [referenceUrl]
      })

      const video = result?.data?.video || result?.video
      if (!video?.url) {
        throw new Meteor.Error('assets.referenceToVideo.failed', 'No video URL returned.')
      }

      await saveGeneratedVideo({ assetId, prompt, video })
      return assetId
    } catch (error) {
      await markAssetStatus(assetId, 'error', {
        error: error?.message || 'reference-to-video-failed'
      })
      throw error
    }
  }
})
