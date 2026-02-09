import dotenv from 'dotenv'

import { Meteor } from 'meteor/meteor'
import { StoryboardsCollection } from '../imports/api/storyboards'
import { ShotsCollection } from '../imports/api/shots'
import { AssetsCollection } from '../imports/api/assets'
import '../imports/server/methods/storyboards'
import '../imports/server/methods/shots'
import '../imports/server/methods/assets'
import '../imports/server/routes/assets'

Meteor.startup(async () => {
  dotenv.config()

  Meteor.publish('storyboards', function () {
    return StoryboardsCollection.find()
  })

  Meteor.publish('shots', function (storyboardId) {
    if (!storyboardId) {
      return this.ready()
    }
    return ShotsCollection.find({ storyboardId })
  })

  Meteor.publish('assets', function (storyboardId) {
    if (!storyboardId) {
      return this.ready()
    }
    return AssetsCollection.find({ storyboardId })
  })
})
