const { execSync } = require('child_process')

try {
  execSync('git add -A', { encoding: 'utf8', stdio: 'pipe' })
  const status = execSync('git status --short', { encoding: 'utf8' })
  console.log('Status before commit:', status)
  
  execSync('git commit -m "Remove helper scripts"', { encoding: 'utf8' })
  console.log('Committed successfully')
  
  const out = execSync('git push origin main', { encoding: 'utf8' })
  console.log('Push output:', out)
} catch(e) {
  console.log('Error:', e.message)
  console.log('stdout:', e.stdout?.toString())
  console.log('stderr:', e.stderr?.toString())
}
