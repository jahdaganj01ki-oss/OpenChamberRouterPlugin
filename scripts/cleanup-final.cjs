const fs = require('fs')
const { execSync } = require('child_process')

// Remove helper scripts
for (const f of ['scripts/check-success.cjs', 'scripts/check-sync.cjs', 'scripts/check-root.cjs', 'scripts/final-push.cjs']) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f)
    console.log('Removed:', f)
    try { execSync('git rm --cached ' + f, { encoding: 'utf8', stdio: 'pipe' }) } catch(e) {}
  }
}

// Check scripts directory
console.log('Scripts:', fs.readdirSync('scripts').join(', '))

// Commit and push
try {
  execSync('git add -A', { encoding: 'utf8' })
  const status = execSync('git status --short', { encoding: 'utf8' })
  console.log('Status:', status)
  if (status.trim()) {
    execSync('git commit -m "Fix: Clean up scripts, restore working config" --allow-empty', { encoding: 'utf8' })
    console.log('Committed')
  }
  const out = execSync('git push origin main', { encoding: 'utf8' })
  console.log('Push:', out)
} catch(e) {
  console.log('Error:', e.message)
  if (e.stdout) console.log('stdout:', e.stdout.toString())
  if (e.stderr) console.log('stderr:', e.stderr.toString())
}
