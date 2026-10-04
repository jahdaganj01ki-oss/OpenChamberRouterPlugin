import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'

function dispatchWorkflow() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/actions/workflows/build.yml/dispatches`,
      method: 'POST',
      headers: {
        'User-Agent': 'OpenChamberRouter',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      }
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data })
      })
    })

    req.on('error', reject)
    req.write(JSON.stringify({ ref: 'main' }))
    req.end()
  })
}

const result = await dispatchWorkflow()
console.log('Dispatch result:', result.status, result.body)
