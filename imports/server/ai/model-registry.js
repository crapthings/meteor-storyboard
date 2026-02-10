import { Meteor } from 'meteor/meteor'
import { ASSET_TASKS } from '/imports/configs/tasks/assets'
import { FAL_TEXT_TO_IMAGE_MODELS } from '/imports/configs/models/fal/text-to-image'
import { FAL_IMAGE_EDIT_MODELS } from '/imports/configs/models/fal/image-edit'
import { FAL_IMAGE_TO_LIPSYNC_MODELS } from '/imports/configs/models/fal/image-to-lipsync'
import { FAL_VIDEO_MODELS } from '/imports/configs/models/fal/video'
import { FAL_SPEECH_MODELS } from '/imports/configs/models/fal/speech'

const modelSets = [
  FAL_TEXT_TO_IMAGE_MODELS,
  FAL_IMAGE_EDIT_MODELS,
  FAL_IMAGE_TO_LIPSYNC_MODELS,
  FAL_VIDEO_MODELS,
  FAL_SPEECH_MODELS
]

const flattenModels = (models) => Object.values(models)

const ALL_MODELS = modelSets.flatMap(flattenModels)

const MODEL_BY_KEY = ALL_MODELS.reduce((acc, model) => {
  acc[model.key] = model
  return acc
}, {})

const MODEL_BY_ID = ALL_MODELS.reduce((acc, model) => {
  acc[model.modelId] = model
  return acc
}, {})

const DEFAULT_MODEL_KEY_BY_TASK = {
  [ASSET_TASKS.TEXT_TO_IMAGE]: FAL_TEXT_TO_IMAGE_MODELS.default.key,
  [ASSET_TASKS.IMAGE_EDIT]: FAL_IMAGE_EDIT_MODELS.default.key,
  [ASSET_TASKS.TEXT_TO_VIDEO]: FAL_VIDEO_MODELS.textToVideo.key,
  [ASSET_TASKS.IMAGE_TO_VIDEO]: FAL_VIDEO_MODELS.imageToVideo.key,
  [ASSET_TASKS.LIP_SYNC_IMAGE]: FAL_IMAGE_TO_LIPSYNC_MODELS.klingAvatarV2Standard.key,
  [ASSET_TASKS.TTS]: FAL_SPEECH_MODELS.default.key
}

export const getModelByKey = (modelKey) => MODEL_BY_KEY[modelKey] || null
export const getModelById = (modelId) => MODEL_BY_ID[modelId] || null

export const getDefaultModelForTask = (task) => {
  const modelKey = DEFAULT_MODEL_KEY_BY_TASK[task]
  if (!modelKey) return null
  return getModelByKey(modelKey)
}

export const resolveTaskModel = ({ task, model }) => {
  const defaultModel = getDefaultModelForTask(task)
  if (!defaultModel) {
    throw new Meteor.Error('assets.model.unsupportedTask', `Unsupported task: ${task}`)
  }

  if (!model) return defaultModel

  const configuredModel = getModelByKey(model)
  if (configuredModel) return configuredModel

  const configuredById = getModelById(model)
  if (configuredById) return configuredById

  return {
    ...defaultModel,
    modelId: model
  }
}
