import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'

const options = {
  hostname: 'api.github.com',
  path: `/repos/${owner}/${repo}/actions/runs`,
  headers: {
    'User-Agent': 'OpenChamberRouter',
    'Accept': 'application/vnd.github+json'
  }
}

https.get(options, res => {
  let data = ''
  res.on('data', d => data += d)
  res.on('end', () => {
    try {
      const json = JSON.parse(data)
      const runs = json.workflow_runs || []
      console.log('Workflow runs:', runs.length)
      if (runs.length > 0) {
        const latest = runs[0]
        console.log('Latest run:')
        console.log('  ID:', latest.id)
        console.log('  Name:', latest.name)
        console.log('  Status:', latest.status)
        console.log('  Conclusion:', latest.conclusion)
        console.log('  SHA:', latest.head_sha?.substring(0, 8))
        console.log('  Branch:', latest.head_branch)
        console.log('  Created:', new Date(latest.created_at).toLocaleString())
        console.log('  URL:', latest.html_url)
        
        // Check jobs
        const runId = latest.id
        const jobOptions = {
          hostname: 'api.github.com',
          path: `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
          headers: {
            'User-Agent': 'OpenChamberRouter',
            'Accept': 'application/vnd.github+json'
          }
        }
        
        https.get(jobOptions, jobRes => {
          let jobData = ''
          jobRes.on('data', d => jobData += d)
          jobRes.on('end', () => {
            try {
              const jobJson = JSON.parse(jobData)
              console.log('\nJobs:')
              jobJson.jobs?.forEach(job => {
                console.log('  -', job.name, ':', job.status, '/', job.conclusion || 'ongoing')
                if (job.steps) {
                  job.steps.forEach(step => {
                    const status = step.status || 'pending'
                    const conclusion = step.conclusion || ''
                    const indicator = conclusion === 'failure' ? '✗' : conclusion === 'success' ? '✓' : '→'
                    console.log('    ', indicator, step.name, '-', status, conclusion)
                    if (step.conclusion === 'failure' && step.steps_output) {
                      console.log('      Output:', step.steps_output.substring(0, 200))
                    }
                  })
                }
              })
            } catch (e) {
              console.log('Job data:', jobData.substring(0, 500))
            }
          })
        }).on('error', err => console.log('Job error:', err.message))
      }
    } catch (e) {
      console.log('Error:', e.message)
      console.log('Data:', data.substring(0, 500))
    }
  })
}).on('error', err => console.log('Request error:', err.message))
