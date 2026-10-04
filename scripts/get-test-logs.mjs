import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'

// Get the latest run
const runsOptions = {
  hostname: 'api.github.com',
  path: `/repos/${owner}/${repo}/actions/runs?per_page=1`,
  headers: {
    'User-Agent': 'OpenChamberRouter',
    'Accept': 'application/vnd.github+json'
  }
}

https.get(runsOptions, res => {
  let data = ''
  res.on('data', d => data += d)
  res.on('end', () => {
    const json = JSON.parse(data)
    const runId = json.workflow_runs?.[0]?.id
    if (!runId) {
      console.log('No runs found')
      return
    }
    console.log('Run ID:', runId)

    // Get jobs for this run
    const jobsOptions = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
      headers: {
        'User-Agent': 'OpenChamberRouter',
        'Accept': 'application/vnd.github+json'
      }
    }

    https.get(jobsOptions, jobRes => {
      let jobData = ''
      jobRes.on('data', d => jobData += d)
      jobRes.on('end', () => {
        const jobJson = JSON.parse(jobData)
        const testJob = jobJson.jobs?.find(j => j.name === 'Tests')
        if (!testJob || !testJob.steps) {
          console.log('Test job not found or no steps')
          return
        }

        const testStep = testJob.steps.find(s => s.name === 'Run tests')
        if (!testStep) {
          console.log('Test step not found')
          return
        }

        // Try to get the step output via the check run API
        const checkRunOptions = {
          hostname: 'api.github.com',
          path: `/repos/${owner}/${repo}/check-runs/${testStep.check_run_id}`,
          headers: {
            'User-Agent': 'OpenChamberRouter',
            'Accept': 'application/vnd.github+json'
          }
        }

        https.get(checkRunOptions, checkRes => {
          let checkData = ''
          checkRes.on('data', d => checkData += d)
          checkRes.on('end', () => {
            try {
              const checkJson = JSON.parse(checkData)
              console.log('Check run output:')
              // Get the output
              if (checkJson.output?.text) {
                console.log(checkJson.output.text.substring(0, 5000))
              } else {
                console.log('No output text available')
                console.log(JSON.stringify(checkJson.output, null, 2).substring(0, 2000))
              }
            } catch (e) {
              console.log('Parse error:', e.message)
              console.log('Raw data:', checkData.substring(0, 2000))
            }
          })
        }).on('error', err => console.log('Check run error:', err.message))
      })
    }).on('error', err => console.log('Job error:', err.message))
  })
}).on('error', err => console.log('Error:', err.message))
