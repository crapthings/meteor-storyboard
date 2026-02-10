import { ASSET_TASKS } from '/imports/configs/tasks/assets'

export const FAL_IMAGE_TO_LIPSYNC_MODELS = {
  klingAvatarV2Standard: {
    key: 'fal.lip_sync_image.kling_avatar_v2',
    provider: 'fal',
    task: ASSET_TASKS.LIP_SYNC_IMAGE,
    modelId: 'fal-ai/kling-video/ai-avatar/v2/standard',
    inputSchema: {
      image: { required: true, type: 'string' },
      audioUrl: { required: true, type: 'string' },
      prompt: { required: false, type: 'string' }
    },
    fieldMap: {
      image: 'image_url',
      audioUrl: 'audio_url',
      prompt: 'prompt'
    },
    defaults: {
      prompt: '.'
    },
    capabilities: {
      lipSyncImage: true,
      imageInputMode: 'single',
      audioInputMode: 'single'
    }
  },
  klingAvatarV2Pro: {
    key: 'fal.lip_sync_image.kling_avatar_v2_pro',
    provider: 'fal',
    task: ASSET_TASKS.LIP_SYNC_IMAGE,
    modelId: 'fal-ai/kling-video/ai-avatar/v2/pro',
    inputSchema: {
      image: { required: true, type: 'string' },
      audioUrl: { required: true, type: 'string' },
      prompt: { required: false, type: 'string' }
    },
    fieldMap: {
      image: 'image_url',
      audioUrl: 'audio_url',
      prompt: 'prompt'
    },
    defaults: {
      prompt: '.'
    },
    capabilities: {
      lipSyncImage: true,
      imageInputMode: 'single',
      audioInputMode: 'single'
    }
  }
}

export const getFalImageToLipSyncModel = (modelKey = 'klingAvatarV2Standard') => (
  FAL_IMAGE_TO_LIPSYNC_MODELS[modelKey] || FAL_IMAGE_TO_LIPSYNC_MODELS.klingAvatarV2Standard
)
