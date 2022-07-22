import { GenericContainer, Wait } from 'testcontainers'
import { test, getMiniflare } from './utils/setup.js'
import { addFixtures } from './utils/fixtures.js'

test.before(async (t) => {
  const container = await new GenericContainer('ipfs/go-ipfs:v0.13.0')
    .withExposedPorts({
      container: 8080,
      host: 9081
    },
    5001
    )
    .withWaitStrategy(Wait.forLogMessage('Daemon is ready'))
    .start()

  // Add fixtures
  await addFixtures(container.getMappedPort(5001))

  t.context = {
    container,
    mf: getMiniflare()
  }
})

test.after(async (t) => {
  await t.context.container?.stop()
})

test('should redirect to dweb.link with IPNS subdomain resolution', async (t) => {
  const { mf } = t.context

  const response = await mf.dispatchFetch(
    'https://en-wikipedia--on--ipfs-org.ipns.localhost:8787/Energy?key=value'
  )
  await response.waitUntil()
  t.is(response.status, 302)
  t.is(
    response.headers.get('location'),
    'https://en-wikipedia--on--ipfs-org.ipns.dweb.link/Energy?key=value'
  )
})
