// Demo-only Metro config: the worktree's own config plus a transform cache
// shared across worktrees.
//
// Metro's transform-cache keys are worktree-portable — the per-file key uses
// the path relative to projectRoot and the global key hashes transformer file
// *contents* — so successive PRs' demo worktrees can share one cache and only
// pay transform cost for files their diffs actually change. Pass this file to
// the bundler you start for a demo session:
//
//   node node_modules/react-native/cli.js start --port "$DEMO_PORT" \
//     --config "$SKILL/scripts/metro-demo.config.js"
//
// (The flag's help text says "CLI configuration file", but the CLI forwards it
// to metro-config's resolveConfig — it is the Metro config override.)
//
// Sharing one store between concurrently running Metros is safe: entries are
// JSON keyed by content hash, a torn read is treated as a miss, and two
// writers of the same key write identical bytes. Never `--reset-cache` with
// this config, though — that clears the shared store for every agent at once.
//
// This file lives outside any node_modules, so it must not require anything
// that isn't part of Node itself; the function-form `cacheStores` below is
// what lets Metro hand us its own metro-cache module instead.
const fs = require("fs")
const os = require("os")
const path = require("path")

// The app's own config comes from the working directory, which the skill's
// workflow already fixes to the demo worktree root (step 4 starts the bundler
// with a node_modules-relative path). Fail loudly on a wrong cwd: silently
// dropping the app config would "work" and then misrender every asset.
const appConfigPath = path.join(process.cwd(), "metro.config.js")
if (!fs.existsSync(appConfigPath)) {
  throw new Error(
    `metro-demo.config.js: no metro.config.js at ${appConfigPath} - ` +
      "start Metro from the worktree root (step 4 of the skill workflow)",
  )
}
const appConfig = require(appConfigPath)

// Metro configs may also export a function or a promise; spreading either
// silently loses every app field, so support the object form only.
if (typeof appConfig !== "object" || appConfig === null || typeof appConfig.then === "function") {
  throw new Error(
    "metro-demo.config.js: the app's metro.config.js does not export a plain object - " +
      "this wrapper supports object-form configs only; start Metro without --config",
  )
}

// Escape hatch for a worktree whose node_modules is shared with (or symlinked
// to) another checkout: Metro resolves from the project root outward, so a
// worktree without its own real node_modules fails with
// `UnableToResolveError: <pkg> could not be found`. Pointing nodeModulesPaths
// and watchFolders at the real directory fixes it.
//
// Opt-in on purpose - the skill's primary advice is still a real node_modules
// copy, which is proven and avoids a second failure mode Metro has with
// symlinked module trees (`_lruCache is not a constructor`).
//
// Note the resolver spread: this file's top-level spread is shallow, so a bare
// `resolver: {...}` key would silently drop the app's own extraNodeModules,
// sourceExts and resolverMainFields (svg transform, stream/zlib shims - the
// app renders wrong rather than failing loudly).
const sharedModules = process.env.DEMO_NODE_MODULES
const resolverOverride = sharedModules
  ? {
      resolver: {
        ...appConfig.resolver,
        nodeModulesPaths: [...((appConfig.resolver || {}).nodeModulesPaths || []), sharedModules],
      },
      watchFolders: [...(appConfig.watchFolders || []), sharedModules],
    }
  : {}

module.exports = {
  ...appConfig,
  ...resolverOverride,
  transformer: {
    ...appConfig.transformer,
    // @react-native/metro-config require.resolve()s this to an ABSOLUTE path,
    // and unlike babelTransformerPath (which metro-transform-worker excludes
    // from its cache key) it is hashed into the global key - one per-worktree
    // path in here and no worktree ever hits another's entries. Metro's own
    // default is the bare specifier, resolved per-worktree at use time, so
    // pinning it restores sharing without changing behavior. Verified live:
    // this one field was the difference between 0% and full cross-worktree
    // cache reuse.
    asyncRequireModulePath: "metro-runtime/src/modules/asyncRequire",
  },
  // AutoCleanFileStore, not FileStore: nothing ever purges ~/.cache the way
  // macOS purges $TMPDIR (where Metro's default cache lives), and this store
  // sweeps stale entries by mtime while a long-lived `start` process runs.
  cacheStores: ({ AutoCleanFileStore }) => [
    new AutoCleanFileStore({
      root: process.env.DEMO_METRO_CACHE_ROOT || path.join(os.homedir(), ".cache", "metro-demo"),
    }),
  ],
}
