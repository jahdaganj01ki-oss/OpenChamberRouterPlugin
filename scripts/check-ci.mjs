import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'

const options = {
  hostname: 'api.github.com',
  path: '/repos/' + owner + '/' + repo + '/actions/runs?per_page=1',
  headers: { 'User-Agent': 'OC', 'Accept': 'application/vnd.github+json' }
}

https.get(options, res => {
  let data = ''
  res.on('data', c => data += c)
  res.on('end', () => {
    const json = JSON.parse(data)
    const runs = json.workflow_runs || []
    const r = runs[0]
    console.log('Run:', r.id)
    console.log('SHA:', r.head_sha?.substring(0, 8))
    console.log('Status:', r.status)
    console.log('Conclusion:', r.conclusion)
    
    if (r.head_sha?.substring(0, 8) === 'b566dc5f') {
      console.log('\n✓ This is the run for commit b566dc5!')
    } else {
      console.log('\n✗ This is NOT the run for commit b566dc5 (expected b566dc5f)')
    }
  })
}).on('error', e => console.log('Error:', e.message))
