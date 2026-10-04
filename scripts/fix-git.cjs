const fs = require('fs')
// Remove helper scripts that shouldn't be in the repo
const filesToRemove = ['scripts/git-status.cjs', 'scripts/cleanup.cjs']
for (const f of filesToRemove) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f)
    console.log('Removed:', f)
  }
}
// Remove cleanup.cjs from git tracking
const { execSync } = require('child_process')
try {
  execSync('git rm --cached scripts/cleanup.cjs', { encoding: 'utf8', stdio: 'pipe' })
  console.log('Removed cleanup.cjs from git')
} catch(e) {
  console.log('cleanup.cjs not in git:', e.message)
}

try {
  execSync('git rm --cached scripts/git-status.cjs', { encoding: 'utf8', stdio: 'pipe' })
  console.log('Removed git-status.cjs from git')
} catch(e) {
  console.log('git-status.cjs not in git:', e.message)
}

// Check status
try {
  const status = execSync('git status --short', { encoding: 'utf8' })
  console.log('Git status:', status)
} catch(e) {
  console.log('Git status failed:', e.message)
}
