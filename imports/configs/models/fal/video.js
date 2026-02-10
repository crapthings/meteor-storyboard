import { ASSET_TASKS } from '/imports/configs/tasks/assets'

export const FAL_VIDEO_MODELS = {
  textToVideo: {
    key: 'fal.text_to_video.default',
    provider: 'fal',
    task: ASSET_TASKS.TEXT_TO_VIDEO,
    modelId: 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      aspectRatio: { required: false, type: 'string' },
      duration: { required: false, type: 'number' }
    },
    fieldMap: {
      prompt: 'prompt',
      aspectRatio: 'aspect_ratio',
      duration: 'duration'
    }
  },
  imageToVideo: {
    key: 'fal.image_to_video.default',
    provider: 'fal',
    task: ASSET_TASKS.IMAGE_TO_VIDEO,
    modelId: 'fal-ai/bytedance/seedance/v1/lite/reference-to-video',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      images: { required: true, type: 'array', minItems: 1 },
      aspectRatio: { required: false, type: 'string' },
      duration: { required: false, type: 'number' }
    },
    fieldMap: {
      prompt: 'prompt',
      images: 'reference_image_urls',
      aspectRatio: 'aspect_ratio',
      duration: 'duration'
    }
  },
  viduQ3ImageToVideo: {
    key: 'fal.image_to_video.vidu_q3',
    provider: 'fal',
    task: ASSET_TASKS.IMAGE_TO_VIDEO,
    modelId: 'fal-ai/vidu/q3/image-to-video',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      image: { required: true, type: 'string' },
      duration: { required: false, type: 'number' },
      resolution: { required: false, type: 'string' },
      audio: { required: false, type: 'boolean' },
      seed: { required: false, type: 'number' }
    },
    fieldMap: {
      prompt: 'prompt',
      image: 'image_url',
      duration: 'duration',
      resolution: 'resolution',
      audio: 'audio',
      seed: 'seed'
    }
  }
}

export const getFalVideoModel = (modelKey = 'textToVideo') => (
  FAL_VIDEO_MODELS[modelKey] || FAL_VIDEO_MODELS.textToVideo
)
