package com.galoyapp

import java.util.concurrent.atomic.AtomicBoolean

class SafeTouchDispatch {
  private val reported = AtomicBoolean(false)

  /**
   * Guards against a long-standing AOSP bug: ScrollView.onTouchEvent throws
   * IllegalArgumentException from MotionEvent.getY ("invalid pointerIndex -1",
   * or "pointerIndex out of range" on some releases) when a multitouch
   * POINTER_UP arrives for a gesture it didn't fully observe (e.g. after
   * react-native-gesture-handler intercepted part of the stream).
   * By then the gesture is already inconsistent, so dropping the event is safe.
   *
   * Only IllegalArgumentExceptions whose message names a pointerIndex are
   * swallowed — any other exception is a real bug and propagates. The
   * framework bug is reported at most once per process: every occurrence has
   * the identical stack, so repeats add no signal and would flood Crashlytics.
   */
  fun dispatch(
    onFrameworkBug: (IllegalArgumentException) -> Unit,
    superDispatch: () -> Boolean,
  ): Boolean =
    try {
      superDispatch()
    } catch (e: IllegalArgumentException) {
      if (e.message?.contains("pointerIndex") != true) throw e
      if (reported.compareAndSet(false, true)) onFrameworkBug(e)
      false
    }
}
