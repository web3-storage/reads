/* global BRANCH, VERSION, COMMITHASH, SENTRY_RELEASE */
import Toucan from 'toucan-js'

import { Logging } from '@web3-storage/worker-utils/loki'

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
  // These values are replaced at build time by esbuild `define`
  env.BRANCH = BRANCH
  env.VERSION = VERSION
  env.COMMITHASH = COMMITHASH
  env.SENTRY_RELEASE = SENTRY_RELEASE
  env.sentry = getSentry(request, env, ctx)

  env.log = new Logging(request, ctx, {
    // @ts-ignore TODO: url should be optional together with token
    url: env.LOKI_URL,
    token: env.LOKI_TOKEN,
    debug: Boolean(env.DEBUG),
    version: env.VERSION,
    commit: env.COMMITHASH,
    branch: env.BRANCH,
    worker: 'cid-verifier',
    env: env.ENV,
    sentry: env.sentry
  })
  env.log.time('request')
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
      // sourcemaps only work if stack filepath are absolute like `/worker.js`
      root: '/'
    },
    release: env.SENTRY_RELEASE,
    pkg
  })
}
