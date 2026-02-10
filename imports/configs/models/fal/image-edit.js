import { ASSET_TASKS } from '/imports/configs/tasks/assets'

export const FAL_IMAGE_EDIT_MODELS = {
  default: {
    key: 'fal.image_edit.default',
    provider: 'fal',
    task: ASSET_TASKS.IMAGE_EDIT,
    modelId: 'fal-ai/nano-banana-pro/edit',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      images: { required: true, type: 'array', minItems: 1 }
    },
    fieldMap: {
      prompt: 'prompt',
      images: 'image_urls'
    }
  },
  qwenImageMaxEdit: {
    key: 'fal.image_edit.qwen_image_max',
    provider: 'fal',
    task: ASSET_TASKS.IMAGE_EDIT,
    modelId: 'fal-ai/qwen-image-max/edit',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      images: { required: true, type: 'array', minItems: 1 },
      negativePrompt: { required: false, type: 'string' },
      resolution: { required: false, type: 'object' },
      enablePromptExpansion: { required: false, type: 'boolean' },
      enableSafetyChecker: { required: false, type: 'boolean' },
      seed: { required: false, type: 'number' },
      numImages: { required: false, type: 'number' },
      outputFormat: { required: false, type: 'string' }
    },
    fieldMap: {
      prompt: 'prompt',
      images: 'image_urls',
      negativePrompt: 'negative_prompt',
      resolution: 'image_size',
      enablePromptExpansion: 'enable_prompt_expansion',
      enableSafetyChecker: 'enable_safety_checker',
      seed: 'seed',
      numImages: 'num_images',
      outputFormat: 'output_format'
    },
    defaults: {
      enablePromptExpansion: true,
      enableSafetyChecker: true,
      numImages: 1,
      outputFormat: 'png'
    }
  },
  grokImagineImageEdit: {
    key: 'fal.image_edit.grok_imagine_image_edit',
    provider: 'fal',
    task: ASSET_TASKS.IMAGE_EDIT,
    modelId: 'xai/grok-imagine-image/edit',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      image: { required: true, type: 'string' },
      numImages: { required: false, type: 'number' },
      outputFormat: { required: false, type: 'string' },
      syncMode: { required: false, type: 'boolean' }
    },
    fieldMap: {
      prompt: 'prompt',
      image: 'image_url',
      numImages: 'num_images',
      outputFormat: 'output_format',
      syncMode: 'sync_mode'
    },
    defaults: {
      numImages: 1,
      outputFormat: 'jpeg'
    }
  }
}

export const getFalImageEditModel = (modelKey = 'default') => (
  FAL_IMAGE_EDIT_MODELS[modelKey] || FAL_IMAGE_EDIT_MODELS.default
)
