/* global BRANCH, VERSION, COMMITHASH, SENTRY_RELEASE */
import Toucan from 'toucan-js'

import { createGatewayRacer } from 'ipfs-gateway-race'

import pkg from '../package.json'

/**
 * @typedef {import('./bindings').Env} Env
 * @typedef {import('.').Ctx} Ctx
 */

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Ctx} ctx
 */
export function envAll (request, env, ctx) {
  env.REQUEST_TIMEOUT = env.REQUEST_TIMEOUT || 20000
  env.IPFS_GATEWAY_HOSTNAME = env.GATEWAY_HOSTNAME
  env.IPNS_GATEWAY_HOSTNAME = env.GATEWAY_HOSTNAME.replace('ipfs', 'ipns')

  // These values are replaced at build time by esbuild `define`
  env.BRANCH = BRANCH
  env.VERSION = VERSION
  env.COMMITHASH = COMMITHASH
  env.SENTRY_RELEASE = SENTRY_RELEASE

  env.sentry = getSentry(request, env, ctx)
  env.ipfsGateways = JSON.parse(env.IPFS_GATEWAYS)
  env.gwRacer = createGatewayRacer(env.ipfsGateways, {
    timeout: env.REQUEST_TIMEOUT
  })
}

/**
 * Get sentry instance if configured
 *
 * @param {Request} request
 * @param {Env} env
 * @param {Ctx} ctx
 */
function getSentry (request, env, ctx) {
  if (!env.SENTRY_DSN) {
    return
  }

  return new Toucan({
    request,
    dsn: env.SENTRY_DSN,
    context: ctx,
    allowedHeaders: ['user-agent'],
    allowedSearchParams: /(.*)/,
    debug: false,
    environment: env.ENV || 'dev',
    rewriteFrames: {
      // strip . from start of the filename ./worker.mjs as set by cloudflare, to make absolute path `/worker.mjs`
      iteratee: (frame) => ({
        ...frame,
        // @ts-ignore
        filename: frame.filename.substring(1)
      })
    },
    release: env.SENTRY_RELEASE,
    pkg
  })
}
