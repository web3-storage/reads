/* eslint-env serviceworker, browser */
/* global Response caches */

import pAny, { AggregateError } from 'p-any'
import pDefer from 'p-defer'
import pSettle from 'p-settle'
import { FilterError } from 'p-some'

import { getCidFromSubdomainUrl } from './utils/cid.js'
import { getHeaders } from './utils/headers.js'
import { TimeoutError } from './errors.js'
import {
  CF_CACHE_MAX_OBJECT_SIZE,
  RESOLUTION_LAYERS,
  RESOLUTION_IDENTIFIERS
} from './constants.js'

/**
 * @typedef {import('./env').Env} Env
 * @typedef {'cdn' | 'dotstorage-race' | 'public-race'} ResolutionLayer
 *
 * @typedef {import('ipfs-gateway-race').GatewayResponse} GatewayResponse
 * @typedef {import('ipfs-gateway-race').GatewayResponsePromise} GatewayResponsePromise
 * @typedef {{ value: GatewayResponse & { duration: number} }} GatewayRaceResponses
 *
 * @typedef {Object} ProxiedResponse
 * @property {Response} response
 * @property {string} resolutionIdentifier
 */

/**
 * Handle gateway request.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {import('./index').Ctx} ctx
 */
export async function gatewayGet (request, env, ctx) {
  // Redirect to dweb.link if ipns request
  // TODO: integrate with w3name
  if (request.url.includes(env.IPNS_GATEWAY_HOSTNAME)) {
    return Response.redirect(
      request.url.replace(env.IPNS_GATEWAY_HOSTNAME, 'ipns.dweb.link'),
      302
    )
  }

  const reqUrl = new URL(request.url)
  const cid = await getCidFromSubdomainUrl(reqUrl)
  const pathname = reqUrl.pathname

  const cidDenylistResponse = await env.CID_VERIFIER.fetch(`${env.CID_VERIFIER_URL}/denylist?cid=${cid}`)
  if (cidDenylistResponse.status !== 204) {
    return cidDenylistResponse
  }

  // 1st layer resolution - CDN
  const cache = caches.default
  const res = await getFromCdn(request, env, cache)
  if (res) {
    return getResponseWithCustomHeaders(
      res.response,
      RESOLUTION_LAYERS.CDN,
      res.resolutionIdentifier
    )
  } else if (
    (request.headers.get('Cache-Control') || '').includes('only-if-cached')
  ) {
    throw new TimeoutError()
  }

  // 2nd layer
  const dotstorageRes = await getFromDotstorage(request, cid, { pathname })
  if (dotstorageRes) {
    return getResponseWithCustomHeaders(
      dotstorageRes.response,
      RESOLUTION_LAYERS.DOTSTORAGE_RACE,
      dotstorageRes.resolutionIdentifier
    )
  }

  // 3rd layer resolution - Public Gateways race
  const winnerUrlPromise = pDefer()
  const winnerGwResponse = await env.gwRacer.get(cid, {
    pathname,
    headers: getHeaders(request),
    noAbortRequestsOnWinner: true,
    onRaceEnd: async (gatewayResponsePromises, winnerGwResponse) => {
      winnerUrlPromise.resolve(winnerGwResponse?.url)

      ctx.waitUntil(
        reportRaceResults(env, gatewayResponsePromises, winnerGwResponse?.url)
      )
    }
  })

  const winnerUrl = await winnerUrlPromise.promise

  // Validation layer - resource CID
  const resourceCid = decodeURIComponent(winnerGwResponse.headers.get('etag') || '')
  if (winnerGwResponse && pathname !== '/' && resourceCid) {
    const cidResourceDenylistResponse = await env.CID_VERIFIER.fetch(`${env.CID_VERIFIER_URL}/denylist?cid=${resourceCid}`)
    if (cidResourceDenylistResponse.status !== 204) {
      return cidResourceDenylistResponse
    }
  }

  // Ask CID verifier to validate HTML content
  if (winnerGwResponse && winnerGwResponse.headers.get('content-type')?.includes('text/html')) {
    const verifyCid = pathname !== '/' ? resourceCid : cid
    // fire and forget. Let cid-verifier process this cid and url if it needs to
    env.CID_VERIFIER.fetch(`${env.CID_VERIFIER_URL}/?cid=${verifyCid}&url=${encodeURIComponent(request.url)}`, { method: 'POST' })
  }

  // Cache response
  if (winnerGwResponse && winnerGwResponse.ok) {
    ctx.waitUntil(putToCache(request, winnerGwResponse, cache))
  }

  return getResponseWithCustomHeaders(
    winnerGwResponse,
    RESOLUTION_LAYERS.PUBLIC_RACE,
    winnerUrl
  )
}

/**
 * CDN url resolution.
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Cache} cache
 * @return {Promise<ProxiedResponse | undefined>}
 */
async function getFromCdn (request, env, cache) {
  // Should skip cache if instructed by headers
  if ((request.headers.get('Cache-Control') || '').includes('no-cache')) {
    return undefined
  }

  try {
    const cdnRequests = [
      // Request from cache API
      getFromCacheZone(request, cache),
      // Get from API Perma Cache Binding.
      getFromPermaCache(request, env)
    ]

    // @ts-ignore p-any Promise types differ from CF promise types
    const res = await pAny(cdnRequests, {
      filter: (/** @type {ProxiedResponse} */ res) => !!res
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
 * @param {Request} request
 * @param {string} cid
 * @param {{ pathname?: string}} [options]
 * @return {Promise<ProxiedResponse | undefined>}
 */
async function getFromDotstorage (request, cid, { pathname = '' } = {}) {
  try {
    // Get onlyIfCached hosts provided
    /** @type {string[]} */
    const hosts = []
    // @ts-ignore custom entry in cf object
    if (request.cf?.onlyIfCachedGateways) {
      /** @type {URL[]} */
      const onlyIfCachedGateways = JSON.parse(
        // @ts-ignore custom entry in cf object
        request.cf?.onlyIfCachedGateways
      ).map((/** @type {string} */ gw) => new URL(gw))

      onlyIfCachedGateways.forEach((gw) => hosts.push(gw.host))
    }

    // Add only if cached header
    const headers = getHeaders(request)
    headers.set('Cache-Control', 'only-if-cached')

    const proxiedResponse = await pAny(
      hosts.map(async (host) => {
        const response = await fetch(`https://${cid}.ipfs.${host}${pathname}`, {
          headers
        })

        if (!response.ok) {
          throw new Error()
        }

        return {
          response,
          resolutionIdentifier: host
        }
      })
    )

    return proxiedResponse
  } catch (_) {}
  return undefined
}

/**
 * CDN url resolution.
 *
 * @param {Request} request
 * @param {Cache} cache
 * @return {Promise<ProxiedResponse | undefined>}
 */
async function getFromCacheZone (request, cache) {
  const response = await cache.match(request)

  if (!response) {
    return undefined
  }

  return {
    response,
    resolutionIdentifier: RESOLUTION_IDENTIFIERS.CACHE_ZONE
  }
}

/**
 * Get from Perma Cache route.
 *
 * @param {Request} request
 * @param {Env} env
 * @return {Promise<ProxiedResponse | undefined>}
 */
async function getFromPermaCache (request, env) {
  const response = await env.API.fetch(
    `${env.EDGE_GATEWAY_API_URL}/perma-cache/${encodeURIComponent(
      request.url
    )}`,
    {
      headers: request.headers
    }
  )

  if (!response.ok) {
    return undefined
  }

  return {
    response,
    resolutionIdentifier: RESOLUTION_IDENTIFIERS.PERMA_CACHE
  }
}

/**
 * Put receives response to cache.
 *
 * @param {Request} request
 * @param {Response} response
 * @param {Cache} cache
 */
async function putToCache (request, response, cache) {
  const contentLengthMb = Number(response.headers.get('content-length'))

  // Cache request in Cloudflare CDN if smaller than CF_CACHE_MAX_OBJECT_SIZE
  if (contentLengthMb <= CF_CACHE_MAX_OBJECT_SIZE) {
    await cache.put(request, response.clone())
  }
}

/**
 *
 * @param {Response} response
 * @param {ResolutionLayer} resolutionLayer
 * @param {string} resolutionIdentifier
 */
function getResponseWithCustomHeaders (
  response,
  resolutionLayer,
  resolutionIdentifier
) {
  const clonedResponse = new Response(response.body, response)

  clonedResponse.headers.set('x-dotstorage-resolution-layer', resolutionLayer)
  clonedResponse.headers.set(
    'x-dotstorage-resolution-id',
    resolutionIdentifier
  )

  return clonedResponse
}

/**
 * Async metrics for race.
 *
 * @param {Env} env
 * @param {GatewayResponsePromise[]} gatewayResponsePromises
 * @param {string | undefined} winnerUrl
 */
async function reportRaceResults (env, gatewayResponsePromises, winnerUrl) {
  if (!env.PUBLIC_RACE_WINNER) {
    env.log.warn('No bindings for PUBLIC_RACE_WINNER Analytics')
    return
  }

  // Wrap responses with promise to track request duration ttfb
  // Winner immediately resolves
  /** @type {GatewayRaceResponses[]} */
  // @ts-ignore Type 'PromiseRejectedResult' is missing values
  const gwResponses = await pSettle(
    gatewayResponsePromises.map(async (p) => {
      const gwResponse = await p

      return {
        ...gwResponse,
        duration: Date.now() - env.startTime
      }
    })
  )

  // Count winners
  if (winnerUrl) {
    env.PUBLIC_RACE_WINNER.writeDataPoint({
      blobs: [winnerUrl],
      doubles: [1]
    })
  }

  gwResponses.forEach((gwResponse) => {
    // Track TTFB for success responses
    if (
      gwResponse.value?.response?.status === 200 &&
      gwResponse.value?.duration
    ) {
      env.PUBLIC_RACE_TTFB.writeDataPoint({
        blobs: [gwResponse.value?.url],
        doubles: [gwResponse.value?.duration]
      })
    }

    // Track count for status code per gateway
    if (gwResponse.value?.response?.status && gwResponse.value?.url) {
      env.PUBLIC_RACE_STATUS_CODE.writeDataPoint({
        blobs: [gwResponse.value.url, `${gwResponse.value.response.status}`],
        doubles: [1]
      })
    }
  })
}
