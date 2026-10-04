import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'

const options = {
  hostname: 'api.github.com',
  path: `/repos/${owner}/${repo}/actions/runs?per_page=3`,
  headers: {
    'User-Agent': 'OpenChamberRouter',
    'Accept': 'application/vnd.github+json'
  }
}

https.get(options, res => {
  let data = ''
  res.on('data', d => data += d)
  res.on('end', () => {
    const json = JSON.parse(data)
    const runs = json.workflow_runs || []
    runs.slice(0, 3).forEach(r => {
      console.log(`\n--- Run #${r.id} ---`)
      console.log('  SHA:', r.head_sha?.substring(0, 8))
      console.log('  Status:', r.status)
      console.log('  Conclusion:', r.conclusion)
      console.log('  Created:', new Date(r.created_at).toLocaleString())
    })
  })
}).on('error', err => console.log('Error:', err.message))
