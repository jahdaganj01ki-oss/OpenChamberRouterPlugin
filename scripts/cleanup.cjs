const fs = require('fs')
if (fs.existsSync('scripts/check-deps.cjs')) {
  fs.unlinkSync('scripts/check-deps.cjs')
  console.log('removed')
} else {
  console.log('already gone')
}
console.log('Scripts:', fs.readdirSync('scripts').join(', '))
