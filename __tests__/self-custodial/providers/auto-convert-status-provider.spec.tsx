import React from "react"
import { renderHook, act } from "@testing-library/react-native"

import {
  AutoConvertStatus,
  AutoConvertStatusProvider,
  useAutoConvertStatus,
  useAutoConvertStatusActions,
} from "@app/self-custodial/providers/auto-convert-status-provider"

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AutoConvertStatusProvider>{children}</AutoConvertStatusProvider>
)

describe("AutoConvertStatusProvider", () => {
  describe("default value", () => {
    it("returns undefined for any invoice when no status has been marked", () => {
      const { result } = renderHook(() => useAutoConvertStatus("invoice-1"), { wrapper })

      expect(result.current).toBeUndefined()
    })

    it("returns undefined when the invoice argument itself is undefined", () => {
      const { result } = renderHook(() => useAutoConvertStatus(undefined), { wrapper })

      expect(result.current).toBeUndefined()
    })
  })

  describe("markConverting / markSettled", () => {
    it("transitions an invoice to Converting and surfaces the status to readers", () => {
      const { result } = renderHook(
        () => ({
          status: useAutoConvertStatus("invoice-1"),
          actions: useAutoConvertStatusActions(),
        }),
        { wrapper },
      )

      expect(result.current.status).toBeUndefined()

      act(() => {
        result.current.actions.markConverting("invoice-1")
      })

      expect(result.current.status).toBe(AutoConvertStatus.Converting)
    })

    it("transitions an invoice from Converting to Settled", () => {
      const { result } = renderHook(
        () => ({
          status: useAutoConvertStatus("invoice-1"),
          actions: useAutoConvertStatusActions(),
        }),
        { wrapper },
      )

      act(() => result.current.actions.markConverting("invoice-1"))
      act(() => result.current.actions.markSettled("invoice-1"))

      expect(result.current.status).toBe(AutoConvertStatus.Settled)
    })
  })

  describe("multi-invoice isolation (Critical #11)", () => {
    it("keeps statuses independent across invoices when one is marked Converting", () => {
      const { result } = renderHook(
        () => ({
          a: useAutoConvertStatus("invoice-A"),
          b: useAutoConvertStatus("invoice-B"),
          actions: useAutoConvertStatusActions(),
        }),
        { wrapper },
      )

      act(() => result.current.actions.markConverting("invoice-A"))

      expect(result.current.a).toBe(AutoConvertStatus.Converting)
      expect(result.current.b).toBeUndefined()
    })

    it("supports independent transitions across two invoices in mixed states", () => {
      const { result } = renderHook(
        () => ({
          a: useAutoConvertStatus("invoice-A"),
          b: useAutoConvertStatus("invoice-B"),
          actions: useAutoConvertStatusActions(),
        }),
        { wrapper },
      )

      act(() => result.current.actions.markConverting("invoice-A"))
      act(() => result.current.actions.markSettled("invoice-B"))

      expect(result.current.a).toBe(AutoConvertStatus.Converting)
      expect(result.current.b).toBe(AutoConvertStatus.Settled)
    })

    it("settles invoice A without changing invoice B's Converting state", () => {
      const { result } = renderHook(
        () => ({
          a: useAutoConvertStatus("invoice-A"),
          b: useAutoConvertStatus("invoice-B"),
          actions: useAutoConvertStatusActions(),
        }),
        { wrapper },
      )

      act(() => result.current.actions.markConverting("invoice-A"))
      act(() => result.current.actions.markConverting("invoice-B"))
      act(() => result.current.actions.markSettled("invoice-A"))

      expect(result.current.a).toBe(AutoConvertStatus.Settled)
      expect(result.current.b).toBe(AutoConvertStatus.Converting)
    })
  })

  describe("identity preservation on no-op updates (Critical #11)", () => {
    it("does not re-render readers when an invoice is marked with the same status twice", () => {
      let renderCount = 0
      const { result } = renderHook(
        () => {
          renderCount += 1
          return {
            status: useAutoConvertStatus("invoice-1"),
            actions: useAutoConvertStatusActions(),
          }
        },
        { wrapper },
      )

      const initialRenderCount = renderCount

      act(() => result.current.actions.markConverting("invoice-1"))
      const renderCountAfterFirstMark = renderCount

      act(() => result.current.actions.markConverting("invoice-1"))
      const renderCountAfterDuplicate = renderCount

      expect(renderCountAfterFirstMark).toBeGreaterThan(initialRenderCount)
      expect(renderCountAfterDuplicate).toBe(renderCountAfterFirstMark)
    })

    it("does re-render when an invoice transitions to a different status", () => {
      let renderCount = 0
      const { result } = renderHook(
        () => {
          renderCount += 1
          return {
            status: useAutoConvertStatus("invoice-1"),
            actions: useAutoConvertStatusActions(),
          }
        },
        { wrapper },
      )

      act(() => result.current.actions.markConverting("invoice-1"))
      const renderCountAfterConverting = renderCount

      act(() => result.current.actions.markSettled("invoice-1"))

      expect(renderCount).toBeGreaterThan(renderCountAfterConverting)
    })
  })

  describe("useAutoConvertStatusActions stability", () => {
    it("returns stable markConverting and markSettled references across renders", () => {
      const { result, rerender } = renderHook(() => useAutoConvertStatusActions(), {
        wrapper,
      })

      const firstActions = result.current
      rerender({})

      expect(result.current.markConverting).toBe(firstActions.markConverting)
      expect(result.current.markSettled).toBe(firstActions.markSettled)
    })
  })

  describe("usage outside the provider (defaultContextValue)", () => {
    it("returns undefined and no-op actions when no provider is mounted", () => {
      const { result } = renderHook(() => ({
        status: useAutoConvertStatus("invoice-1"),
        actions: useAutoConvertStatusActions(),
      }))

      expect(result.current.status).toBeUndefined()

      act(() => {
        result.current.actions.markConverting("invoice-1")
        result.current.actions.markSettled("invoice-1")
      })

      expect(result.current.status).toBeUndefined()
    })
  })
})
