import { Meteor } from 'meteor/meteor'
import { ShotsCollection } from '/imports/api/shots'
import { AssetsCollection } from '/imports/api/assets'

Meteor.methods({
  async 'shots.move' ({ shotId, row, column }) {
    if (!shotId || !row || typeof column !== 'number') {
      throw new Meteor.Error('shots.move.invalid', 'Invalid move payload.')
    }

    await ShotsCollection.updateAsync(shotId, {
      $set: { row, column, updatedAt: new Date() }
    })
  },
  async 'shots.create' ({ storyboardId, name, order }) {
    if (!storyboardId) {
      throw new Meteor.Error('shots.create.invalid', 'Invalid payload.')
    }
    const count =
      typeof order === 'number'
        ? order
        : await ShotsCollection.find({ storyboardId }).countAsync()
    return ShotsCollection.insertAsync({
      storyboardId,
      name: (name || `Shot ${count + 1}`).trim(),
      order: count,
      assets: [],
      createdAt: new Date()
    })
  },
  async 'shots.update' ({ shotId, name, order, assets }) {
    if (!shotId) {
      throw new Meteor.Error('shots.update.invalid', 'Invalid payload.')
    }
    const updates = {}
    if (typeof name === 'string') updates.name = name.trim()
    if (typeof order === 'number') updates.order = order
    if (Array.isArray(assets)) updates.assets = assets
    updates.updatedAt = new Date()
    await ShotsCollection.updateAsync(shotId, { $set: updates })
  },
  async 'shots.remove' ({ shotId }) {
    if (!shotId) {
      throw new Meteor.Error('shots.remove.invalid', 'Invalid payload.')
    }
    await ShotsCollection.removeAsync(shotId)
  },
  async 'shots.reorder' ({ storyboardId, orderedIds }) {
    if (!storyboardId || !Array.isArray(orderedIds)) {
      throw new Meteor.Error('shots.reorder.invalid', 'Invalid payload.')
    }

    let order = 0
    for (const shotId of orderedIds) {
      await ShotsCollection.updateAsync(
        { _id: shotId, storyboardId },
        { $set: { order, updatedAt: new Date() } }
      )
      order += 1
    }
  },
  async 'shots.clear' ({ storyboardId }) {
    if (!storyboardId) {
      throw new Meteor.Error('shots.clear.invalid', 'Invalid payload.')
    }
    await ShotsCollection.removeAsync({ storyboardId })
    await AssetsCollection.removeAsync({ storyboardId })
  }
})
