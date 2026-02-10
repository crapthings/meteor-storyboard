import { ASSET_TASKS } from '/imports/configs/tasks/assets'

export const FAL_TEXT_TO_IMAGE_MODELS = {
  default: {
    key: 'fal.text_to_image.default',
    provider: 'fal',
    task: ASSET_TASKS.TEXT_TO_IMAGE,
    modelId: 'fal-ai/z-image/turbo',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      aspectRatio: { required: false, type: 'string' },
      resolution: { required: false, type: 'object' }
    },
    fieldMap: {
      prompt: 'prompt',
      aspectRatio: 'aspect_ratio',
      resolution: 'image_size'
    }
  }
}

export const getFalTextToImageModel = (modelKey = 'default') => (
  FAL_TEXT_TO_IMAGE_MODELS[modelKey] || FAL_TEXT_TO_IMAGE_MODELS.default
)
