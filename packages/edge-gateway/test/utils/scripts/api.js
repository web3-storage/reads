/* eslint-env serviceworker, browser */

export default {
  /**
   * @param {Request} request
   */
  async fetch (request) {
    // TODO: hardcoded until miniflare supports Worker bindings
    if (
      request.url
        .toString()
        .includes('bafybeic2hr75ukgwhnasdl3sucxyfedfyp3dijq3oakzx6o24urcs4eige')
    ) {
      return new Response('Hello perma cache!', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    return new Response('Not Found', {
      status: 404
    })
  }
}
