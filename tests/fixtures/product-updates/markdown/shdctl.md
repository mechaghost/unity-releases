# Changelog

> The shdctl command-line tool release history, including new features, fixes, and breaking changes.

This changelog records shdctl release notes from an operator's perspective: new commands, new flags, behavior changes, and breaking changes. This changelog doesn't include internal refactors.

## \[1.0.0] - 2026-10-09

### Added

* The `shdctl secret export` command rebuilds a secrets import file from the secrets already deployed in a cluster, for when the file you deployed with is gone. The result goes straight back into `shdctl secret generate --import`.

  * Anything the cluster has no usable value for is listed at the end. Supply those values by hand before you run `secret generate`, or it generates new values, and deploying them breaks whatever still uses the old ones.
  * The command needs a kubeconfig with the `list` verb on secrets in the namespace, which is more than a deployment pipeline needs. Run it as an operator rather than widening a CI role.
  * The file it writes holds your secrets in the clear (mode `0600`): keep it in your secret store, not in Git.

  For the flags and the values it exports, refer to [Recover the import file from a cluster](./commands/secret.md#recover-the-import-file-from-a-cluster).
* `configuration.overrides.<chart-name>.values` is now a documented, supported manifest field: a per-chart layer of extra Helm values, applied after every layer the release ships, for when a chart needs a setting the manifest doesn't expose. The field is unchanged since 0.13.0, and nothing in your manifest needs to move; what's new is that its behavior is specified and supported.

  * The `_arrayMerge` key mentioned in 0.10.0 is no longer accepted. `shdctl release generate` stops and points at the list-patching form that replaces it.
  * A chart name the release doesn't contain now fails generation with the release's chart names listed.
  * It stays a last resort: `shdctl manifest validate` can't catch a key you misspelled under `values:`, and a chart's value keys can move between releases. Read the generated `values.yaml` before you deploy, check your overrides again after each upgrade, and tell Unity what you had to override, so that the setting can become a manifest field of its own.

  For the merge semantics and the list-patching form, refer to [Per-chart Helm value overrides](./manifest.md#per-chart-helm-value-overrides).
* The `configuration.objectStore` manifest field selects where S3-compatible object storage comes from. `provider: garage` is the default, and what every existing manifest gets: the in-cluster store, unchanged. `provider: s3` points transformation step logs, MongoDB backups, and Unity Studio publications at an endpoint you own, and stops deploying the in-cluster store.

  * With `s3`, `endpoint`, `region`, and the three bucket names are required, and `shdctl manifest validate` names the one you left out. `buckets.postgresBackups` is optional: setting it moves the pgBackRest repository off its persistent volume, and requires an `https` endpoint.
  * `buckets.studioAssets` needs a CORS rule and an `https` endpoint, and shdctl checks neither: both fail only in the browser, while the server reports success.
  * `shdctl secret generate` prompts for the object store's access key pair instead of generating one. That pair must be able to read, write, and delete in every bucket you name. `--use-defaults` without `--import` leaves it at the `TBD` placeholder, so don't deploy that snapshot.
  * `shdctl artifact sync images` stops mirroring the in-cluster store's images with `s3`, so if you switch back, run the sync again before you deploy.

  For the endpoint grammar, the behavior of each bucket, and the warnings that shdctl emits for a partial configuration, refer to [Bringing your own object storage](./manifest.md#bringing-your-own-object-storage).
* `artifact sync images` now also mirrors the Docker images that a release manifest's artifacts run, not just the artifacts themselves. There's nothing to do beyond the sync you already run, but expect more images to be copied, and `--dry-run` to contact the source registry.
* The `shdctl artifact sync verify` command reports what a target registry holds against what your manifest requires, without writing to it. Missing images make it exit with a non-zero code, so a pipeline can gate a deployment on it. It reads release manifests from the target registry, so it works air-gapped.

  * A probe can't tell "not found" from "not authorized", so an expired credential looks exactly like an empty registry. When every required image comes back missing, `verify` says so, and points you at `shdctl artifact sync preflight`: run that first.
  * "Present but not required" covers only the images this release defines. Tags left by earlier releases aren't reported.

  For the flags, refer to [Verify the target registry](./commands/artifact.md#verify-the-target-registry).
* The `configuration.infrastructure.components.postgresql.backupStorage` manifest field sizes the volume that the pgBackRest repository sits on, independently of `storage`. If you leave it out, the sizing profile's default applies (100Gi on `small`, 800Gi on `medium`, 1600Gi on `large`). When `configuration.objectStore.buckets.postgresBackups` is set, no backup volume is provisioned at all, and `release generate` warns that this field is ignored. A persistent volume can't shrink, so a value below what a deployed cluster already has is refused, and the volume stays as it was.
* The `configuration.kubernetes.podAnnotations` manifest field holds annotations that `release generate` adds to every pod the release creates, for example `kubernetes.azure.com/no-http-proxy-vars: "true"` on AKS with an HTTP proxy. A chart's `configuration.overrides` can change or remove one for that chart. For the field, refer to the [annotated example](./manifest.md#annotated-example).

### Changed

* **The `vpctl` command is now `shdctl`.** The tool was named for "Virtual Private Cloud", which the product is no longer called: it's a Self-Hosted Deployment, so the tool is `shdctl`. Install it with `install-shdctl.sh`, which also leaves a `vpctl` symlink so that your existing scripts keep running; they print a notice that names the new command. Install the new version, and at your convenience, switch your scripts to `shdctl`, `SHDCTL_USERNAME` and `SHDCTL_PASSWORD`, and `install-shdctl.sh`. Everything in the following table keeps working throughout shdctl 1.x, and stops working in shdctl 2.0.0:

  | You have                                                    | Still works in 1.x | Replace with                                   |
  | ----------------------------------------------------------- | ------------------ | ---------------------------------------------- |
  | The `vpctl` command                                         | Yes, with a notice | `shdctl`                                       |
  | `VPCTL_USERNAME` and `VPCTL_PASSWORD`                       | Yes, with a notice | `SHDCTL_USERNAME` and `SHDCTL_PASSWORD`        |
  | Credentials in `~/.vpctl/config.json`                       | Yes, read in place | Run `shdctl configure <registry>` to move them |
  | `install-vpctl.sh` run from a checkout or a release tarball | Yes, it forwards   | `install-shdctl.sh`                            |

  Two things aren't on that schedule. The old download path (`releases/cli/vpctl_<os>_<arch>`) is still published until Unity announces otherwise, because a vendored installer fails there with an unclear registry error that upgrading can't fix. And `compatibility.yaml` keeps carrying `minVpctlVersion` alongside the new `minShdctlVersion`, so a 0.13.0 or earlier binary pointed at this release still enforces a minimum version rather than silently accepting it.
* **shdctl follows the release package's rename from "onprem" to "shd", and can still pull every previously published release.** It reads the package from `platform/shd/`, falling back to `platform/onprem/`, and `release pull` falls back to the previous release repository for a version that isn't published under the current one.
  * Generate a release earlier than SHD 2.0.0 with the vpctl version it shipped with. shdctl stops on the `_arrayMerge` key those releases use, and names it.
  * Pass `--clean-output` when you pull into an extraction directory that already holds a release. Without it, extraction stops at the first file that already exists. If a directory ends up holding both package directories, the next command that reads the release (`release generate`, `secret generate`, `secret export`, or `artifact sync`) stops with an error that names both, instead of letting the stale one shadow the fresh one.
* **Breaking:** `shdctl artifact sync images` now mirrors only the images your manifest's enabled features require, where it previously mirrored every image in the release. Images that only Istio, the Prometheus stack, log collection, or database monitoring need are skipped when those features are off, and so are the in-cluster object store's images once `configuration.objectStore.provider` is `s3`. A run that skips anything says so on stderr.
  * Turning a feature on now means running `shdctl artifact sync images` again before you deploy: on an air-gapped registry, a missing image can't be fetched at deployment time. `shdctl artifact sync verify` tells you whether a registry already holds what a manifest needs.
  * To mirror the full image set as before, pass `--all`. Use it for a registry that deployments with different feature sets share. `artifact sync preflight` and `oras` aren't affected.
* **Breaking:** `shdctl release generate` now refuses `--clean-output` together with `--name`, before it deletes anything. Run a full `shdctl release generate` instead; `--name` on its own is unchanged.
* **Breaking:** a manifest whose `configuration.kubernetes.docker.repository` is `artifactSync.sourceRepository` can no longer set `docker.namespace`: every command that reads the manifest refuses it, `shdctl manifest validate` and `cluster check` included. Remove `docker.namespace` when you pull straight from Unity's registry.
* **Breaking:** deleting the top-level `asset-solutions` application no longer tears down the deployment. It now leaves the child applications and their workloads running, and reapplying `app-of-apps-application.yaml` adopts them again. To remove a deployment, delete the top-level application first, then the child applications: while it exists, it recreates any child you delete.
* `shdctl artifact sync` now checks the release package's minimum shdctl version, like `release generate`, `secret generate`, and `secret export` already did. To bypass the check, pass `--skip-version-check`.
* The chart index that `shdctl release generate` writes is now `charts-metadata.yaml`, previously `vpctl-metadata.yaml`. `shdctl release deploy` reads either, so a tree that an earlier version generated still deploys. If your GitOps repository has the old file committed, regenerating drops it.
* Logs now go to stderr rather than stdout, so a command's own output, such as a `--dry-run` command list, the `cluster check` results, or a `verify` report, no longer risks a warning landing in the middle of it. If you redirected `shdctl ... > file` to capture log output, redirect stderr instead.
* `configuration.overrides` now honors `null` on any key, not only on keys that hold a single value: setting a key whose value is a map or a list to `null` now removes it. If a manifest of yours sets a map or a list to `null`, read the generated `values.yaml` once before your next deployment. Setting a key to `{}` or `[]` is unchanged.
* `shdctl cluster check` now requires Kubernetes 1.34 or later: a cluster on 1.33 fails the version check instead of passing it. Kubernetes 1.33 is past its upstream end of life, and past Amazon EKS standard support.
* `shdctl cluster check` now fails when the cluster has no default storage class, even if the manifest sets `configuration.kubernetes.storage.defaultStorageClass`, and warns when that class isn't the cluster default. The field applies only to Garage and the licensing server; every other `ReadWriteOnce` volume uses the cluster's default storage class. If the check fails, mark a storage class as the cluster default before you deploy. `--probe-storage` now probes the cluster default, plus the manifest's class when it's different.
* `shdctl secret generate` now also generates the image pull secret named by `configuration.kubernetes.imagePullSecret`, into the same file as the release secrets, so `shdctl secret deploy` creates it along with everything else, and you no longer need the separate `kubectl create secret docker-registry` step. It carries the container registry credentials you already supply for `acr-oras-credentials`, for the registry your manifest pulls images from (`configuration.kubernetes.docker.repository`, or `artifactSync.sourceRepository` when no mirror is configured). If anything other than shdctl creates that secret in your cluster, such as a refresher for a registry that issues short-lived credentials (ECR tokens expire after 12 hours), turn generation off in your manifest before your next `secret generate`, so that the generated snapshot doesn't overwrite the live credential when you deploy:

  ```yaml
  configuration:
    kubernetes:
      imagePullSecret:
        name: ecr-regcred
        generate: false
  ```

  Nothing is generated, and the reason is logged, when generation is off, the manifest names no pull secret, the name collides with another secret in the release, no registry resolves, or the registry credentials weren't supplied.
* `shdctl secret generate` now warns about every value in your import file that it doesn't read, naming the file and the entry: a secret name that the release's schema doesn't define, a key that the secret doesn't declare, or a key that names a field the schema derives from a default. Read the warnings before you deploy: where the schema generates a field you meant to supply, generation creates a new random value in place of yours, and nothing says so until something fails to authenticate with it. The usual cause is a value filed under the wrong secret. Generation still succeeds either way.
* `shdctl release deploy --format helm` and `shdctl release uninstall` now stop with a message that names the problem when the directory they're pointed at wasn't produced by `shdctl release generate`, or is missing a chart the release contains, instead of deploying a subset of the release and reporting success.
* `shdctl release deploy` starts each wave's largest charts first, so a wave deployed with `--concurrency` above 1 finishes sooner. The dry run lists the charts in the order they deploy.
* You can now list IPv6 CIDRs in `configuration.networking.allowedIngressCIDRs`, so a cluster whose traffic leaves over IPv6 can allow its own egress prefix in. The two families mix freely in one list, entries are still validated by position, and nothing in an existing manifest needs to move.

### Deprecated

* `configuration.kubernetes.imagePullSecret` written as a plain string (the secret name) is deprecated in favor of the block form, which keeps the name and the new `generate` switch under one key. There's nothing to do now: the string form still works, means `generate: true`, and keeps working until a release announces its removal. shdctl logs a notice that names the replacement when it reads one.
* `platform:` is deprecated and ignored. There's nothing to do now: a manifest that still carries the key validates and deploys exactly as before, the rendered charts are identical either way, and the tool logs a notice. Delete the line at your convenience. `shdctl manifest init` no longer asks for it, and a future release will reject it. The value is no longer checked, so a manifest that says something other than `onprem` also stops failing validation.

### Fixed

* `--manifest <path>` now stops with an error when the file is missing or doesn't parse. It used to warn and carry on without a manifest, so the command then failed on something unrelated (`version is required`) or, for a command that needs nothing else, ran without the manifest you named. Without `--manifest`, a `manifest.yaml` found by searching upward is still used on a best-effort basis, as before.
* `shdctl manifest validate --manifest <path>` now validates the file you name, instead of ignoring the flag and exiting with code 0 against whatever `manifest.yaml` it found by searching upward. A pipeline step that gated on this command passed regardless of the manifest: check yours again.
* `shdctl manifest schema` now prints the schema to stdout, so `shdctl manifest schema > manifest.cue` captures it instead of writing an empty file. `--export` is unchanged.
* `shdctl secret generate` now reuses the RSA key your import file carries (`asset-cloud-storage-abstraction`'s `storage-key.pem`), instead of creating a new one on every run and rotating it when you deploy. A `--persist` file written by an earlier version doesn't carry the key: the first run after you upgrade creates one and persists it. To keep the key a cluster already runs with, rebuild the file from that cluster with `shdctl secret export` before you generate: refer to [Rebuild a secrets file that vpctl persisted](../shd/maintenance/migration#rebuild-a-secrets-file-that-vpctl-persisted).
* A value supplied for a `keyType: rsa` field is now rejected at generation time, naming the field, unless it's a PKCS#1 key (`-----BEGIN RSA PRIVATE KEY-----`). The PKCS#8 form previously deployed, and then made the services that read it crash-loop, with nothing pointing at the key. To convert one, run `openssl rsa -traditional -in key.pem -out key-pkcs1.pem`. Keys that shdctl generates aren't affected.
* `shdctl secret generate --use-defaults` now names the secret in its placeholder warning (`field pixyz-license-3dds.pixyz.lic is required ...`). `pixyz-license` and `pixyz-license-3dds` both have a `pixyz.lic` field, so the two warnings used to read identically.
* `shdctl release generate --format argocd` no longer renders the top-level `asset-solutions` application as one of its own children, which could cascade-delete every application in the deployment and all their workloads on a later regeneration. Before you upgrade, check whether `<pathPrefix>/asset-solutions/templates/asset-solutions.yaml` exists in your GitOps repository. If it does, the live top-level application is tracking itself: remove the `resources-finalizer.argocd.argoproj.io` finalizer from it first, then regenerate and commit. With no finalizer, the worst case is ArgoCD deleting that one application while the child applications keep running, and reapplying `app-of-apps-application.yaml` adopts them again.
* A full `shdctl release generate --format argocd` now removes the application of a chart that's no longer in the release, or that your manifest disables, instead of leaving it in the deployment's desired state. Expect ArgoCD to delete such an application and its workloads on the next sync after you commit. If you disabled a chart in an earlier release and rely on its workloads still being there, enable it again before you regenerate.
* `shdctl release generate --name <chart>` no longer drops the other charts' registry details from the generated output, which left a later `shdctl release deploy --format helm` pointing Helm at a directory that held only values. If you ran `release generate --name` since 0.13.0, run a full `shdctl release generate` before your next deployment.
* `shdctl secret generate --clean-output` now removes only the output file; nothing else in its directory is touched.
* `shdctl secret generate --name <secret>` now writes only that secret. Every generated value must come from `--import` or `--persist`: a run that would create one from scratch is refused, naming it, and so is a name the release doesn't produce.

## \[0.13.0] - 2026-08-12

### Added

The `vpctl cluster check` command validates your manifest and then verifies that the target Kubernetes cluster meets the deployment prerequisites, before you deploy.

For more information, refer to [cluster command](./commands/cluster.md).

## \[0.12.0] - 2026-07-10

### Security

* Rebuilt with Go 1.26.5 (previously 1.26.4) to fix an Encrypted Client Hello privacy vulnerability in `crypto/tls`, reachable from vpctl through OCI registry pulls, Helm operations, and manifest parsing.
* Updated `oras.land/oras-go/v2` to version 2.6.1 to fix a registry authentication vulnerability: the client followed a `Bearer` challenge's `realm` URL without validating its scheme or host, so a malicious or intercepted registry could redirect token requests to internal endpoints or downgrade them to unencrypted HTTP. This was reachable from every authenticated registry operation, such as `release pull` and `artifact sync`.
* These updates improve the toolchain and dependencies without changing `vpctl` behavior.

### Added

* The `configuration.networking.ipFamily` manifest field (`ipv4` or `ipv6`, default `ipv4`) adds support for single-stack IPv6 clusters. When you set `ipv6`, vpctl injects `global.ipFamily: ipv6` into every chart's values and configures MongoDB to bind its pods' IPv6 addresses. Manifests that omit the field render identical output to previous versions.
* The `configuration.kubernetes.dnsService` manifest field (default `kube-dns`) overrides the in-cluster DNS service name that the log-collection gateway resolves against. Set it to your Kubernetes distribution's CoreDNS service name, for example `rke2-coredns-rke2-coredns` on RKE2, if log collection crash-loops with the error `host not found in resolver`.
* The `keyType: "base64"` secret schema field makes `vpctl secret generate` emit the standard base64 encoding of `length` random bytes, for example `length: 32` for an AES-256 key. Base64-encoded symmetric keys that previously had to be generated manually with `openssl rand -base64 32` and pasted in are now auto-generated.

### Changed

* `release generate` and `artifact sync` now merge the shared base `versions.yaml` with the platform overlay when they read the release package, instead of relying on a pre-merged file, and release packages now ship both files. Older release packages that contain a single pre-merged `versions.yaml` continue to load unchanged.

## \[0.11.0] - 2026-06-03

### Security

* Rebuilt with Go 1.26.4 (previously 1.26.3) to address two standard library CVEs that affect `vpctl`:
  * Fixed a `net/textproto` vulnerability that could include unescaped input in error messages during CUE and YAML manifest parsing.
  * Fixed a `crypto/x509` issue that could cause inefficient hostname parsing during TLS verification for Helm and OCI registry operations.
* Updated `golang.org/x/net` to version `0.55.0` to fix an `idna` Punycode validation vulnerability during manifest validation.
* These updates improve the toolchain and dependencies without changing `vpctl` behavior.

### Added

* The `configuration.imageVariant` manifest field lets you select an image variant, such as `hardened`, during chart generation. If an image doesn't support the requested variant, `vpctl release generate` now fails instead of generating incorrect image tags.
* The `configuration.infrastructure.singleNode` manifest field lets you deploy Garage, PostgreSQL (Percona), MongoDB (Percona), Elasticsearch (ECK), and RabbitMQ as single-replica deployments. Set this Boolean value to `true` to disable PodDisruptionBudgets and remove hard anti-affinity rules. Use this option only for test or evaluation clusters, not for production.
* The `release deploy --concurrency` flag lets you deploy independent charts within the same deployment wave in parallel. The default value is `1`, which preserves sequential deployment. You can set `deployment.helm.concurrency` in the manifest to change the default, and the command-line flag overrides the manifest value. If the concurrency value is greater than `1`, `vpctl` buffers each chart's Helm output and displays it after the chart finishes.
* Per-wave and end-of-deploy summary lines, for example, `Wave N complete: X total, Y succeeded, Z failed` are now emitted on every non-dry-run deploy, regardless of the concurrency setting.
* The `configuration.networking.ingress.traefik.nodePorts` manifest field lets you assign fixed Kubernetes node ports for the `web` and `websecure` Traefik entry points. Each port must be within the `30000-32767` range. Omit this field to let Kubernetes assign node ports automatically.
* The `vpctl configure set --password-stdin` option reads the registry password from standard input. This is the recommended authentication method for automation.
* The `VPCTL_USERNAME` and `VPCTL_PASSWORD` environment variables provide non-interactive credentials to `vpctl configure set`. Credential precedence is command-line flag, environment variable, then interactive prompt.
* The `minLength` secret schema field enforces a minimum secret length. `vpctl secret generate` now prompts for a longer value in interactive mode or exits with an error in non-interactive mode if the value is too short. You can't combine `minLength` with `default`, and generated secrets must use a `length` value that is at least equal to `minLength`.

### Changed

* `secret generate --persist` now requires a file path. The `--persist` shortcut no longer defaults to `secrets.import.yaml`. To preserve the previous behavior, use `--persist secrets.import.yaml`.
* `vpctl configure set` now displays a warning if you use the `--password` command-line option because the password is visible in your shell history and the process list. The option remains available for backward compatibility. Use `--password-stdin` or `VPCTL_PASSWORD` instead. If you don't provide credentials and standard input isn't connected to a terminal, the command exits with an error instead of waiting indefinitely.

### Fixed

* `vpctl artifact sync` now applies the `configuration.imageVariant` value when it mirrors Docker images, which matches the behavior of `vpctl release generate`. Previously, `artifact sync` mirrored the base image tags while chart generation referenced variant-specific tags, such as `asset-front-end:1.0.342-hardened`. This mismatch could cause `ImagePullBackOff` errors when you set `imageVariant: hardened`.
* `secret generate --persist <file>` now correctly writes secrets to the specified file. Previously, the command ignored the provided file path and always wrote to `secrets.import.yaml`, which could overwrite the existing import file.

## \[0.10.0] - 2026-05-12

### Security

* Rebuilt with Go 1.26.3 (previously 1.25.x) to pick up four standard-library CVE fixes that were reachable from vpctl: two `html/template` escaper bypasses used by CUE schema validation, a `net.Dialer` NUL-byte panic on Windows used by OCI registry pulls, and an HTTP/2 `SETTINGS_MAX_FRAME_SIZE` infinite loop used by every outbound HTTP call. The `golang.org/x/net` dependency is bumped to v0.53.0.

### Added

* New optional `configuration.networking.trustedCaSecretName` manifest field. Reference a pre-existing Kubernetes Secret (single key `ca-bundle.crt`, PEM-encoded CA chain) to make the .NET workflow containers (StorageTool) trust an internally-signed ingress certificate. Required for environments where the ingress TLS isn't chained to a publicly-trusted CA. The CA bundle is also mounted into the Pixyz Argo workflow templates (`asset-manager-glb-preview`, `asset-manager-metadata-extraction`, `asset-manager-optimize-and-convert`, `asset-manager-thumbnail-generator`) for defensive coverage of any future outbound HTTPS calls from those containers.
* `release deploy --timeout` flag (default `10m`): per-release timeout passed to `helm` when waiting.
* `release deploy --retries` flag (default `0`): number of additional attempts after a failed `helm upgrade --install` or `helm template | kubectl apply`. Helps with the "CRDs not yet visible on first attempt" race that sometimes resolves on a second attempt.
* `release deploy --retry-delay` flag (default `5s`): sleep between retry attempts.
* `keyType: hex` support in the secret schema: generates `length` hex characters (lowercase `a`–`f` / `0`–`9`) from `crypto/rand` for cryptographic secrets that require pure hex (for example, the Garage `rpc_secret`). The `length` field is required and must be even.

### Changed

* **Breaking:** `release deploy --wait` now defaults to `true` (was `false`). Each Helm release is waited on before vpctl moves to the next chart, with the new default 10-minute per-release timeout. Pass `--wait=false` to restore the previous fire-and-forget behavior.
* **Breaking:** the `rustfs:` manifest field under `configuration.infrastructure.components` is replaced by `garage:`, which exposes `resources` (standard CPU and memory requests and limits), `metaStorage`, `dataStorage`, `replicas`, and `replicationFactor` (capped at 3). The on-premises release package's `compatibility.yaml` `minVpctlVersion` is bumped to `0.10.0` in the same release, so you must upgrade vpctl to `0.10.0` before you can deploy on-premises release `0.13.0` or later.
* Remote Helm charts now resolve their source registry from `manifest.yaml` `artifactSync.sourceRepository`, the same way Docker images and ORAS artifacts already do, instead of a per-chart URL.
* The `_arrayMerge` helper in chart values now recurses through nested map levels, so paths like `_arrayMerge.backups.pgbackrest.repos.0.X` merge into `backups.pgbackrest.repos[0].X`. Top-level array behavior is unchanged.

## \[0.9.0] - 2026-04-24

### Added

* `secret generate --persist [path]` flag: saves generated values to a file (default: `secrets.import.yaml`) and auto-loads it on subsequent runs so values are reused without regeneration.
* `keyType: ca-cert` support in the secret schema: auto-generates a self-signed CA certificate (RSA 4096-bit, 10-year validity period) when no value is provided, so you don't need to manually supply a CA certificate for non-interactive generation.
* Alphanumeric-only validation for generated password fields, to prevent special characters, for example, `@`, `!`, from breaking connection strings. This applies to both auto-generated and user-provided values. Set `alphanumeric: false` in the secret schema to opt out for fields that are not used in connection strings.
* `deployment.helmChartMode` manifest setting (`"local"` or `"remote"`, defaults to `"local"`): choose between local charts from the release package or remote OCI charts. Existing manifests without this field continue using local charts.
* `vpctl artifact sync charts` subcommand to sync OCI Helm charts between registries (mirrors remote charts for air-gapped deployments).
* Remote chart support across the `release generate` and `release deploy --format helm` paths, including multi-source ArgoCD `Application` generation (OCI chart source + Git values reference).
* Image and chart references in rendered output are rewritten to your target registry during generation (air-gapped deployments).

### Fixed

* `secret generate` now re-prompts on invalid input in interactive mode instead of aborting the entire session.
* `secret generate` export now correctly base64-encodes fields with `encoding: "base64"` (e.g. licenses), so reimporting preserves the original values instead of corrupting them.
* `secret generate` interactive input for `encoding: "base64"` fields (licenses) now uses a multi-line reader, so pasted multiline base64 content works correctly.

### Changed

* `secret generate --use-defaults` now writes a `TBD` placeholder for required fields with no default and no auto-generate option, instead of stopping execution. A warning is logged for each such field so you know to replace them before deploying.
* Sync recap now lists the specific images and artifacts that failed instead of only showing a count.

## \[0.8.0] - 2026-03-17

### Added

* `oras_artifacts` support in `versions.yaml` for tracking OCI artifact versions alongside Docker images.
* `vpctl artifact sync images` subcommand for syncing Docker images between registries.
* `vpctl artifact sync oras` subcommand for syncing ORAS artifacts between registries.
* `vpctl artifact sync preflight` subcommand: verifies registry authentication by syncing one Docker image and one ORAS artifact, and provides troubleshooting hints if the command fails

### Changed

* **Breaking:** `vpctl image sync` renamed to `vpctl artifact sync images` / `vpctl artifact sync oras`. Update any CI scripts that invoke the old command.
* **Breaking:** Manifest field `imageSync` renamed to `artifactSync`. Update your `manifest.yaml`.
* **Breaking:** `--skip-login` flag removed from `artifact sync images`. Authenticate to source and target registries with `docker login` before running the sync.

## \[0.7.0] - 2026-03-13

### Added

* `vpctl manifest init` command to interactively create a new `manifest.yaml` (replaces `vpctl release init`).
* `vpctl manifest validate` command to validate an existing manifest against the embedded CUE schema.
* `vpctl manifest schema` command to display the CUE schema and export it for standalone `cue vet` validation.
* Manifest validation errors are now more precise: schema constraints, defaults, and cross-field rules are defined in CUE and embedded in the binary. `LoadManifest` now validates manifests automatically during loading.
* `authentication.x509` manifest configuration for X509 client certificate authentication.
* `logStorage` field on the RustFS infrastructure component to size the log volume PVC independently of data storage.
* `configuration.transformations.parallelism` manifest field to control the maximum number of concurrent transformation workflows in Argo Workflows (default: 20).
* `exactLength` field in the secret schema to enforce exact value length validation.

### Deprecated

* `vpctl release init` is deprecated; use `vpctl manifest init` instead.

### Removed

* **Breaking:** `configuration.licensing` manifest section (`FlexLM` and `sdkLicenses`) removed. Parallelism is now controlled by `configuration.transformations.parallelism`.

## \[0.6.0] - 2026-03-03

### Added

* Version compatibility check: `release generate` and `secret generate` now verify that vpctl satisfies the minimum version required by the release package (`compatibility.yaml`). The command blocks execution and displays a clear upgrade message when vpctl is too old. Use `--skip-version-check` to bypass. Dev builds and RC versions are handled gracefully.
* `image sync --concurrency` flag: processes multiple images in parallel using a worker pool (default: 1 = sequential).

### Fixed

* `vpctl version` no longer prints an irrelevant manifest-not-found warning.

## \[0.5.0] - 2026-02-23

### Added

* `infrastructure` manifest section with sizing profiles (`small`, `medium`, `large`) and per-component resource overrides for MongoDB, PostgreSQL, RabbitMQ, object storage, and Elasticsearch.
* `image sync --skip-existing` flag: checks if each image already exists on the target registry (via `docker manifest inspect`) and skips it, to avoid redundant pull an push cycles.
* `image sync --cleanup` flag: removes local images (`docker rmi`) after each successful push, to free disk space on CI runners and local machines.

## \[0.4.0]

### Added

* `monitoring.logCollection` manifest section to enable or disable Loki + Alloy log collection.
* `deployment.argocd` manifest section for ArgoCD deployment defaults (`repoURL`, `pathPrefix`, `destinationServer`, `targetRevision`). CLI flags take precedence over manifest values when you provide both.

### Changed

* **Breaking:** Manifest field `docker.images.sourceRepository` renamed to `imageSync.sourceRepository`.

## \[0.3.1]

### Added

* Service mesh configuration in the manifest.

### Changed

* Traefik configuration moved under the `ingress` manifest section.

## \[0.3.0]

### Added

* ArgoCD app-of-apps chart generation support (`release generate --format argocd`).
* `release init` command to initialize a new manifest file.
* `release uninstall` command to uninstall a release.
* RSA private key generation in the secret schema.
* `--name` flag on `image sync`, `release generate`, and `release deploy` to filter to a single chart or image.
* `--dry-run` flag on `release deploy` and `image sync`.
* Default storage class configuration for Kubernetes storage in the manifest.
* Network configuration in the manifest.

### Changed

* `release pull` now extracts to `./extracted-release` by default. Use `--skip-extract` to skip extraction; use `--extract-dir` to specify a custom extraction directory. Replaces the previous `--extract` flag.
* **Breaking:** `release deploy` and `image sync` now execute by default. Use `--dry-run` to preview commands. Previously they printed commands without executing.
* `image sync` is now a no-op when the target registry is unset or equals the source registry (`uccmpprivatecloud.azurecr.io`).
* Traefik configuration simplified to set up a `LoadBalancer` service with annotations.

## \[0.2.0]

No customer-facing changes. (Internal updates to the secret-template format.)

## \[0.1.0]

### Added

* Initial release of the vpctl CLI tool.
* Application management commands: download, generate, and deploy.
* Manifest file support with automatic discovery, searched upward from CWD.
* Secret management commands: generate.
* Configuration management commands: view, set, and delete.
* `version` command.
