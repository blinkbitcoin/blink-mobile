# Self-Custodial Build Configuration

Self-custodial Spark builds require these environment variables at bundle time:

- `SPARK_TOKEN_IDENTIFIER`: token identifier used for the Spark stable balance.
- `BREEZ_API_KEY`: Breez SDK API key.
- `BREEZ_NETWORK`: Breez SDK network; currently `mainnet` or `regtest`.

CI writes these values into `.env.ci` before the React Native bundle is built.
Release and prerelease artifacts must be rebuilt after these values are added or
changed in Concourse, otherwise the shipped app will use the previous bundled
configuration.

`SPARK_TOKEN_IDENTIFIER` is required for self-custodial runtime initialization.
If it is missing from the build, `requireSparkTokenIdentifier` throws a
configuration error instead of allowing Spark token flows to continue with an
empty identifier.
