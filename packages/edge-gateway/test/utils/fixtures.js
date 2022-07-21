import path from 'path'
import { fileURLToPath } from 'url'
import { create } from 'ipfs-http-client'
import globSource from 'ipfs-utils/src/files/glob-source.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * @param {number} port
 */
export async function addFixtures (port) {
  const client = create({ url: `http://127.0.0.1:${port}` })

  // Add fixture files
  await Promise.all([
    // bafkreihl44bu5rqxctfvl3ahcln7gnjgmjqi7v5wfwojqwriqnq7wo4n7u
    client.add('Hello dot.storage! 😎', {
      rawLeaves: true
    }),
    // bafkreibehzafi6gdvlyue5lzxa3rfobvp452kylox6f4vwqpd4xbr53uqu
    client.add('Hello dot.storage! 😎😎', {
      rawLeaves: true
    }),
    // bafkreifbh4or5yoti7bahifd3gwx5m2qiwmrvpxsx3nsquf7r4wwkiruve
    client.add('Hello dot.storage! 😎😎😎', {
      rawLeaves: true
    })
  ])

  // bafybeih74zqc6kamjpruyra4e4pblnwdpickrvk4hvturisbtveghflovq
  // eslint-disable-next-line no-unused-vars
  for await (const _ of client.addAll(
    globSource(path.join(__dirname, '../fixtures/directory'), '**/*'),
    {
      rawLeaves: true,
      wrapWithDirectory: true,
      cidVersion: 1
    }
    // eslint-disable-next-line no-empty
  )) {
  }
}
