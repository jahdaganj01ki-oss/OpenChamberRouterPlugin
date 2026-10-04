const fs = require('fs')
const { execSync } = require('child_process')

// Remove helper scripts
const filesToRemove = [
  'scripts/git-status.cjs',
  'scripts/push-fix.cjs',
  'scripts/check-ci.mjs',
  'scripts/fix-git.cjs'
]

for (const f of filesToRemove) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f)
    console.log('Removed:', f)
    try {
      execSync('git rm --cached ' + f, { encoding: 'utf8', stdio: 'pipe' })
      console.log('Git: removed', f)
    } catch(e) {
      console.log('Git: already not tracked:', f)
    }
  }
}

// Commit and push
try {
  execSync('git add -A', { encoding: 'utf8' })
  const status = execSync('git status --short', { encoding: 'utf8' })
  console.log('Status:', status)
  
  if (status.trim()) {
    execSync('git commit -m "Fix: Use bun test test/ + cleanup helper scripts"', { encoding: 'utf8' })
    console.log('Committed')
  }
  
  const out = execSync('git push origin main', { encoding: 'utf8' })
  console.log('Push:', out)
} catch(e) {
  console.log('Git error:', e.message)
  console.log('stdout:', e.stdout?.toString())
  console.log('stderr:', e.stderr?.toString())
}
