import { GenericContainer, Wait } from 'testcontainers'
import pRetry from 'p-retry'

import { test, getMiniflare } from './utils/setup.js'
import { addFixtures } from './utils/fixtures.js'

import { RESOLUTION_LAYERS, RESOLUTION_IDENTIFIERS } from '../src/constants.js'

test.before(async (t) => {
  const container = await new GenericContainer('ipfs/go-ipfs:v0.13.0')
    .withExposedPorts(
      {
        container: 8080,
        host: 9081,
      },
      5001
    )
    .withWaitStrategy(Wait.forLogMessage('Daemon is ready'))
    .start()

  // Add fixtures
  await addFixtures(container.getMappedPort(5001))

  t.context = {
    container,
    mf: getMiniflare(),
  }
})

test.beforeEach(async (t) => {
  t.context = {
    ...t.context,
    mf: getMiniflare(),
  }
})

test.after(async (t) => {
  await t.context.container?.stop()
})

test('Caches content on resolve', async (t) => {
  const url =
    'https://bafkreihl44bu5rqxctfvl3ahcln7gnjgmjqi7v5wfwojqwriqnq7wo4n7u.ipfs.localhost:8787/'
  const content = 'Hello dot.storage! 😎'
  const { mf } = t.context

  const response = await mf.dispatchFetch(url)
  await response.waitUntil()
  t.is(await response.text(), content)

  // Miniflare cache sometimes is not yet setup...
  await pRetry(async () => {
    const cachedRes = await mf.dispatchFetch(url)
    if (!cachedRes) {
      throw new Error('response was not cached')
    }

    t.is(await cachedRes.text(), content)

    // Validate x-dotstorage headers
    t.is(
      cachedRes.headers.get('x-dotstorage-resolution-layer'),
      RESOLUTION_LAYERS.CDN
    )
    t.is(
      cachedRes.headers.get('x-dotstorage-resolution-id'),
      RESOLUTION_IDENTIFIERS.CACHE_ZONE
    )
  })
})

test('Get content from Perma cache if existing', async (t) => {
  // Should go through Perma cache bucket
  const { mf } = t.context
  const url =
    'https://bafybeic2hr75ukgwhnasdl3sucxyfedfyp3dijq3oakzx6o24urcs4eige.ipfs.localhost:8787/'

  const content = 'Hello perma cache!'

  const response = await mf.dispatchFetch(url)
  await response.waitUntil()
  t.is(await response.text(), content)

  // Validate x-dotstorage headers
  t.is(
    response.headers.get('x-dotstorage-resolution-layer'),
    RESOLUTION_LAYERS.CDN
  )
  t.is(
    response.headers.get('x-dotstorage-resolution-id'),
    RESOLUTION_IDENTIFIERS.PERMA_CACHE
  )
})

test('Fail to resolve when only-if-cached and content is not cached', async (t) => {
  const url =
    'https://bafkreihl44bu5rqxctfvl3ahcln7gnjgmjqi7v5wfwojqwriqnq7wo4n7u.ipfs.localhost:8787/'
  const { mf } = t.context

  const response = await mf.dispatchFetch(url, {
    headers: { 'Cache-Control': 'only-if-cached' },
  })
  await response.waitUntil()
  t.is(response.ok, false)
  t.is(response.status, 408)
})

test('Get content from cache when existing and only-if-cached cache control is provided', async (t) => {
  const { mf } = t.context
  const url =
    'https://bafybeic2hr75ukgwhnasdl3sucxyfedfyp3dijq3oakzx6o24urcs4eige.ipfs.localhost:8787/'
  const content = 'Hello perma cache!'

  const response = await mf.dispatchFetch(url, {
    headers: { 'Cache-Control': 'only-if-cached' },
  })
  await response.waitUntil()
  t.is(await response.text(), content)

  // Validate x-dotstorage headers
  t.is(
    response.headers.get('x-dotstorage-resolution-layer'),
    RESOLUTION_LAYERS.CDN
  )
  t.is(
    response.headers.get('x-dotstorage-resolution-id'),
    RESOLUTION_IDENTIFIERS.PERMA_CACHE
  )
})

test('Should not get from cache if no-cache cache control header is provided', async (t) => {
  const url =
    'https://bafybeic2hr75ukgwhnasdl3sucxyfedfyp3dijq3oakzx6o24urcs4eige.ipfs.localhost:8787/'
  const { mf } = t.context

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)

  try {
    await mf.dispatchFetch(url, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    })
    throw new Error('should not resolve')
  } catch (err) {
    t.assert(err)
  } finally {
    clearTimeout(timer)
  }
})
