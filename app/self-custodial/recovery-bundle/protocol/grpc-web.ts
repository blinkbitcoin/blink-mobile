/**
 * Unary gRPC-web client over fetch, sufficient for the two Spark operator
 * services the exporter calls. The Spark operators serve gRPC-web on the same
 * URLs as native gRPC (the Spark SDK's browser/WASM builds use it), and unary
 * calls need no response streaming, so plain fetch + arrayBuffer works in
 * React Native.
 */

const GRPC_WEB_CONTENT_TYPE = "application/grpc-web+proto"
const TRAILER_FLAG = 0x80
const CALL_TIMEOUT_MS = 30_000

export class GrpcWebError extends Error {
  constructor(
    readonly grpcStatus: number | undefined,
    readonly httpStatus: number | undefined,
    message: string,
  ) {
    super(message)
    this.name = "GrpcWebError"
  }
}

const frameRequest = (message: Uint8Array): Uint8Array => {
  const framed = new Uint8Array(5 + message.length)
  framed[0] = 0
  new DataView(framed.buffer).setUint32(1, message.length, false)
  framed.set(message, 5)
  return framed
}

type Frame = { flag: number; payload: Uint8Array }

const parseFrames = (body: Uint8Array): Frame[] => {
  const frames: Frame[] = []
  let offset = 0
  while (offset + 5 <= body.length) {
    const flag = body[offset]
    const length = new DataView(body.buffer, body.byteOffset + offset + 1, 4).getUint32(
      0,
      false,
    )
    offset += 5
    if (offset + length > body.length) {
      throw new GrpcWebError(undefined, undefined, "grpc-web: truncated response frame")
    }
    frames.push({ flag, payload: body.subarray(offset, offset + length) })
    offset += length
  }
  return frames
}

const parseTrailers = (payload: Uint8Array): Map<string, string> => {
  const trailers = new Map<string, string>()
  for (const line of Buffer.from(payload).toString("utf8").split("\r\n")) {
    const separator = line.indexOf(":")
    if (separator !== -1) {
      trailers.set(
        line.slice(0, separator).trim().toLowerCase(),
        line.slice(separator + 1).trim(),
      )
    }
  }
  return trailers
}

type UnaryCallParams = {
  baseUrl: string
  /** Full method path, e.g. "/spark.SparkService/query_nodes". */
  methodPath: string
  request: Uint8Array
  /** Value for the `authorization` header, if the method requires a session. */
  authorization?: string
}

export const grpcWebUnaryCall = async ({
  baseUrl,
  methodPath,
  request,
  authorization,
}: UnaryCallParams): Promise<Uint8Array> => {
  const headers: Record<string, string> = {
    "Content-Type": GRPC_WEB_CONTENT_TYPE,
    "Accept": GRPC_WEB_CONTENT_TYPE,
    "X-Grpc-Web": "1",
    "X-User-Agent": "blink-mobile-recovery-bundle",
  }
  if (authorization) headers.Authorization = authorization

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)

  let response: Response
  let body: Uint8Array
  try {
    response = await fetch(`${baseUrl}${methodPath}`, {
      method: "POST",
      headers,
      body: frameRequest(request),
      signal: controller.signal,
    })
    body = new Uint8Array(await response.arrayBuffer())
  } catch (err) {
    throw new GrpcWebError(
      undefined,
      undefined,
      `grpc-web: ${methodPath} network error: ${err instanceof Error ? err.message : String(err)}`,
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new GrpcWebError(
      undefined,
      response.status,
      `grpc-web: ${methodPath} failed with HTTP ${response.status}`,
    )
  }

  // Trailers-only responses carry grpc-status in the HTTP headers
  const headerStatus = response.headers.get("grpc-status")
  if (headerStatus !== null && headerStatus !== "0") {
    throw new GrpcWebError(
      Number(headerStatus),
      response.status,
      `grpc-web: ${methodPath} failed with status ${headerStatus}: ${
        response.headers.get("grpc-message") ?? ""
      }`,
    )
  }

  let message: Uint8Array | undefined
  for (const frame of parseFrames(body)) {
    // eslint-disable-next-line no-bitwise -- gRPC-web trailer flag is the high bit
    if (frame.flag & TRAILER_FLAG) {
      const trailers = parseTrailers(frame.payload)
      const status = trailers.get("grpc-status")
      if (status !== undefined && status !== "0") {
        throw new GrpcWebError(
          Number(status),
          response.status,
          `grpc-web: ${methodPath} failed with status ${status}: ${
            trailers.get("grpc-message") ?? ""
          }`,
        )
      }
    } else if (message === undefined) {
      message = frame.payload
    }
  }

  if (message === undefined) {
    throw new GrpcWebError(
      undefined,
      response.status,
      `grpc-web: ${methodPath} returned no message frame`,
    )
  }
  return message
}
