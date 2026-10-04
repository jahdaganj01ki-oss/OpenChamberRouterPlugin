import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const dir = 'Logos-einheitlich-weiss'
const files = fs.readdirSync(dir).filter(f => !f.includes('README'))

const toFix = []
for (const f of files) {
  const meta = await sharp(path.join(dir, f)).metadata()
  if (meta.width !== 512 || meta.height !== 512) {
    toFix.push({ file: f, width: meta.width, height: meta.height })
  }
}

console.log(`Found ${toFix.length} logos to resize to 512x512`)

for (const { file, width, height } of toFix) {
  const inputPath = path.join(dir, file)
  const outputPath = inputPath + '.tmp'

  await sharp(inputPath)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .extend({
      top: Math.floor((512 - width) / 2),
      bottom: Math.ceil((512 - height) / 2),
      left: Math.floor((512 - width) / 2),
      right: Math.ceil((512 - height) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ quality: 100 })
    .toFile(outputPath)

  fs.unlinkSync(inputPath)
  fs.renameSync(outputPath, inputPath)
  
  const newSize = fs.statSync(inputPath).size
  console.log(`  ✓ ${file.padEnd(25)} ${width}x${height} -> 512x512 (${newSize}b)`)
}

// Verify final state
const finalFiles = fs.readdirSync(dir).filter(f => !f.includes('README'))
const allCorrectSize = finalFiles.every(f => {
  const meta = sharp(path.join(dir, f)).metadata()
  return true
})

// Check sizes
let correct = 0, wrong = 0
for (const f of finalFiles) {
  const meta = await sharp(path.join(dir, f)).metadata()
  if (meta.width === 512 && meta.height === 512) correct++
  else wrong++
}

console.log(`\n=== Final: ${correct} correct (512x512), ${wrong} wrong ===`)
