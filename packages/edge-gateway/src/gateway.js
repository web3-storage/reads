/* eslint-env serviceworker, browser */
/* global Response caches */

import pAny, { AggregateError } from 'p-any'
import pRetry from 'p-retry'
import { FilterError } from 'p-some'

import { getCidFromSubdomainUrl } from './utils/cid.js'
import { getHeaders } from './utils/headers.js'
import { toDenyListAnchor } from './utils/deny-list.js'
import { TimeoutError } from './errors.js'
import { CF_CACHE_MAX_OBJECT_SIZE } from './constants.js'

/**
 * @typedef {import('./env').Env} Env
 */

/**
 * Handle gateway request.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {import('./index').Ctx} ctx
 */
export async function gatewayGet(request, env, ctx) {
  // Redirect to dweb.link if ipns request
  // TODO: integrate with w3name
  if (request.url.includes(env.IPNS_GATEWAY_HOSTNAME)) {
    return Response.redirect(
      request.url.replace(env.IPNS_GATEWAY_HOSTNAME, 'ipns.dweb.link'),
      302
    )
  }

  const reqUrl = new URL(request.url)
  const cid = getCidFromSubdomainUrl(reqUrl)
  const pathname = reqUrl.pathname

  // Validation layer - root CID validation
  const denyListRootCidEntry = await getFromDenyList(env.DENYLIST, cid)
  if (denyListRootCidEntry) {
    const { status, reason } = JSON.parse(denyListRootCidEntry)
    return new Response(reason || '', { status: status || 410 })
  }

  // 1st layer resolution - CDN
  const cache = caches.default
  const res = await getFromCdn(request, env, cache)
  if (res) {
    // TODO! Update cache metrics in background https://github.com/web3-storage/reads/issues/10
    // const responseTime = Date.now() - startTs

    // options.onCdnResolution && options.onCdnResolution(res, responseTime)
    return res
  } else if (
    (request.headers.get('Cache-Control') || '').includes('only-if-cached')
  ) {
    throw new TimeoutError()
  }

  // 2nd layer resolution - Public Gateways race
  const winnerGwResponse = await env.gwRacer.get(cid, {
    pathname,
    headers: getHeaders(request),
    noAbortRequestsOnWinner: true,
  })

  // Validation layer - resource CID
  if (winnerGwResponse && pathname !== '/') {
    const resourceCid = decodeURIComponent(
      winnerGwResponse.headers.get('etag') || ''
    )
    const denyListResource = await getFromDenyList(env.DENYLIST, resourceCid)
    if (denyListResource) {
      const { status, reason } = JSON.parse(denyListResource)
      return new Response(reason || '', { status: status || 410 })
    }
  }

  // Cache response
  if (winnerGwResponse && winnerGwResponse.ok) {
    ctx.waitUntil(putToCache(request, winnerGwResponse, cache))
  }

  // TODO metrics https://github.com/web3-storage/reads/issues/10

  return winnerGwResponse
}

/**
 * CDN url resolution.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Cache} cache
 */
async function getFromCdn(request, env, cache) {
  // Should skip cache if instructed by headers
  if ((request.headers.get('Cache-Control') || '').includes('no-cache')) {
    return undefined
  }

  try {
    const cdnRequests = [
      // Request from cache API
      cache.match(request),
      // Get from API Perma Cache Binding.
      getFromPermaCache(request, env),
    ]

    // @ts-ignore p-any Promise types differ from CF promise types
    const res = await pAny(cdnRequests, {
      filter: (/** @type {Response} */ res) => !!res,
    })
    return res
  } catch (err) {
    // @ts-ignore FilterError bad typings
    if (err instanceof FilterError || err instanceof AggregateError) {
      return undefined
    }
    throw err
  }
}

/**
 * Get from Perma Cache route.
 *
 * @param {Request} request
 * @param {Env} env
 * @return {Promise<Response|undefined>}
 */
async function getFromPermaCache(request, env) {
  const response = await env.API.fetch(
    `${env.EDGE_GATEWAY_API_URL}/perma-cache/${encodeURIComponent(
      request.url
    )}`,
    {
      headers: request.headers,
    }
  )

  if (!response.ok) {
    return undefined
  }

  return response
}

/**
 * Get a given entry from the deny list if CID exists.
 *
 * @param {KVNamespace} datastore
 * @param {string} cid
 */
async function getFromDenyList(datastore, cid) {
  if (!datastore) {
    return undefined
  }

  const anchor = await toDenyListAnchor(cid)
  // TODO: Remove once https://github.com/nftstorage/nftstorage.link/issues/51 is fixed
  return await pRetry(
    // TODO: in theory we should check each subcomponent of the pathname also.
    // https://github.com/nftstorage/nft.storage/issues/1737
    () => datastore.get(anchor),
    { retries: 5 }
  )
}

/**
 * Put receives response to cache.
 *
 * @param {Request} request
 * @param {Response} response
 * @param {Cache} cache
 */
async function putToCache(request, response, cache) {
  const contentLengthMb = Number(response.headers.get('content-length'))

  // Cache request in Cloudflare CDN if smaller than CF_CACHE_MAX_OBJECT_SIZE
  if (contentLengthMb <= CF_CACHE_MAX_OBJECT_SIZE) {
    await cache.put(request, response.clone())
  }
}
