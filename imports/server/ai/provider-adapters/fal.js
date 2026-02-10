import { Meteor } from 'meteor/meteor'
import { ASSET_TASKS } from '/imports/configs/tasks/assets'

const isNil = (value) => value === null || value === undefined

const validateSchema = ({ schema = {}, params = {} }) => {
  Object.keys(schema).forEach((field) => {
    const rule = schema[field]
    const value = params[field]
    if (!rule?.required) return
    if (isNil(value)) {
      throw new Meteor.Error('assets.task.invalidInput', `Missing required field: ${field}`)
    }
    if (rule.type === 'string' && typeof value !== 'string') {
      throw new Meteor.Error('assets.task.invalidInput', `Field must be string: ${field}`)
    }
    if (rule.type === 'array' && !Array.isArray(value)) {
      throw new Meteor.Error('assets.task.invalidInput', `Field must be array: ${field}`)
    }
    if (rule.type === 'array' && rule.minItems && value.length < rule.minItems) {
      throw new Meteor.Error('assets.task.invalidInput', `Field needs ${rule.minItems}+ items: ${field}`)
    }
    if (rule.type === 'number' && typeof value !== 'number') {
      throw new Meteor.Error('assets.task.invalidInput', `Field must be number: ${field}`)
    }
    if (rule.type === 'boolean' && typeof value !== 'boolean') {
      throw new Meteor.Error('assets.task.invalidInput', `Field must be boolean: ${field}`)
    }
  })
}

const toProviderInput = (model, params = {}) => {
  const input = { ...(model.defaults || {}) }
  Object.keys(model.fieldMap || {}).forEach((field) => {
    const providerField = model.fieldMap[field]
    const value = params[field]
    if (isNil(value)) return
    input[providerField] = value
  })
  return input
}

const getImageResult = (result) => {
  const image = result?.data?.images?.[0]
  if (!image?.url) {
    throw new Meteor.Error('assets.task.failed', 'No image URL returned.')
  }
  return { kind: 'image', asset: image }
}

const getVideoResult = (result) => {
  const video = result?.data?.video || result?.video
  if (!video?.url) {
    throw new Meteor.Error('assets.task.failed', 'No video URL returned.')
  }
  return { kind: 'video', asset: video }
}

const getAudioResult = (result) => {
  const audio = result?.data?.audio
  if (!audio?.url) {
    throw new Meteor.Error('assets.task.failed', 'No audio URL returned.')
  }
  return { kind: 'audio', asset: audio }
}

const normalizeTaskResult = ({ task, result }) => {
  if (task === ASSET_TASKS.TEXT_TO_IMAGE || task === ASSET_TASKS.IMAGE_EDIT) {
    return getImageResult(result)
  }
  if (task === ASSET_TASKS.TEXT_TO_VIDEO || task === ASSET_TASKS.IMAGE_TO_VIDEO || task === ASSET_TASKS.VIDEO_TO_VIDEO) {
    return getVideoResult(result)
  }
  if (task === ASSET_TASKS.TTS) {
    return getAudioResult(result)
  }
  throw new Meteor.Error('assets.task.unsupported', `Unsupported task: ${task}`)
}

export const runFalTask = async ({ model, params, falSubscribe }) => {
  if (typeof falSubscribe !== 'function') {
    throw new Meteor.Error('assets.task.config', 'Missing fal subscribe function.')
  }

  validateSchema({ schema: model.inputSchema, params })
  const input = toProviderInput(model, params)
  const result = await falSubscribe(model.modelId, input)
  return normalizeTaskResult({ task: model.task, result })
}
