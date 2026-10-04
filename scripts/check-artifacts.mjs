import https from 'node:https'

const owner = 'jahdaganj01ki-oss'
const repo = 'OpenChamberRouterPlugin'

const options = {
  hostname: 'api.github.com',
  path: `/repos/${owner}/${repo}/actions/artifacts?per_page=30`,
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
    console.log('All artifacts:')
    json.artifacts?.forEach(a => {
      console.log('  -', a.name, ':', a.size_in_bytes, 'bytes')
      console.log('    Created:', new Date(a.created_at).toLocaleString())
      if (a.workflow_run) console.log('    Run ID:', a.workflow_run.id)
    })
    
    // Also check for releases
    const releases = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/releases`,
      headers: {
        'User-Agent': 'OpenChamberRouter',
        'Accept': 'application/vnd.github+json'
      }
    }
    
    https.get(releases, res2 => {
      let d2 = ''
      res2.on('data', c => d2 += c)
      res2.on('end', () => {
        try {
          const j2 = JSON.parse(d2)
          console.log('\nReleases:')
          j2.forEach(r => {
            console.log('  -', r.name, ':', r.tag_name)
            r.assets?.forEach(a => {
              console.log('    asset:', a.name, ':', a.size_mb ? a.size_mb + 'MB' : a.size + 'bytes')
            })
          })
          if (j2.length === 0) console.log('  (no releases)')
        } catch(e) {
          console.log('Releases error:', d2.substring(0, 200))
        }
      })
    }).on('error', e => console.log('Release check error:', e.message))
  })
}).on('error', e => console.log('Error:', e.message))
