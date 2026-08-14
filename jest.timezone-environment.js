import { TestEnvironment as NodeEnvironment } from "jest-environment-node"

const PINNED_TIMEZONE = "America/El_Salvador"

/**
 * Jest hands every spec a sandboxed copy of `process.env`, so a spec that assigns `TZ`
 * itself never reaches the real environment and the process keeps whatever zone the runner
 * exported, which is UTC on CI. Pinning a non-UTC zone out here, in the worker process that
 * owns the real env, is what lets a spec assert that a formatter follows the device zone
 * and still fail on a UTC runner. Opt in per file with
 * `@jest-environment ./jest.timezone-environment`, expect the pinned zone rather than the
 * runner's, and note that the zone is restored on teardown so later specs are untouched.
 */
export default class TimezoneEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context)

    this.runnerTimezone = process.env.TZ
    process.env.TZ = PINNED_TIMEZONE
    this.global.process.env.TZ = PINNED_TIMEZONE
  }

  async teardown() {
    if (this.runnerTimezone === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = this.runnerTimezone
    }

    await super.teardown()
  }
}
