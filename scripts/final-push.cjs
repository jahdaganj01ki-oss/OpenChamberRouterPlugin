const fs = require('fs')
const { execSync } = require('child_process')

// Remove all helper scripts
for (const f of ['scripts/check-ci.mjs', 'scripts/final-cleanup.cjs']) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f)
    console.log('Removed:', f)
    try { execSync('git rm --cached ' + f, { encoding: 'utf8', stdio: 'pipe' }) } catch(e) {}
  }
}

// Commit and push
try {
  execSync('git add -A', { encoding: 'utf8' })
  execSync('git commit -m "Fix: Explicit test file glob for CI" --allow-empty', { encoding: 'utf8' })
  const out = execSync('git push origin main', { encoding: 'utf8' })
  console.log('Push:', out)
} catch(e) {
  console.log('Git error:', e.message)
  if (e.stdout) console.log('stdout:', e.stdout.toString())
  if (e.stderr) console.log('stderr:', e.stderr.toString())
}
