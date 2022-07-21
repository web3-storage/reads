import { GenericContainer, Wait } from 'testcontainers'
import { test, getMiniflare } from './utils/setup.js'
import { addFixtures } from './utils/fixtures.js'
import { toDenyListAnchor } from '../src/utils/deny-list.js'

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

test.beforeEach(async (t) => {
  t.context = {
    ...t.context,
    mf: getMiniflare()
  }
})

test.after(async (t) => {
  await t.context.container?.stop()
})

test('Blocks access to a CID on the deny list', async (t) => {
  const { mf } = t.context
  const cid = 'bafkreidyeivj7adnnac6ljvzj2e3rd5xdw3revw4da7mx2ckrstapoupoq'

  // add the CID to the deny list
  const denyListKv = await mf.getKVNamespace('DENYLIST')
  const anchor = await toDenyListAnchor(cid)

  await denyListKv.put(anchor, '{}')

  const res = await mf.dispatchFetch(`https://${cid}.ipfs.localhost:8787`)
  t.is(res.status, 410)
  t.is(await res.text(), '')
})

test('Blocks access to a CID resource on the deny list', async (t) => {
  const { mf } = t.context
  const resourceCid =
    'bafkreia4d2wzubczuknsuwcrta2psy7rjkso4xxryjep44yvddtp6pe5vu'

  // add the resourceCid to the deny list
  const denyListKv = await mf.getKVNamespace('DENYLIST')
  const anchor = await toDenyListAnchor(resourceCid)

  await denyListKv.put(anchor, '{}')

  const res = await mf.dispatchFetch(
    'https://bafybeih74zqc6kamjpruyra4e4pblnwdpickrvk4hvturisbtveghflovq.ipfs.localhost:8787/path'
  )
  t.is(res.status, 410)
  t.is(await res.text(), '')
})

test('Blocks access to a CID on the deny list with custom status and reason', async (t) => {
  const { mf } = t.context
  const cid = 'bafkreidyeivj7adnnac6ljvzj2e3rd5xdw3revw4da7mx2ckrstapoupoq'

  // add the CID to the deny list
  const denyListKv = await mf.getKVNamespace('DENYLIST')
  const anchor = await toDenyListAnchor(cid)

  // 451: Unavailable For Legal Reasons
  await denyListKv.put(anchor, JSON.stringify({ status: 451, reason: 'bad' }))

  const res = await mf.dispatchFetch(`https://${cid}.ipfs.localhost:8787`)
  t.is(res.status, 451)
  t.is(await res.text(), 'bad')
})
