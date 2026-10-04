const fs = require('fs')
const { execSync } = require('child_process')

// Clean up all helper scripts
for (const f of ['scripts/check-ci.mjs', 'scripts/test-ci-sim.cjs', 'scripts/check-root.cjs']) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f)
    console.log('Removed:', f)
    try { execSync('git rm --cached ' + f, { encoding: 'utf8', stdio: 'pipe' }) } catch(e) {}
  }
}

// Commit and push
try {
  execSync('git add -A', { encoding: 'utf8' })
  const status = execSync('git status --short', { encoding: 'utf8' })
  console.log('Status:', status)
  if (status.trim()) {
    execSync('git commit -m "Fix: Restore working test config + cleanup helpers"', { encoding: 'utf8' })
    console.log('Committed')
  }
  const out = execSync('git push origin main', { encoding: 'utf8' })
  console.log('Push:', out)
} catch(e) {
  console.log('Error:', e.message)
  if (e.stdout) console.log('stdout:', e.stdout.toString().substring(0, 500))
  if (e.stderr) console.log('stderr:', e.stderr.toString().substring(0, 500))
}
