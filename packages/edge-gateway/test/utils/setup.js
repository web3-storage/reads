import anyTest from 'ava'
export * from './miniflare.js'

/**
 * @typedef {import('miniflare').Miniflare} Miniflare
 * @typedef {import('testcontainers').StartedTestContainer} StartedTestContainer
 *
 * @typedef {Object} Context
 * @property {Miniflare} mf
 * @property {StartedTestContainer} [container]
 *
 * @typedef {import('ava').TestInterface<Context>} TestFn
 */

export const test = /** @type {TestFn} */ (anyTest)
