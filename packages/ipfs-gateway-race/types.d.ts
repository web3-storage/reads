export interface IpfsGatewayRacerOptions {
  timeout?: number
}

export interface IpfsGatewayRaceGetOptions {
  pathname?: string
  headers?: Headers
  noAbortRequestsOnWinner?: boolean
  onRaceEnd?: (gatewayResponsePromises: GatewayResponsePromise[], winnerResponse: GatewayResponse | undefined) => void
}

// Gateway Race Responses

interface GatewayResponseSuccess {
  response: Response
  url: string
}

interface GatewayResponseFailure {
  response?: Response
  url: string
  reason: string
  aborted: boolean
}

export type GatewayResponse = GatewayResponseFailure | GatewayResponseSuccess

export type GatewayResponsePromise = Promise<GatewayResponse>
