import { WebApp } from 'meteor/webapp'
import { Meteor } from 'meteor/meteor'
import { nanoid } from 'nanoid'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { AssetsCollection } from '/imports/api/assets'
import { ShotsCollection } from '/imports/api/shots'

const MAX_BYTES = 512 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'video/mp4',
  'video/quicktime',
  'video/webm'
])

const ALLOWED_TYPE_PREFIX_BY_ROW = {
  'source-clip': 'video/',
  'source-image': 'image/',
  'edit-image': 'image/',
  'output-video': 'video/',
  audio: 'audio/'
}

const json = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  })
  res.end(JSON.stringify(payload))
}

const getAllowedTypePrefixForRow = (rowId) => ALLOWED_TYPE_PREFIX_BY_ROW[rowId]

const isTypeAllowedForRow = (rowId, type) => {
  const allowedPrefix = getAllowedTypePrefixForRow(rowId)
  if (!allowedPrefix || typeof type !== 'string') return false
  return type.startsWith(allowedPrefix)
}

const parseDurationSeconds = (value) => {
  if (typeof value !== 'string') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed)
}

const normalizeAssetsUrlPrefix = (value) => {
  if (!value || typeof value !== 'string') return '/assets'
  const withSlash = value.startsWith('/') ? value : `/${value}`
  const trimmed = withSlash.replace(/\/+$/, '')
  return trimmed || '/assets'
}

const getAssetsUrlPrefix = () =>
  normalizeAssetsUrlPrefix(
    Meteor.settings?.ASSETS_URL_PREFIX || Meteor.settings?.ASSETS_STATIC_PREFIX
  )

const getAssetsDir = () => {
  const configured =
    Meteor.settings?.ASSETS_FOLDER || Meteor.settings?.ASSETS_STATIC_DIR
  if (configured && typeof configured === 'string') {
    return path.resolve(configured)
  }
  return path.join(process.cwd(), 'public', 'assets')
}

const getPublicAssetUrl = (filename) =>
  `${getAssetsUrlPrefix()}/${encodeURIComponent(filename)}`

const getPathname = (url = '') => {
  const [pathname] = url.split('?')
  return pathname || '/'
}

const isPathInsideBase = (baseDir, targetPath) => {
  const relative = path.relative(baseDir, targetPath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

const getContentTypeByExt = (extname) => {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm'
  }
  return map[extname.toLowerCase()] || 'application/octet-stream'
}

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BYTES) {
        reject(new Meteor.Error('payload-too-large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

const parseUpload = (req, bodyBuffer) => {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.startsWith('multipart/form-data')) {
    throw new Meteor.Error('invalid-content-type')
  }

  const boundaryMatch = contentType.match(/boundary=([^;]+)/i)
  if (!boundaryMatch) {
    throw new Meteor.Error('invalid-boundary')
  }
  const boundary = `--${boundaryMatch[1]}`
  const parts = bodyBuffer.toString('binary').split(boundary)

  for (const part of parts) {
    if (!part || part === '--\r\n' || part === '--') continue
    const [rawHeaders, rawBody] = part.split('\r\n\r\n')
    if (!rawBody) continue
    const headers = rawHeaders
      .split('\r\n')
      .filter(Boolean)
      .reduce((acc, line) => {
        const [key, ...rest] = line.split(':')
        acc[key.toLowerCase()] = rest.join(':').trim()
        return acc
      }, {})

    const disposition = headers['content-disposition'] || ''
    if (!/name="file"/i.test(disposition)) continue

    const type = headers['content-type'] || 'application/octet-stream'
    const body = rawBody.slice(0, -2) // trim trailing \r\n
    return { type, body: Buffer.from(body, 'binary') }
  }

  throw new Meteor.Error('file-not-found')
}

WebApp.connectHandlers.use(getAssetsUrlPrefix(), async (req, res, next) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }

    const assetsDir = getAssetsDir()
    const pathname = getPathname(req.url)
    const decodedPath = decodeURIComponent(pathname)
    const normalized = path.posix.normalize(decodedPath).replace(/^\/+/, '')
    if (!normalized || normalized === '.' || normalized.includes('\0')) {
      next()
      return
    }

    const filePath = path.join(assetsDir, normalized)
    if (!isPathInsideBase(assetsDir, filePath)) {
      json(res, 403, { error: 'forbidden' })
      return
    }

    const stats = await fs.stat(filePath).catch(() => null)
    if (!stats || !stats.isFile()) {
      next()
      return
    }

    res.writeHead(200, {
      'Content-Type': getContentTypeByExt(path.extname(filePath)),
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=31536000, immutable'
    })

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    fsSync.createReadStream(filePath).pipe(res)
  } catch (error) {
    json(res, 500, { error: error?.message || 'asset-read-failed' })
  }
})

WebApp.connectHandlers.use('/api/assets/edit', async (req, res) => {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'method-not-allowed' })
      return
    }

    const storyboardId = req.headers['x-storyboard-id']
    const shotId = req.headers['x-shot-id']
    const rowId = req.headers['x-row-id']
    const prompt = req.headers['x-prompt'] || ''
    if (!storyboardId || !shotId || !rowId || !prompt) {
      json(res, 400, { error: 'missing-headers' })
      return
    }

    const bodyBuffer = await readRequestBody(req)
    const { type, body } = parseUpload(req, bodyBuffer)

    if (!ALLOWED_TYPES.has(type)) {
      json(res, 400, { error: 'unsupported-type' })
      return
    }

    const base64 = body.toString('base64')
    const dataUri = `data:${type};base64,${base64}`

    const assetId = await Meteor.callAsync('assets.edit', {
      storyboardId,
      shotId,
      rowId,
      prompt,
      imageBase64s: [dataUri]
    })

    json(res, 200, { assetId })
  } catch (error) {
    const code = error?.error === 'payload-too-large' ? 413 : 500
    json(res, code, { error: error?.message || 'upload-failed' })
  }
})

WebApp.connectHandlers.use('/api/assets/waveform', async (req, res) => {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'method-not-allowed' })
      return
    }

    const bodyBuffer = await readRequestBody(req)
    const payload = JSON.parse(bodyBuffer.toString('utf-8'))
    const { assetId, dataUrl } = payload || {}
    if (!assetId || typeof dataUrl !== 'string') {
      json(res, 400, { error: 'invalid-payload' })
      return
    }

    const match = dataUrl.match(/^data:(image\/png);base64,(.+)$/)
    if (!match) {
      json(res, 400, { error: 'invalid-dataurl' })
      return
    }

    const base64 = match[2]
    const buffer = Buffer.from(base64, 'base64')
    const assetsDir = getAssetsDir()
    await fs.mkdir(assetsDir, { recursive: true })

    const filename = `${nanoid()}.png`
    const filePath = path.join(assetsDir, filename)
    await fs.writeFile(filePath, buffer)

    const publicUrl = getPublicAssetUrl(filename)
    await AssetsCollection.updateAsync(assetId, {
      $set: { waveformUrl: publicUrl, updatedAt: new Date() }
    })

    json(res, 200, { url: publicUrl })
  } catch (error) {
    json(res, 500, { error: error?.message || 'upload-failed' })
  }
})

WebApp.connectHandlers.use('/api/assets/thumbnail', async (req, res) => {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'method-not-allowed' })
      return
    }

    const bodyBuffer = await readRequestBody(req)
    const payload = JSON.parse(bodyBuffer.toString('utf-8'))
    const { assetId, dataUrl } = payload || {}
    if (!assetId || typeof dataUrl !== 'string') {
      json(res, 400, { error: 'invalid-payload' })
      return
    }

    const match = dataUrl.match(/^data:(image\/png);base64,(.+)$/)
    if (!match) {
      json(res, 400, { error: 'invalid-dataurl' })
      return
    }

    const base64 = match[2]
    const buffer = Buffer.from(base64, 'base64')
    const assetsDir = getAssetsDir()
    await fs.mkdir(assetsDir, { recursive: true })

    const filename = `${nanoid()}.png`
    const filePath = path.join(assetsDir, filename)
    await fs.writeFile(filePath, buffer)

    const publicUrl = getPublicAssetUrl(filename)
    await AssetsCollection.updateAsync(assetId, {
      $set: { thumbnailUrl: publicUrl, updatedAt: new Date() }
    })

    json(res, 200, { url: publicUrl })
  } catch (error) {
    json(res, 500, { error: error?.message || 'upload-failed' })
  }
})

const ACTIVE_FIELD_BY_ROW = {
  'source-clip': 'activeSourceVideoId',
  'source-image': 'activeSourceImageId',
  'edit-image': 'activeEditedImageId',
  'output-video': 'activeOutputVideoId',
  audio: 'activeSourceAudioId'
}

const extForType = (type) => {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm'
  }
  return map[type] || 'bin'
}

WebApp.connectHandlers.use('/api/assets/upload', async (req, res) => {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'method-not-allowed' })
      return
    }

    const storyboardId = req.headers['x-storyboard-id']
    const shotId = req.headers['x-shot-id']
    const rowId = req.headers['x-row-id']
    const durationSeconds = parseDurationSeconds(req.headers['x-duration-seconds'])
    if (!storyboardId || !shotId || !rowId) {
      json(res, 400, { error: 'missing-headers' })
      return
    }
    if (!getAllowedTypePrefixForRow(rowId)) {
      json(res, 400, { error: 'invalid-row-id' })
      return
    }

    const contentType = req.headers['content-type'] || ''
    const assetsDir = getAssetsDir()
    await fs.mkdir(assetsDir, { recursive: true })

    let type = contentType
    let fileSize = 0
    let filename = ''
    let filePath = ''

    if (contentType.startsWith('multipart/form-data')) {
      const bodyBuffer = await readRequestBody(req)
      const { type: parsedType, body } = parseUpload(req, bodyBuffer)
      type = parsedType
      if (!ALLOWED_TYPES.has(type)) {
        json(res, 400, { error: 'unsupported-type' })
        return
      }
      if (!isTypeAllowedForRow(rowId, type)) {
        json(res, 400, { error: 'unsupported-type-for-row' })
        return
      }
      filename = `${nanoid()}.${extForType(type)}`
      filePath = path.join(assetsDir, filename)
      await fs.writeFile(filePath, body)
      fileSize = body.length
    } else {
      const contentLength = Number(req.headers['content-length'] || 0)
      if (contentLength && contentLength > MAX_BYTES) {
        json(res, 413, { error: 'payload-too-large' })
        return
      }
      if (!ALLOWED_TYPES.has(type)) {
        json(res, 400, { error: 'unsupported-type' })
        return
      }
      if (!isTypeAllowedForRow(rowId, type)) {
        json(res, 400, { error: 'unsupported-type-for-row' })
        return
      }
      filename = `${nanoid()}.${extForType(type)}`
      filePath = path.join(assetsDir, filename)
      const stream = fsSync.createWriteStream(filePath)
      await new Promise((resolve, reject) => {
        req.pipe(stream)
        req.on('end', resolve)
        req.on('error', reject)
        stream.on('error', reject)
      })
      const stats = await fs.stat(filePath)
      fileSize = stats.size
    }

    const publicUrl = getPublicAssetUrl(filename)
    const assetId = await AssetsCollection.insertAsync({
      storyboardId,
      shotId,
      rowId,
      url: publicUrl,
      ...(durationSeconds ? { duration: durationSeconds } : {}),
      status: 'completed',
      meta: {
        content_type: type,
        file_size: fileSize,
        file_name: filename,
        ...(durationSeconds ? { duration_seconds: durationSeconds } : {})
      },
      createdAt: new Date()
    })

    const activeField = ACTIVE_FIELD_BY_ROW[rowId]
    if (activeField) {
      await ShotsCollection.updateAsync(shotId, {
        $set: { [activeField]: assetId, updatedAt: new Date() }
      })
    }

    json(res, 200, { assetId, url: publicUrl })
  } catch (error) {
    const code = error?.error === 'payload-too-large' ? 413 : 500
    json(res, code, { error: error?.message || 'upload-failed' })
  }
})
