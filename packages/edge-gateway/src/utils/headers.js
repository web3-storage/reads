/* eslint-env serviceworker, browser */

/**
 * @param {Request} request
 */
export function getHeaders (request) {
  // keep headers
  const headers = cloneHeaders(request.headers)
  const existingProxies = headers.get('X-Forwarded-For')
    ? `, ${headers.get('X-Forwarded-For')}`
    : ''

  headers.set(
    'X-Forwarded-For',
    `${headers.get('cf-connecting-ip')}${existingProxies}`
  )
  headers.set('X-Forwarded-Host', headers.get('host') || '')

  return headers
}

/**
 * Clone headers to mutate them.
 *
 * @param {Headers} reqHeaders
 */
function cloneHeaders (reqHeaders) {
  const headers = new Headers()
  for (const kv of reqHeaders.entries()) {
    headers.append(kv[0], kv[1])
  }
  return headers
}
