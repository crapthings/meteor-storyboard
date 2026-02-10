import { Meteor } from 'meteor/meteor'
import { resolveTaskModel } from '/imports/server/ai/model-registry'
import { resolveTaskSources } from '/imports/server/ai/source-resolver'
import { runFalTask } from '/imports/server/ai/provider-adapters/fal'

export const runAssetTask = async ({
  task,
  model,
  params = {},
  shotId,
  preferredImageRows,
  findActiveAssetByRow,
  uploadFromUrl,
  falSubscribe
}) => {
  if (!task) {
    throw new Meteor.Error('assets.task.invalid', 'Task is required.')
  }

  const resolvedModel = resolveTaskModel({ task, model })
  const sourceParams = await resolveTaskSources({
    task,
    model: resolvedModel,
    params,
    shotId,
    preferredImageRows,
    findActiveAssetByRow,
    uploadFromUrl
  })
  const mergedParams = { ...params, ...sourceParams }

  if (resolvedModel.provider === 'fal') {
    return runFalTask({
      model: resolvedModel,
      params: mergedParams,
      falSubscribe
    })
  }

  throw new Meteor.Error('assets.task.provider', `Unsupported provider: ${resolvedModel.provider}`)
}
