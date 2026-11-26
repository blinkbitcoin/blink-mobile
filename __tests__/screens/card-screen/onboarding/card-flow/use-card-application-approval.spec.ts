import { act, renderHook } from "@testing-library/react-hooks"

import { ApplicationStatus } from "@app/graphql/generated"
import {
  APPROVAL_POLL_INTERVAL_MS,
  APPROVAL_WAIT_MS,
  useCardApplicationApproval,
} from "@app/screens/card-screen/onboarding/card-flow/use-card-application-approval"

const mockUseStatusQuery = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardApplicationStatusQuery: (options: Record<string, unknown>) =>
    mockUseStatusQuery(options),
}))

const answerWith = (applications: Array<{ id: string; status: ApplicationStatus }>) =>
  mockUseStatusQuery.mockReturnValue({
    data: {
      me: {
        id: "user-1",
        defaultAccount: {
          id: "account-1",
          cardConsumerApplications: applications.map(({ id, status }) => ({
            id,
            applicationStatus: status,
          })),
        },
      },
    },
  })

describe("useCardApplicationApproval", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockUseStatusQuery.mockReset()
    mockUseStatusQuery.mockReturnValue({ data: undefined })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("asks the server for the application's status every few seconds", () => {
    renderHook(() => useCardApplicationApproval("application-1"))

    expect(mockUseStatusQuery).toHaveBeenCalledWith({
      fetchPolicy: "network-only",
      pollInterval: APPROVAL_POLL_INTERVAL_MS,
      skip: false,
    })
  })

  it("waits while there is no answer yet", () => {
    const { result } = renderHook(() => useCardApplicationApproval("application-1"))

    expect(result.current).toBe("waiting")
  })

  it("waits while the issuer is still reviewing", () => {
    answerWith([{ id: "application-1", status: ApplicationStatus.Pending }])

    const { result } = renderHook(() => useCardApplicationApproval("application-1"))

    expect(result.current).toBe("waiting")
  })

  it("reports the approval of the application it follows", () => {
    answerWith([{ id: "application-1", status: ApplicationStatus.Approved }])

    const { result } = renderHook(() => useCardApplicationApproval("application-1"))

    expect(result.current).toBe("approved")
  })

  it("ignores another application's answer", () => {
    answerWith([
      { id: "application-0", status: ApplicationStatus.Approved },
      { id: "application-1", status: ApplicationStatus.Pending },
    ])

    const { result } = renderHook(() => useCardApplicationApproval("application-1"))

    expect(result.current).toBe("waiting")
  })

  const REFUSED = [
    ApplicationStatus.Denied,
    ApplicationStatus.Canceled,
    ApplicationStatus.Locked,
  ]
  REFUSED.forEach((status) => {
    it(`reports a ${status} application as declined at once`, () => {
      answerWith([{ id: "application-1", status }])

      const { result } = renderHook(() => useCardApplicationApproval("application-1"))

      expect(result.current).toBe("declined")
    })
  })

  it("stops waiting and asking once the minute is up", () => {
    answerWith([{ id: "application-1", status: ApplicationStatus.ManualReview }])
    const { result } = renderHook(() => useCardApplicationApproval("application-1"))

    act(() => {
      jest.advanceTimersByTime(APPROVAL_WAIT_MS - 1)
    })
    expect(result.current).toBe("waiting")

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe("timedOut")
    expect(mockUseStatusQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("leaves no timer behind when the screen goes away first", () => {
    const { unmount } = renderHook(() => useCardApplicationApproval("application-1"))

    unmount()

    expect(jest.getTimerCount()).toBe(0)
  })
})
