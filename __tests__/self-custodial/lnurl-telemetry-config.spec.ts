/* eslint-disable camelcase */
import {
  refreshTelemetryKillSwitch,
  resetTelemetryConfigForTesting,
} from "@app/self-custodial/lnurl-telemetry-config"
import { isKillSwitchEngaged, resetEnablementForTesting } from "@app/telemetry/enablement"

const SERVER = "https://staging.blink.sv"

const respond = (status: number, body?: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)

describe("refreshTelemetryKillSwitch (AD-28)", () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>()

  beforeEach(() => {
    jest.clearAllMocks()
    resetEnablementForTesting()
    resetTelemetryConfigForTesting()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it("engages the switch on a server `false`", async () => {
    fetchMock.mockReturnValue(respond(200, { telemetry_enabled: false }))

    await refreshTelemetryKillSwitch(SERVER)

    expect(fetchMock).toHaveBeenCalledWith(
      `${SERVER}/telemetry-config`,
      expect.objectContaining({ method: "GET" }),
    )
    expect(isKillSwitchEngaged()).toBe(true)
  })

  it("changes nothing on a server `true` (one-directional)", async () => {
    fetchMock.mockReturnValue(respond(200, { telemetry_enabled: true }))

    await refreshTelemetryKillSwitch(SERVER)

    expect(isKillSwitchEngaged()).toBe(false)
  })

  it("leaves the last value alone when the endpoint is not served yet", async () => {
    fetchMock.mockReturnValue(respond(404))

    await expect(refreshTelemetryKillSwitch(SERVER)).resolves.toBeUndefined()

    expect(isKillSwitchEngaged()).toBe(false)
  })

  it("leaves the last value alone when the fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"))

    await expect(refreshTelemetryKillSwitch(SERVER)).resolves.toBeUndefined()

    expect(isKillSwitchEngaged()).toBe(false)
  })

  it("ignores a body without the field", async () => {
    fetchMock.mockReturnValue(respond(200, { something_else: 1 }))

    await refreshTelemetryKillSwitch(SERVER)

    expect(isKillSwitchEngaged()).toBe(false)
  })

  it("asks at most once per interval, whichever trigger fires", async () => {
    fetchMock.mockReturnValue(respond(200, { telemetry_enabled: true }))

    await refreshTelemetryKillSwitch(SERVER)
    await refreshTelemetryKillSwitch(SERVER)
    await refreshTelemetryKillSwitch(SERVER)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("treats a 404 as an answer — not served yet is not a reason to keep asking", async () => {
    fetchMock.mockReturnValue(respond(404))

    await refreshTelemetryKillSwitch(SERVER)
    await refreshTelemetryKillSwitch(SERVER)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("asks again on the next trigger when the fetch itself failed, and engages then", async () => {
    // A device offline for the attempt must not sit out the interval: a kill switch that
    // cannot be retried promptly is the failure AD-28 exists to prevent.
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockReturnValue(respond(200, { telemetry_enabled: false }))

    await refreshTelemetryKillSwitch(SERVER)
    expect(isKillSwitchEngaged()).toBe(false)
    await refreshTelemetryKillSwitch(SERVER)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(isKillSwitchEngaged()).toBe(true)
  })

  it("makes one request when two triggers land while one is in flight", async () => {
    let answer: (response: Response) => void = () => undefined
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve
      }),
    )

    const first = refreshTelemetryKillSwitch(SERVER)
    const second = refreshTelemetryKillSwitch(SERVER)
    answer(await respond(200, { telemetry_enabled: true }))
    await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
