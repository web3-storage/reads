#!/usr/bin/env node

import sade from 'sade'

import { buildCmd } from './build.js'
import { ipfsCmd } from './ipfs.js'
import { denylistSyncCmd, denylistAddCmd } from './denylist.js'

const env = process.env.ENV || 'dev'
const prog = sade('edge-gateway')

prog
  .command('build')
  .describe('Build the worker.')
  .option('--env', 'Environment', env)
  .action(buildCmd)
  .command('ipfs')
  .describe('Run ipfs node')
  .option('--start', 'Start docker container', false)
  .option('--stop', 'Stop and clean all dockers artifacts', false)
  .action(ipfsCmd)
  .command('denylist sync')
  .describe('Sync the gateway deny list with various sources.')
  .option('--env', 'Wrangler environment to use.', env)
  .action(denylistSyncCmd)
  .command('denylist add <cid>')
  .describe(
    'Add a CID (or CID + path) to the local deny list. Note: we currently DO NOT support denying by CID + path in the API.'
  )
  .option('--status', 'HTTP status to send in response.')
  .option('--reason', 'Reason for deny. Note: may be communicated in response')
  .action(denylistAddCmd)

prog.parse(process.argv)
