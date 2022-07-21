export const CF_CACHE_MAX_OBJECT_SIZE = 512 * Math.pow(1024, 2) // 512MB to bytes

/**
 * @type {Record<string, import('./gateway').ResolutionLayer>}
 */
export const RESOLUTION_LAYERS = {
  CDN: 'cdn',
  DOTSTORAGE_RACE: 'dotstorage-race',
  PUBLIC_RACE: 'public-race',
}

export const RESOLUTION_IDENTIFIERS = {
  CACHE_ZONE: 'cache-zone',
  PERMA_CACHE: 'perma-cache',
}
