const fs = require('fs')
const { execSync } = require('child_process')

// Clean up helper scripts
for (const f of ['scripts/git-check.cjs', 'scripts/check-imports.cjs', 'scripts/final-push.cjs']) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f)
    console.log('Removed:', f)
    try { execSync('git rm --cached ' + f, { encoding: 'utf8', stdio: 'pipe' }) } catch(e) {}
  }
}

// Commit and push
try {
  execSync('git add -A', { encoding: 'utf8' })
  execSync('git commit -m "Fix: Restore working test configuration + cleanup"', { encoding: 'utf8' })
  const out = execSync('git push origin main', { encoding: 'utf8' })
  console.log('Push:', out)
} catch(e) {
  console.log('Git error:', e.message)
  console.log('stdout:', e.stdout?.toString() || '')
  console.log('stderr:', e.stderr?.toString() || '')
}
