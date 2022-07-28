import { base32 } from 'multiformats/bases/base32'
import { base16 } from 'multiformats/bases/base16'

import { test, getMiniflare } from './utils/setup.js'
import { addFixtures } from './utils/fixtures.js'
import { GenericContainer, Wait } from 'testcontainers'

import { createErrorHtmlContent } from '../src/errors.js'

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

test.after(async (t) => {
  await t.context.container?.stop()
})

test('Fails when invalid cid is provided', async (t) => {
  const { mf } = t.context

  const invalidCid = 'bafy'
  const response = await mf.dispatchFetch(
    `https://${invalidCid}.ipfs.localhost:8787`
  )
  t.is(response.status, 400)

  const textResponse = await response.text()
  t.is(
    textResponse,
    createErrorHtmlContent(400, 'invalid CID: bafy: Unexpected end of data')
  )
})

test('Gets content', async (t) => {
  const { mf } = t.context

  const response = await mf.dispatchFetch(
    'https://bafkreihl44bu5rqxctfvl3ahcln7gnjgmjqi7v5wfwojqwriqnq7wo4n7u.ipfs.localhost:8787'
  )
  await response.waitUntil()
  t.is(await response.text(), 'Hello dot.storage! 😎')
})

test('Gets content with path', async (t) => {
  const { mf } = t.context

  const response = await mf.dispatchFetch(
    'https://bafybeih74zqc6kamjpruyra4e4pblnwdpickrvk4hvturisbtveghflovq.ipfs.localhost:8787/path'
  )
  t.is(await response.text(), 'Hello gateway.nft.storage resource!')
})

test('Gets content with other base encodings', async (t) => {
  const { mf } = t.context

  const cidStr = 'bafkreihl44bu5rqxctfvl3ahcln7gnjgmjqi7v5wfwojqwriqnq7wo4n7u'
  const decodedB32 = base32.decode(cidStr)
  const encodedB16 = base16.encode(decodedB32)

  const response = await mf.dispatchFetch(
    `https://${encodedB16.toString()}.ipfs.localhost:8787`
  )
  await response.waitUntil()
  t.is(await response.text(), 'Hello dot.storage! 😎')
})
