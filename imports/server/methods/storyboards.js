import { Meteor } from 'meteor/meteor'
import { StoryboardsCollection } from '/imports/api/storyboards'
import { ShotsCollection } from '/imports/api/shots'

const isObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
)

Meteor.methods({
  async 'storyboards.create' ({ name, description, aspectRatio }) {
    const safeName = (name || 'Untitled Storyboard').trim()
    const order = (await StoryboardsCollection.find().countAsync()) || 0
    const storyboardId = await StoryboardsCollection.insertAsync({
      name: safeName,
      description: (description || '').trim(),
      aspectRatio: aspectRatio || '16:9',
      order,
      createdAt: new Date()
    })

    await ShotsCollection.insertAsync({
      storyboardId,
      name: 'Shot 1',
      order: 0,
      assets: [],
      createdAt: new Date()
    })

    return storyboardId
  },
  async 'storyboards.update' ({ storyboardId, name, description, order, aspectRatio, modelSelections }) {
    if (!storyboardId) {
      throw new Meteor.Error('storyboards.update.invalid', 'Invalid payload.')
    }

    const updates = {}
    if (typeof name === 'string') {
      updates.name = name.trim() || 'Untitled Storyboard'
    }
    if (typeof description === 'string') {
      updates.description = description.trim()
    }
    if (typeof aspectRatio === 'string') {
      updates.aspectRatio = aspectRatio
    }
    if (typeof order === 'number') {
      updates.order = order
    }
    if (isObject(modelSelections)) {
      updates.modelSelections = modelSelections
    }
    updates.updatedAt = new Date()

    await StoryboardsCollection.updateAsync(storyboardId, { $set: updates })
  },
  async 'storyboards.remove' ({ storyboardId }) {
    if (!storyboardId) {
      throw new Meteor.Error('storyboards.remove.invalid', 'Invalid payload.')
    }
    await StoryboardsCollection.removeAsync(storyboardId)
    await ShotsCollection.removeAsync({ storyboardId })
  }
})
