/**
 * https://github.com/sinedied/smoke#javascript-mocks
 */
module.exports = async ({ params, headers }) => {
  const cid = params.cid

  const responseHeaders = {
    ...headers,
    'Content-Type': 'text/plain'
  }

  if (cid === 'bafkreihl44bu5rqxctfvl3ahcln7gnjgmjqi7v5wfwojqwriqnq7wo4n7u') {
    return {
      statusCode: 200,
      // headers: responseHeaders,
      body: 'Hello dot.storage! 😎'
    }
  } else if (
    cid === 'bafkreibehzafi6gdvlyue5lzxa3rfobvp452kylox6f4vwqpd4xbr53uqu'
  ) {
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: 'Hello dot.storage! 😎👻'
    }
  }

  return {
    statusCode: 500,
    headers: responseHeaders
  }
}
