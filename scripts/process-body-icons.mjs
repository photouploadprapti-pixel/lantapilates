import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconsDir = path.join(__dirname, '../public/icons/body-areas')

const EDGE_MARGIN = 22
const CHEST_FAINT_ALPHA = 115
const CHEST_THICKEN_RADIUS = 4

/**
 * Expands alpha channel so line art appears thicker (matches arms visual weight).
 */
const thickenLineArt = (
  data,
  width,
  height,
  channels,
  radius,
) => {
  const size = width * height
  const alpha = new Uint8Array(size)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      alpha[y * width + x] = data[(y * width + x) * channels + 3]
    }
  }

  const dilated = new Uint8Array(size)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let peak = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            peak = Math.max(peak, alpha[ny * width + nx])
          }
        }
      }
      dilated[y * width + x] = peak
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      const value = dilated[y * width + x]
      if (value > 50) {
        data[idx] = 255
        data[idx + 1] = 255
        data[idx + 2] = 255
        data[idx + 3] = 255
      } else {
        data[idx + 3] = 0
      }
    }
  }
}

/**
 * Normalizes mixed PNG formats (alpha-only silhouettes and RGB icons) to
 * white line art on a transparent background for CSS masking.
 */
const processIcon = async (filePath) => {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const fileName = path.basename(filePath)
  const isChest = fileName === 'chest.png'

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b

      let opacity = 0

      if (lum < 8) {
        opacity = a
      } else if (lum > 210) {
        opacity = 0
      } else if (lum > 35) {
        opacity = Math.max(a, lum)
      } else {
        opacity = Math.max(a, 255 - lum)
      }

      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      let alpha = opacity > 18 ? Math.min(255, Math.round(opacity)) : 0

      const nearEdge = (
        x < EDGE_MARGIN
        || x >= width - EDGE_MARGIN
        || y < EDGE_MARGIN
        || y >= height - EDGE_MARGIN
      )

      if (isChest && nearEdge && alpha > 0 && alpha < CHEST_FAINT_ALPHA) {
        alpha = 0
      }

      data[i + 3] = alpha
    }
  }

  if (isChest) {
    thickenLineArt(data, width, height, channels, CHEST_THICKEN_RADIUS)
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(filePath)
}

const files = await readdir(iconsDir)
const pngs = files.filter((name) => name.endsWith('.png'))
await Promise.all(pngs.map((name) => processIcon(path.join(iconsDir, name))))

console.log(`Processed ${pngs.length} icons`)
