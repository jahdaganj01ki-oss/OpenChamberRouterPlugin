import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'

const options = {
  hostname: 'api.github.com',
  path: '/repos/' + owner + '/' + repo + '/actions/runs/37239201181/jobs',
  headers: { 'User-Agent': 'OC', 'Accept': 'application/vnd.github+json' }
}

https.get(options, res => {
  let data = ''
  res.on('data', c => data += c)
  res.on('end', () => {
    try {
      const json = JSON.parse(data)
      const jobs = json.jobs || []
      console.log('Jobs found:', jobs.length)
      jobs.forEach(job => {
        console.log('---')
        console.log('Name:', job.name)
        console.log('Status:', job.status, 'Conclusion:', job.conclusion || '—')
        if (job.steps) {
          job.steps.forEach(s => {
            const ind = s.conclusion === 'success' ? '✓' : s.conclusion === 'failure' ? '✗' : s.conclusion === 'skipped' ? '⊘' : '?';
            console.log('  ' + ind + ' ' + s.name + ' - ' + s.status + '/' + (s.conclusion || '—'))
          })
        }
      })
    } catch (e) {
      console.log('Parse error:', e.message)
      console.log('Raw:', data.substring(0, 1000))
    }
  })
}).on('error', e => console.log('Error:', e.message))
