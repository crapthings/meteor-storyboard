import { AssetsCollection } from '/imports/api/assets'
import { ShotsCollection } from '/imports/api/shots'
import { StoryboardsCollection } from '/imports/api/storyboards'

const getAssetKind = (asset) => {
  const contentType = asset?.meta?.content_type
  if (typeof contentType === 'string') {
    if (contentType.startsWith('image/')) return 'image'
    if (contentType.startsWith('video/')) return 'video'
    if (contentType.startsWith('audio/')) return 'audio'
  }

  if (asset?.rowId === 'source-clip' || asset?.rowId === 'output-video') return 'video'
  if (asset?.rowId === 'source-image' || asset?.rowId === 'edit-image') return 'image'
  if (asset?.rowId === 'audio') return 'audio'
  return 'unknown'
}

const buildAssetStats = (assets = []) => {
  const stats = {
    assetCount: assets.length,
    imageCount: 0,
    videoCount: 0,
    audioCount: 0
  }

  for (const asset of assets) {
    const kind = getAssetKind(asset)
    if (kind === 'image') stats.imageCount += 1
    if (kind === 'video') stats.videoCount += 1
    if (kind === 'audio') stats.audioCount += 1
  }

  return stats
}

export const recomputeShotAssetStats = async ({ storyboardId, shotId }) => {
  if (!storyboardId || !shotId) return null
  const assets = await AssetsCollection.find({ storyboardId, shotId }).fetchAsync()
  const stats = buildAssetStats(assets)
  await ShotsCollection.updateAsync(shotId, {
    $set: { stats, updatedAt: new Date() }
  })
  return stats
}

export const recomputeStoryboardAssetStats = async ({ storyboardId }) => {
  if (!storyboardId) return null
  const [assets, shotCount] = await Promise.all([
    AssetsCollection.find({ storyboardId }).fetchAsync(),
    ShotsCollection.find({ storyboardId }).countAsync()
  ])

  const assetStats = buildAssetStats(assets)
  const stats = {
    shotCount,
    ...assetStats
  }

  await StoryboardsCollection.updateAsync(storyboardId, {
    $set: { stats, updatedAt: new Date() }
  })
  return stats
}

export const recomputeAssetStatsForShotAndStoryboard = async ({ storyboardId, shotId }) => {
  await recomputeShotAssetStats({ storyboardId, shotId })
  await recomputeStoryboardAssetStats({ storyboardId })
}
