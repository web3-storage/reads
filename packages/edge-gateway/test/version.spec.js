import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import git from 'git-rev-sync'

import { test, getMiniflare, secrets } from './utils/setup.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
)

// Create a new Miniflare environment for each test
test.before((t) => {
  t.context = {
    mf: getMiniflare()
  }
})

test('Gets Version', async (t) => {
  const { mf } = t.context

  const response = await mf.dispatchFetch('http://localhost:8787/version')
  const { version, commit, branch, raceGatewaysL1, raceGatewaysL2 } = await response.json()

  t.is(version, pkg.version)
  t.is(commit, git.long(__dirname))
  t.is(branch, git.branch(__dirname))
  t.deepEqual(raceGatewaysL1, JSON.parse(secrets.IPFS_GATEWAYS_RACE_L1))
  t.deepEqual(raceGatewaysL2, JSON.parse(secrets.IPFS_GATEWAYS_RACE_L2))
})
