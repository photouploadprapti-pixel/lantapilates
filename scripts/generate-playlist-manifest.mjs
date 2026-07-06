import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outDir = process.argv[2]
const playlistId = process.argv[3]

if (!outDir || !playlistId) {
  console.error('Usage: node generate-playlist-manifest.mjs <output-dir> <playlist-id>')
  process.exit(1)
}

const videoExtensions = new Set(['.mp4', '.webm', '.mkv', '.mov'])

const readTitle = async (videoPath, index) => {
  const infoPath = `${videoPath}.info.json`
  try {
    const raw = await readFile(infoPath, 'utf8')
    const data = JSON.parse(raw)
    if (
      typeof data === 'object'
      && data !== null
      && data._type !== 'playlist'
      && typeof data.title === 'string'
    ) {
      const title = data.title.trim()
      if (title.length > 0) return title
    }
  } catch {
    // Ignore missing or invalid metadata files.
  }

  return `Workout ${index + 1}`
}

const files = (await readdir(outDir))
  .filter((file) => videoExtensions.has(path.extname(file).toLowerCase()))
  .sort()

const videos = await Promise.all(
  files.map(async (file, index) => ({
    id: `video-${index + 1}`,
    title: await readTitle(path.join(outDir, file), index),
    src: `/videos/reformer/${file}`,
  })),
)

const manifest = {
  playlistId,
  videos,
}

await writeFile(
  path.join(outDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
)

console.log(`Wrote manifest with ${videos.length} video(s).`)
