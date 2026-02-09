import { Meteor } from 'meteor/meteor'
import { fal } from '@fal-ai/client'

let isConfigured = false

export const configureFal = ({ credentials } = {}) => {
  if (isConfigured) return fal
  const key = credentials || Meteor.settings.FAL_KEY
  if (key) {
    fal.config({ credentials: key })
  }
  isConfigured = true
  return fal
}

export const falRun = (model, input, options = {}) => {
  configureFal()
  return fal.run(model, { input, ...options })
}

export const falSubscribe = (model, input, options = {}) => {
  configureFal()
  return fal.subscribe(model, { input, ...options })
}

export const falQueueSubmit = (model, input, options = {}) => {
  configureFal()
  return fal.queue.submit(model, { input, ...options })
}

export const falQueueStatus = (model, requestId, options = {}) => {
  configureFal()
  return fal.queue.status(model, { requestId, ...options })
}

export const falQueueResult = (model, requestId, options = {}) => {
  configureFal()
  return fal.queue.result(model, { requestId, ...options })
}

export const falStorageUpload = (file, options = {}) => {
  configureFal()
  return fal.storage.upload(file, options)
}
