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
  },
  grokImagineImage: {
    key: 'fal.text_to_image.grok_imagine_image',
    provider: 'fal',
    task: ASSET_TASKS.TEXT_TO_IMAGE,
    modelId: 'xai/grok-imagine-image',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      aspectRatio: { required: false, type: 'string' }
    },
    fieldMap: {
      prompt: 'prompt',
      aspectRatio: 'aspect_ratio'
    },
    defaults: {
      num_images: 1,
      output_format: 'jpeg'
    }
  }
}

export const getFalTextToImageModel = (modelKey = 'default') => (
  FAL_TEXT_TO_IMAGE_MODELS[modelKey] || FAL_TEXT_TO_IMAGE_MODELS.default
)
