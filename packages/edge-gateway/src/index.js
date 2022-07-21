/* eslint-env serviceworker */

import { Router } from 'itty-router'

import { gatewayGet } from './gateway.js'
import { versionGet } from './version.js'

import { addCorsHeaders, withCorsHeaders } from './cors.js'
import { errorHandler } from './error-handler.js'
import { envAll } from './env.js'

// https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent
/** @typedef {{ waitUntil(p: Promise<any>): void }} Ctx */

const router = Router()

router
  .all('*', envAll)
  .get('/version', withCorsHeaders(versionGet))
  .get('*', withCorsHeaders(gatewayGet))
  .head('*', withCorsHeaders(gatewayGet))

/**
 * @param {Error} error
 * @param {Request} request
 * @param {import('./env').Env} env
 */
function serverError (error, request, env) {
  return addCorsHeaders(request, errorHandler(error, env))
}

export default {
  /**
   *
   * @param {Request} request
   * @param {import("./bindings").Env} env
   * @param {Ctx} ctx
   */
  async fetch (request, env, ctx) {
    try {
      const res = await router.handle(request, env, ctx)
      return res
    } catch (/** @type {any} */ error) {
      return serverError(error, request, env)
    }
  }
}
