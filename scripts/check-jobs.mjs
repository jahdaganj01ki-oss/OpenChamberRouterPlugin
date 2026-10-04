import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'
const runId = '37236672132'

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
  res.on('data', c => data += c)
  res.on('end', () => {
    const json = JSON.parse(data)
    json.jobs?.forEach(job => {
      const ind = job.conclusion === 'success' ? '✓' : job.conclusion === 'failure' ? '✗' : job.status === 'in_progress' ? '→' : '?'
      console.log(`${ind} ${job.name}: ${job.status}/${job.conclusion || '—'}`)
      if (job.steps && job.conclusion === 'failure') {
        console.log('  Failed steps:')
        job.steps.forEach(step => {
          if (step.conclusion !== 'success' && step.status !== 'skipped') {
            const s = step.conclusion === 'failure' ? '✗' : '?'
            console.log(`    ${s} ${step.name} - ${step.status}/${step.conclusion || '—'}`)
          }
        })
      }
    })
  })
}).on('error', e => console.log('Error:', e.message))
