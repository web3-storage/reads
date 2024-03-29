import { Multibases } from 'ipfs-core-utils/multibases'
import { bases } from 'multiformats/basics'
import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import { sha256 } from 'multiformats/hashes/sha2'

import { InvalidUrlError } from '../errors.js'

/**
 * Parse subdomain URL and return cid.
 *
 * @param {URL} url
 */
export async function getCidFromSubdomainUrl (url) {
  // Replace "ipfs-staging" by "ipfs" if needed
  const host = url.hostname.replace('ipfs-staging', 'ipfs')
  const splitHost = host.split('.ipfs.')

  if (!splitHost.length) {
    throw new InvalidUrlError(url.hostname)
  }

  let cid
  try {
    cid = await normalizeCid(splitHost[0])
  } catch (/** @type {any} */ err) {
    throw new InvalidUrlError(`invalid CID: ${splitHost[0]}: ${err.message}`)
  }

  return cid
}

/**
 * Parse CID and return normalized b32 v1.
 *
 * @param {string} cid
 */
export async function normalizeCid (cid) {
  const baseDecoder = await getMultibaseDecoder(cid)
  const c = CID.parse(cid, baseDecoder)
  return c.toV1().toString()
}

/**
 * Get multibase to decode CID
 *
 * @param {string} cid
 */
async function getMultibaseDecoder (cid) {
  const multibaseCodecs = Object.values(bases)
  const basicBases = new Multibases({
    bases: multibaseCodecs
  })

  const multibasePrefix = cid[0]
  const base = await basicBases.getBase(multibasePrefix)

  return base.decoder
}

/**
 * Get denylist anchor with badbits format.
 *
 * @param {string} cid
 */
export async function toDenyListAnchor (cid) {
  const multihash = await sha256.digest(uint8arrays.fromString(`${cid}/`))
  const digest = multihash.bytes.subarray(2)
  return uint8arrays.toString(digest, 'hex')
}
