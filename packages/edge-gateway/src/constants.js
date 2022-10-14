export const CF_CACHE_MAX_OBJECT_SIZE = 512 * Math.pow(1024, 2) // 512MB to bytes

/**
 * @type {Record<string, import('./gateway').ResolutionLayer>}
 */
export const RESOLUTION_LAYERS = {
  CDN: 'cdn',
  DOTSTORAGE_RACE: 'dotstorage-race',
  PUBLIC_RACE_L1: 'public-race-l1',
  PUBLIC_RACE_L2: 'public-race-l2'
}

export const RESOLUTION_IDENTIFIERS = {
  CACHE_ZONE: 'cache-zone',
  PERMA_CACHE: 'perma-cache'
}

export const DEFAULT_RACE_L1_GATEWAYS = [
  'https://ipfs.io'
]

export const DEFAULT_RACE_L2_GATEWAYS = [
  'https://cf.dag.haus',
  'https://w3link.mypinata.cloud'
]
