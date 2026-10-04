const fs = require('fs')
const { execSync } = require('child_process')

// Remove helper scripts
for (const f of ['scripts/check-lock.cjs', 'scripts/check-ci.mjs']) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f)
    console.log('Removed:', f)
    try { execSync('git rm --cached ' + f, { encoding: 'utf8', stdio: 'pipe' }) } catch(e) {}
  }
}

// Add final-push.cjs for now, remove later
const status = execSync('git status --short', { encoding: 'utf8' })
console.log('Status:', status)

execSync('git add -A', { encoding: 'utf8' })
execSync('git commit -m "Fix: npm install + verbose debug for CI test step"', { encoding: 'utf8' })
const out = execSync('git push origin main', { encoding: 'utf8' })
console.log('Push:', out)
