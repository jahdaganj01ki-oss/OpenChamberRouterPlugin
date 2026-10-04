import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'
const runId = '37235141143'

const options = {
  hostname: 'api.github.com',
  path: `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
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
    const jobs = json.jobs || []
    jobs.forEach(job => {
      console.log(`\n=== ${job.name} ===`)
      console.log('Status:', job.status, 'Conclusion:', job.conclusion)
      if (job.steps) {
        job.steps.forEach(step => {
          const status = step.status || ''
          const conclusion = step.conclusion || ''
          const indicator = {
            success: '✓',
            failure: '✗',
            skipped: '⊘',
            in_progress: '→',
            pending: '⌛'
          }[conclusion || status] || '?'
          console.log(`  ${indicator} ${step.name} - ${status}/${conclusion || '—'}`)
        })
      }
    })
  })
}).on('error', err => console.log('Error:', err.message))
