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
    },
    capabilities: {
      startEndFrame: false,
      referenceImages: false,
      imageInputMode: 'none'
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
    },
    capabilities: {
      startEndFrame: false,
      referenceImages: true,
      imageInputMode: 'multiple'
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
    },
    capabilities: {
      startEndFrame: false,
      referenceImages: false,
      imageInputMode: 'single'
    }
  },
  seedanceV1ProStartEndImageToVideo: {
    key: 'fal.image_to_video.seedance_v1_pro_start_end',
    provider: 'fal',
    task: ASSET_TASKS.IMAGE_TO_VIDEO,
    modelId: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      image: { required: true, type: 'string' },
      endImage: { required: false, type: 'string' },
      aspectRatio: { required: false, type: 'string' },
      resolution: { required: false, type: 'string' },
      duration: { required: false, type: 'string' },
      cameraFixed: { required: false, type: 'boolean' },
      seed: { required: false, type: 'number' },
      enableSafetyChecker: { required: false, type: 'boolean' }
    },
    fieldMap: {
      prompt: 'prompt',
      image: 'image_url',
      endImage: 'end_image_url',
      aspectRatio: 'aspect_ratio',
      resolution: 'resolution',
      duration: 'duration',
      cameraFixed: 'camera_fixed',
      seed: 'seed',
      enableSafetyChecker: 'enable_safety_checker'
    },
    defaults: {
      aspectRatio: 'auto',
      resolution: '1080p',
      duration: '5',
      enableSafetyChecker: true
    },
    capabilities: {
      startEndFrame: true,
      referenceImages: true,
      imageInputMode: 'single_or_multiple'
    }
  },
  veo31FastFirstLastFrameToVideo: {
    key: 'fal.image_to_video.veo31_fast_first_last',
    provider: 'fal',
    task: ASSET_TASKS.IMAGE_TO_VIDEO,
    modelId: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      image: { required: true, type: 'string' },
      endImage: { required: true, type: 'string' },
      aspectRatio: { required: false, type: 'string' },
      duration: { required: false, type: 'string' },
      negativePrompt: { required: false, type: 'string' },
      resolution: { required: false, type: 'string' },
      generateAudio: { required: false, type: 'boolean' },
      seed: { required: false, type: 'number' },
      autoFix: { required: false, type: 'boolean' }
    },
    fieldMap: {
      prompt: 'prompt',
      image: 'first_frame_url',
      endImage: 'last_frame_url',
      aspectRatio: 'aspect_ratio',
      duration: 'duration',
      negativePrompt: 'negative_prompt',
      resolution: 'resolution',
      generateAudio: 'generate_audio',
      seed: 'seed',
      autoFix: 'auto_fix'
    },
    defaults: {
      aspectRatio: 'auto',
      duration: '8s',
      resolution: '720p',
      generateAudio: true
    },
    capabilities: {
      startEndFrame: true,
      referenceImages: false,
      imageInputMode: 'single'
    }
  },
  grokImagineImageToVideo: {
    key: 'fal.image_to_video.grok_imagine',
    provider: 'fal',
    task: ASSET_TASKS.IMAGE_TO_VIDEO,
    modelId: 'xai/grok-imagine-video/image-to-video',
    inputSchema: {
      prompt: { required: true, type: 'string' },
      image: { required: true, type: 'string' },
      duration: { required: false, type: 'number' },
      aspectRatio: { required: false, type: 'string' },
      resolution: { required: false, type: 'string' }
    },
    fieldMap: {
      prompt: 'prompt',
      image: 'image_url',
      duration: 'duration',
      aspectRatio: 'aspect_ratio',
      resolution: 'resolution'
    },
    defaults: {
      duration: 6,
      aspectRatio: 'auto',
      resolution: '720p'
    },
    capabilities: {
      startEndFrame: false,
      referenceImages: false,
      imageInputMode: 'single'
    }
  }
}

export const getFalVideoModel = (modelKey = 'textToVideo') => (
  FAL_VIDEO_MODELS[modelKey] || FAL_VIDEO_MODELS.textToVideo
)
