import { Meteor } from 'meteor/meteor'
import { ASSET_TASKS } from '/imports/configs/tasks/assets'

const DEFAULT_IMAGE_ROWS = ['edit-image', 'source-image']
const DEFAULT_AUDIO_ROWS = ['audio']

const hasArrayItems = (value) => Array.isArray(value) && value.length > 0

const getSingleImageFromParams = (params) => {
  if (typeof params.image === 'string' && params.image.trim()) return params.image.trim()
  if (typeof params.imageUrl === 'string' && params.imageUrl.trim()) return params.imageUrl.trim()
  return null
}

const getImageFromParams = (params) => {
  const singleImage = getSingleImageFromParams(params)
  if (singleImage) return [singleImage]
  if (hasArrayItems(params.images)) return params.images
  if (hasArrayItems(params.imageUrls)) return params.imageUrls
  return []
}

const needsSingleImage = (model) => Boolean(model?.inputSchema?.image?.required)

const findFirstActiveAsset = async ({ shotId, rows, findActiveAssetByRow }) => {
  for (const rowId of rows) {
    const asset = await findActiveAssetByRow({ shotId, rowId })
    if (asset?.url) return asset
  }
  return null
}

const resolveImageSources = async ({
  model,
  params,
  shotId,
  findActiveAssetByRow,
  uploadFromUrl,
  preferredImageRows = DEFAULT_IMAGE_ROWS
}) => {
  const isSingleImageInput = needsSingleImage(model)
  const images = getImageFromParams(params)
  if (images.length > 0) {
    if (isSingleImageInput) {
      return { image: images[0] }
    }
    return { images }
  }

  if (!shotId || typeof findActiveAssetByRow !== 'function') {
    throw new Meteor.Error('assets.sources.missingImage', 'Missing reference image.')
  }

  const asset = await findFirstActiveAsset({
    shotId,
    rows: preferredImageRows,
    findActiveAssetByRow
  })
  if (!asset?.url) {
    throw new Meteor.Error('assets.sources.missingImage', 'Missing reference image.')
  }

  if (typeof uploadFromUrl !== 'function') {
    if (isSingleImageInput) {
      return { image: asset.url }
    }
    return { images: [asset.url] }
  }

  const uploadedUrl = await uploadFromUrl(asset.url)
  if (isSingleImageInput) {
    return { image: uploadedUrl }
  }
  return { images: [uploadedUrl] }
}

const getAudioFromParams = (params) => {
  if (typeof params.audioUrl === 'string' && params.audioUrl.trim()) return params.audioUrl.trim()
  return null
}

const resolveAudioSource = async ({
  params,
  shotId,
  findActiveAssetByRow,
  uploadFromUrl,
  preferredAudioRows = DEFAULT_AUDIO_ROWS
}) => {
  const audioUrl = getAudioFromParams(params)
  if (audioUrl) return { audioUrl }

  if (!shotId || typeof findActiveAssetByRow !== 'function') {
    throw new Meteor.Error('assets.sources.missingAudio', 'Missing audio source.')
  }

  const asset = await findFirstActiveAsset({
    shotId,
    rows: preferredAudioRows,
    findActiveAssetByRow
  })
  if (!asset?.url) {
    throw new Meteor.Error('assets.sources.missingAudio', 'Missing audio source.')
  }

  if (typeof uploadFromUrl !== 'function') {
    return { audioUrl: asset.url }
  }

  const uploadedUrl = await uploadFromUrl(asset.url)
  return { audioUrl: uploadedUrl }
}

export const resolveTaskSources = async ({
  task,
  model,
  params = {},
  shotId,
  findActiveAssetByRow,
  uploadFromUrl,
  preferredImageRows,
  preferredAudioRows
}) => {
  if (task === ASSET_TASKS.IMAGE_EDIT || task === ASSET_TASKS.IMAGE_TO_VIDEO) {
    return resolveImageSources({
      model,
      params,
      shotId,
      findActiveAssetByRow,
      uploadFromUrl,
      preferredImageRows
    })
  }

  if (task === ASSET_TASKS.LIP_SYNC_IMAGE) {
    const [imageSource, audioSource] = await Promise.all([
      resolveImageSources({
        model,
        params,
        shotId,
        findActiveAssetByRow,
        uploadFromUrl,
        preferredImageRows
      }),
      resolveAudioSource({
        params,
        shotId,
        findActiveAssetByRow,
        uploadFromUrl,
        preferredAudioRows
      })
    ])
    return { ...imageSource, ...audioSource }
  }

  return {}
}
