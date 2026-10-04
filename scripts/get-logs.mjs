import https from 'node:https'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'
const runId = '37235644356'

// Try to get logs via the logs download endpoint
const options = {
  hostname: 'api.github.com',
  path: `/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
  headers: {
    'User-Agent': 'OpenChamberRouter',
    'Accept': 'application/vnd.github+json'
  }
}

https.get(options, res => {
  console.log('Status:', res.statusCode)
  console.log('Location:', res.headers.location)
  
  if (res.statusCode === 302 && res.headers.location) {
    const logUrl = new URL(res.headers.location)
    const logOptions = {
      hostname: logUrl.hostname,
      path: logUrl.pathname + logUrl.search,
      headers: {
        'User-Agent': 'OpenChamberRouter',
        'Accept': 'application/vnd.github+json'
      }
    }
    
    https.get(logOptions, logRes => {
      let data = Buffer.from([])
      logRes.on('data', d => data = Buffer.concat([data, d]))
      logRes.on('end', () => {
        fs.writeFileSync('/tmp/github-actions-logs.zip', data)
        console.log('Saved logs to /tmp/github-actions-logs.zip')
        console.log('Size:', data.length, 'bytes')
      })
    }).on('error', err => console.log('Log download error:', err.message))
  } else {
    let body = ''
    res.on('data', d => body += d)
    res.on('end', () => console.log('Body:', body.substring(0, 500)))
  }
}).on('error', err => console.log('Error:', err.message))
