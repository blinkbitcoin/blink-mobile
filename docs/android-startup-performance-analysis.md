# Android Startup Performance Analysis

**Date:** 2026-01-28  
**Issue:** Android app takes ~10 seconds to load vs ~3 seconds on iOS  
**Analysis Type:** Code Review & Architecture Assessment

---

## Executive Summary

The Android app startup performance issue stems from multiple bottlenecks in the initialization path. While some factors are platform-specific, several optimization opportunities exist that could significantly reduce the 10-second load time, potentially bringing it closer to iOS parity.

**Key Finding:** The app already has a FIXME comment in `app/app.tsx` identifying the most impactful issue - synchronous loading of all 27 language locales during startup.

---

## Identified Bottlenecks & Root Causes

### 1. 🔴 CRITICAL: Synchronous i18n Loading (Highest Impact)

**Location:** `app/app.tsx:44`

```typescript
// FIXME should we only load the currently used local?
// this would help to make the app load faster
// this will become more important when we add more languages
// and when the earn section will be added
//
// alternatively, could try loadAllLocalesAsync()
loadAllLocales()
```

**Problem:**
- Loads **27 locale files** synchronously at startup
- Each locale file is ~3,000 lines and ~95KB (collectively ~2.5MB+)
- Generated `i18n-types.ts` file is **1.2MB**
- This blocks the entire JavaScript thread during app initialization

**Impact Estimation:** **3-5 seconds** (varies by device CPU speed)

**Evidence:**
- `app/i18n/i18n-util.sync.ts` imports all locales synchronously
- `app/i18n/i18n-util.async.ts` provides lazy-loading alternative (unused)
- 27 locale directories, each with ~3K line index.ts files

**Android-Specific Impact:**
Android devices (especially mid-range) typically have slower JavaScript execution than iOS due to:
- Lower single-core CPU performance
- Hermes engine optimization differences
- JIT/AOT compilation characteristics

---

### 2. 🟡 MEDIUM: Apollo Cache Persistence Restoration

**Location:** `app/graphql/client.tsx:254-287`

**Problem:**
- Reads and deserializes entire Apollo cache from AsyncStorage on startup
- Cache can contain transaction history, query results, and GraphQL types
- AsyncStorage on Android uses SQLite, which is slower than iOS's native storage
- Happens **after** i18n loading but **before** UI renders

**Impact Estimation:** **1-2 seconds** (varies by cache size)

**Evidence:**
```typescript
const persistor = new CachePersistor({
  cache,
  storage: new AsyncStorageWrapper(AsyncStorage),
  // ...
})

// Blocking call during startup
await persistor.restore()
```

**Note in Code (line 263):**
```typescript
// TODO:
// we should only store the last 20 transactions to keep the cache small
// there could be other data to filter as well
```

---

### 3. 🟡 MEDIUM: Firebase Services Initialization

**Location:** `index.js:10`, `app/app.tsx:16-17`

**Problem:**
- 6 Firebase services initialized during startup:
  - Analytics
  - Crashlytics
  - Messaging (push notifications)
  - Remote Config
  - App Check
  - Core Firebase App
- Each service requires native module bridge calls
- Android Firebase SDK typically slower than iOS

**Impact Estimation:** **1-2 seconds**

**Evidence:**
- Multiple `@react-native-firebase/*` packages in dependencies
- Synchronous import: `import "@react-native-firebase/app"`
- Native initialization in `AppDelegate.mm` (iOS) vs automatic on Android

---

### 4. 🟢 LOW-MEDIUM: Persistent State Loading

**Location:** `app/store/persistent-state/index.tsx:48-53`

**Problem:**
- Loads app settings and preferences from AsyncStorage
- Includes state migrations
- Blocks Provider tree rendering

**Impact Estimation:** **0.5-1 second**

**Evidence:**
```typescript
React.useEffect(() => {
  ;(async () => {
    const persistentState = await loadPersistentState()
    setPersistentState(persistentState)
  })()
}, [])

return persistentState ? (
  <PersistentStateContext.Provider ...>
    {children}
  </PersistentStateContext.Provider>
) : null  // Blocks until loaded
```

---

### 5. 🟢 LOW: Large Generated Files in Bundle

**Problem:**
- `app/graphql/generated.ts`: **538KB** - GraphQL types and hooks
- `app/i18n/i18n-types.ts`: **1.2MB** - Translation types
- Total: ~1.7MB of generated TypeScript that must be parsed

**Impact Estimation:** **0.5-1 second** (initial parse time)

**Note:** These are auto-generated and harder to optimize, but tree-shaking may help.

---

### 6. 🟢 LOW: Multiple Deep Provider Nesting

**Location:** `app/app.tsx:49-78`

**Problem:**
- 10+ nested context providers
- Each requires initialization and state setup
- Some perform async operations (GaloyClient, PersistentStateProvider)

**Impact Estimation:** **0.3-0.5 seconds**

**Provider Chain:**
```
GestureHandlerRootView
  → PersistentStateProvider (async)
    → TypesafeI18n
      → GaloyClient (async)
        → GaloyThemeProvider
          → FeatureFlagContextProvider
            → ActionsProvider
              → NavigationContainerWrapper
                → [more providers]
```

---

### 7. 🔵 PLATFORM DIFFERENCE: Android-Specific Factors

**Factors Contributing to iOS vs Android Gap:**

1. **JavaScript Engine Performance**
   - Hermes on Android may be less optimized than iOS JSC/Hermes
   - Different JIT compilation strategies

2. **AsyncStorage Implementation**
   - Android: SQLite-based (slower)
   - iOS: Native file system (faster)

3. **Native Module Bridging**
   - Android requires more bridge calls for Firebase/native modules
   - iOS native code typically executes faster

4. **Device Hardware**
   - Test device may have slower CPU/storage than iPhone
   - Android fragmentation means varied performance

5. **Bundle Size & Parsing**
   - Android may decompress/parse JavaScript bundle slower
   - Old devices may have limited RAM for caching

---

## Proposed Solutions (Priority Order)

### 🥇 Priority 1: Lazy Load i18n Locales (CRITICAL)

**Estimated Improvement:** 3-5 seconds reduction

**Implementation:**
1. Replace `loadAllLocales()` with `loadLocaleAsync(detectedLocale)`
2. Use the existing `i18n-util.async.ts` infrastructure
3. Lazy-load other locales when user changes language

**Changes Required:**
```diff
// app/app.tsx
- import { loadAllLocales } from "./i18n/i18n-util.sync"
+ import { loadLocaleAsync } from "./i18n/i18n-util.async"

- loadAllLocales()
+ // Load only default locale synchronously
+ const defaultLocale = detectDefaultLocale()
+ loadLocaleAsync(defaultLocale)
```

**Additional Considerations:**
- Add locale switching logic to lazy-load on demand
- May need loading state during locale switch
- Significant bundle size reduction

**Risk:** Low - async version already exists and is tested

---

### 🥈 Priority 2: Optimize Apollo Cache Persistence

**Estimated Improvement:** 1-2 seconds reduction

**Implementation:**
1. Implement the TODO comment - limit cached transactions to last 20
2. Add aggressive cache pruning strategy
3. Consider lazy restoration (restore after UI renders)

**Changes Required:**
```diff
// app/graphql/client.tsx
const persistor = new CachePersistor({
  cache,
  storage: new AsyncStorageWrapper(AsyncStorage),
  persistenceMapper: async (data) => {
-   // TODO: filter cached data
-   return data
+   // Prune old transactions, keep only last 20
+   return pruneOldCacheData(data)
  },
})

// Consider lazy restoration:
- await persistor.restore()
+ // Restore cache after initial render
+ setTimeout(() => persistor.restore(), 0)
```

**Risk:** Medium - needs careful testing to avoid data loss

---

### 🥉 Priority 3: Defer Firebase Initialization

**Estimated Improvement:** 1-2 seconds reduction

**Implementation:**
1. Initialize only critical Firebase services (Crashlytics) at startup
2. Defer Analytics, Remote Config, Messaging to after first render
3. Use dynamic imports for Firebase modules

**Changes Required:**
```diff
// index.js
- import "@react-native-firebase/app"
+ // Defer to after app renders

// app/app.tsx
- import "@react-native-firebase/app"
- import "@react-native-firebase/crashlytics"
+ // Import dynamically after render
```

**Risk:** Medium - may affect crash reporting for very early crashes

---

### 🏅 Priority 4: Lazy Load Persistent State

**Estimated Improvement:** 0.5-1 second reduction

**Implementation:**
1. Allow Provider to render with default state
2. Load persisted state in background
3. Update UI when loaded

**Changes Required:**
```diff
// app/store/persistent-state/index.tsx
return (
  <PersistentStateContext.Provider
-   value={{ persistentState: persistentState, ... }}
+   value={{ persistentState: persistentState || defaultPersistentState, ... }}
  >
    {children}
  </PersistentStateContext.Provider>
- ) : null  // Don't block rendering
+ )
```

**Risk:** Low - default state should work for initial render

---

### 🎖️ Priority 5: Enable Inline Requires (Metro Config)

**Estimated Improvement:** 0.5-1 second reduction

**Implementation:**
Enable Metro bundler's inline requires for lazy module loading

**Changes Required:**
```diff
// metro.config.js
module.exports = {
  transformer: {
+   inlineRequires: true,
  },
}
```

**Risk:** Very Low - widely used optimization

---

## Expected Cumulative Impact

| Optimization | Time Saved | Cumulative Time | Remaining |
|--------------|------------|-----------------|-----------|
| Baseline | - | - | 10s |
| Lazy i18n loading | 3-5s | 3-5s | 5-7s |
| Cache optimization | 1-2s | 4-7s | 3-5s |
| Defer Firebase | 1-2s | 5-9s | 1-5s |
| Lazy state | 0.5-1s | 5.5-10s | 0-4.5s |
| Inline requires | 0.5-1s | 6-11s | ~3s |

**Target:** Reduce from 10s to 3-4s (close to iOS parity)

---

## Measurement & Validation Strategy

### Before Making Changes:
1. **Add Performance Markers**
   ```typescript
   performance.mark('app-start')
   performance.mark('i18n-loaded')
   performance.mark('apollo-ready')
   performance.mark('ui-interactive')
   ```

2. **Test on Multiple Devices**
   - Low-end Android (representative of slow devices)
   - Mid-range Android
   - High-end Android
   - Compare against iOS device

3. **Use React Native Performance Monitor**
   - JS thread utilization
   - Native thread utilization
   - Bundle load time

### After Each Change:
1. Measure with performance markers
2. Test on all device tiers
3. Verify no regressions in functionality
4. Check bundle size impact

---

## Alternative Approaches (Not Recommended)

### ❌ Enable New Architecture
- **Why Not:** Major migration, high risk
- **Impact:** Potentially significant, but unpredictable
- **Recommendation:** Consider for future, not quick win

### ❌ Code Splitting/Multiple Bundles
- **Why Not:** Complex setup, limited RN support
- **Impact:** Potentially helpful, but high effort
- **Recommendation:** Inline requires + lazy loading sufficient

### ❌ Remove Firebase
- **Why Not:** Critical for analytics/crashlytics
- **Impact:** Would help, but loses functionality
- **Recommendation:** Defer, don't remove

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)
- Implement lazy i18n loading
- Enable inline requires in Metro config
- Measure and validate improvements

### Phase 2: Medium Optimizations (Week 2)
- Optimize Apollo cache persistence
- Implement cache pruning
- Lazy load persistent state

### Phase 3: Advanced Optimizations (Week 3)
- Defer non-critical Firebase services
- Add comprehensive performance monitoring
- Fine-tune based on real device testing

---

## Monitoring & Alerts

### Recommended Metrics to Track:
1. **Time to Interactive (TTI)** - when app is usable
2. **JavaScript Bundle Load Time** - parse + execute
3. **Native Module Init Time** - Firebase, etc.
4. **Cache Restoration Time** - Apollo cache
5. **First Render Time** - when user sees UI

### Implementation:
- Firebase Performance Monitoring
- Custom performance marks in code
- Crash-free session rate (ensure optimizations don't break)

---

## Conclusion

The 10-second Android startup time is primarily caused by **synchronous loading of 27 language locales** (~2.5MB of translation data). The codebase already identifies this with a FIXME comment and provides the necessary async infrastructure.

**Quick Win:** Implementing just Priority 1 (lazy i18n loading) could reduce startup time by 3-5 seconds with minimal risk.

**Full Implementation:** All 5 priorities together could potentially achieve 6-10 seconds improvement, bringing Android performance close to iOS levels (3-4 seconds target).

The root cause is not a single issue but rather an accumulation of synchronous operations during the critical startup path, compounded by Android's inherently slower JavaScript execution and storage access compared to iOS.

---

## References

- Current code comments identifying issues:
  - `app/app.tsx:38-43` - i18n loading
  - `app/graphql/client.tsx:260-265` - cache pruning
- Existing infrastructure:
  - `app/i18n/i18n-util.async.ts` - async locale loading
  - Bundle visualizer: `yarn bundle-visualizer`
- React Native Performance:
  - [Metro Inline Requires](https://reactnative.dev/docs/performance#inline-requires)
  - [RAM Bundles](https://reactnative.dev/docs/ram-bundles-inline-requires)
