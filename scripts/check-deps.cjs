const fs = require('node:fs')
const { execSync } = require('node:child_process')

// Check if package-lock.json exists
console.log('package-lock.json exists:', fs.existsSync('package-lock.json'))

// Check if package-lock matches package.json
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'))
  
  // Check key dependencies
  const pkgDeps = pkg.devDependencies || {}
  const lockDeps = lock.packages?.['']?.devDependencies || {}
  
  let mismatched = false
  for (const [key, val] of Object.entries(pkgDeps)) {
    if (lockDeps[key] !== val) {
      console.log(`MISMATCH: ${key} - pkg: ${val} vs lock: ${lockDeps[key]}`)
      mismatched = true
    }
  }
  
  if (!mismatched) {
    console.log('✓ devDependencies match between package.json and package-lock.json')
  }
  
  // Check for tsx in lockfile
  console.log('tsx in lock packages:', !!lock.packages?.['node_modules/tsx'])
  console.log('sharp in lock packages:', !!lock.packages?.['node_modules/sharp'])
} catch (e) {
  console.log('Error:', e.message)
}

// Try npm ci dry run
try {
  console.log('\n=== npm ci dry run ===')
  execSync('npm ci --dry-run 2>&1', { stdio: 'inherit' })
  console.log('npm ci dry run: OK')
} catch (e) {
  console.log('npm ci dry run FAILED')
}
