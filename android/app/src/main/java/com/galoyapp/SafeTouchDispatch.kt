package com.galoyapp

object SafeTouchDispatch {
  /**
   * Guards against a long-standing AOSP bug: ScrollView.onTouchEvent throws
   * IllegalArgumentException ("invalid pointerIndex -1") when a multitouch
   * POINTER_UP arrives for a gesture it didn't fully observe (e.g. after
   * react-native-gesture-handler intercepted part of the stream).
   * By then the gesture is already inconsistent, so dropping the event is safe.
   */
  fun dispatch(
    onFrameworkBug: (IllegalArgumentException) -> Unit,
    superDispatch: () -> Boolean,
  ): Boolean =
    try {
      superDispatch()
    } catch (e: IllegalArgumentException) {
      onFrameworkBug(e)
      false
    }
}
