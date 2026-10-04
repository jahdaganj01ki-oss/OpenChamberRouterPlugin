const { execSync } = require('child_process')

// Check committed package.json
const pkg = execSync('git show HEAD:package.json', { encoding: 'utf8' })
const pkgJson = JSON.parse(pkg)
console.log('Committed test script:', pkgJson.scripts.test)
console.log('Committed devDependencies:', Object.keys(pkgJson.devDependencies || {}))

// Check committed workflow
const wf = execSync('git show HEAD:.github/workflows/build.yml', { encoding: 'utf8' })
console.log('\nWorkflow test job:')
const lines = wf.split('\n')
let inTest = false
let depth = 0
for (const line of lines) {
  if (line.includes('test:')) {
    inTest = true
    depth = (line.match(/^\s*/)[0].length)
  }
  if (inTest) {
    if (line.match(/^\s{2}\w/) && !line.includes('test:') && depth === 2) {
      continue
    }
    console.log(line)
    if (line.trim() === '' && depth === 0) break
  }
}

// Actually just print the whole workflow
console.log('\n=== Full workflow ===')
console.log(wf)
