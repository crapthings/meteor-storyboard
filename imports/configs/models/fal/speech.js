import { ASSET_TASKS } from '/imports/configs/tasks/assets'

export const FAL_SPEECH_MODELS = {
  default: {
    key: 'fal.tts.default',
    provider: 'fal',
    task: ASSET_TASKS.TTS,
    modelId: 'fal-ai/minimax/speech-2.8-turbo',
    inputSchema: {
      prompt: { required: true, type: 'string' }
    },
    fieldMap: {
      prompt: 'prompt',
      outputFormat: 'output_format'
    },
    defaults: {
      outputFormat: 'url'
    }
  }
}

export const getFalSpeechModel = (modelKey = 'default') => (
  FAL_SPEECH_MODELS[modelKey] || FAL_SPEECH_MODELS.default
)
