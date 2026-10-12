# Release notes for Self-Hosted Deployment

> Learn about new features, improvements, and changes in each release of Self-Hosted Deployment

## Version 2.0.0 — October 9, 2026

This release requires shdctl 1.0.0 or later: [install it before you pull the release](./maintenance/migration.md#install-shdctl-1.0.0-before-you-pull). Before you upgrade, read the [migration guide](./maintenance/migration.md): it lists the manual steps this release needs, and which deployments each applies to.

Platform service and Keycloak pods restart once during the upgrade.

### Breaking changes

#### Check ArgoCD deployments before you upgrade

If you deploy with ArgoCD, check your GitOps repository before you upgrade, or ArgoCD can delete every application and its workloads. For the check and the command, refer to [ArgoCD deployments: remove the finalizer of a self-tracking application](./maintenance/migration.md#argocd-deployments:-remove-the-finalizer-of-a-self-tracking-application).

#### Manifest settings that shdctl 1.0.0 refuses

shdctl 1.0.0 refuses two settings that a manifest written for an earlier release can hold: `_arrayMerge` under `configuration.overrides`, and `configuration.kubernetes.docker.namespace` when you pull from Unity's registry directly. If your manifest holds either, change it before you upgrade: refer to [Remove settings that shdctl 1.0.0 refuses from your manifest](./maintenance/migration.md#remove-settings-that-shdctl-1.0.0-refuses-from-your-manifest).

#### Release package renamed from onprem to shd

The release package files are renamed from "onprem" to "shd". `shdctl release pull` needs no change and keeps working for every version, new or old.

If you mirror the release artifact yourself, or script around the package, refer to [Update your own mirror and scripts for the shd package name](./maintenance/migration.md#update-your-own-mirror-and-scripts-for-the-shd-package-name).

#### Kubernetes 1.34 or later required

Kubernetes 1.33 is past its upstream end of life. `shdctl cluster check` now reports a failure on 1.33. Upgrade your cluster before you deploy this release.

#### Air-gapped mirrors copy only the images your deployment needs

`shdctl artifact sync images` now copies only the images your deployment needs. With Istio, Prometheus, log collection, or database monitoring turned off, or with `configuration.objectStore.provider: s3`, which stops deploying the in-cluster object store, it no longer copies those images into your registry. It tells you what it left out whenever it skips anything.

* If you turn one of those features on, run `shdctl artifact sync images` again before you deploy. The images it needs were never mirrored, and an air-gapped cluster can't fetch them at deployment time.
* To check a registry against your manifest at any time, run the new `shdctl artifact sync verify`. It lists the missing images and exits with a non-zero code, so a deployment pipeline can stop on it. Run `shdctl artifact sync preflight` first: it confirms your registry credentials, and a verify run that can't read the registry reports every image as missing.
* To mirror the full image set as before, run `shdctl artifact sync images --all`. Use it for a registry that deployments with different features enabled share.

#### Renamed ingress resources

Several `IngressRoute` resources that the release installs are renamed, and so are most of the per-route `Middleware` resources alongside them. The shared middlewares that every route chains, `cors`, `forward-auth`, `strip-backend-prefix`, `remove-authorization-header`, and `security-headers`, keep their names.

No action is needed beyond the usual redeployment, unless something outside the release refers to one of these resources by name: refer to [Update references to renamed ingress resources](./maintenance/migration.md#update-references-to-renamed-ingress-resources).

#### Optimize and Convert pipeline inputs

The Optimize and Convert pipeline now always creates a new asset: its option to add the output to an existing asset (the `CreateNewAsset` input) is removed. `Output Formats` and `Asset Version` are now required, and the output formats no longer default to `glb` and `pxz`, so anything that calls the pipeline must change: refer to [Update callers of the Optimize and Convert pipeline](./maintenance/migration.md#update-callers-of-the-optimize-and-convert-pipeline).

### New features

#### Bring your own object storage

Object storage can now be a bucket that you own instead of the in-cluster store. Set `configuration.objectStore.provider: s3` in your manifest, and transformation step logs, MongoDB backups, and Unity Studio publications are written to your own S3-compatible endpoint. The in-cluster store is then no longer deployed.

```yaml
configuration:
  objectStore:
    provider: s3
    endpoint: https://s3.us-east-2.amazonaws.com   # scheme://host[:port], no path
    region: us-east-2
    forcePathStyle: false                          # MinIO, Ceph RGW, StorageGRID: read the caveat below
    buckets:
      transformationLogs: my-transformation-logs   # per-step transformation logs
      mongodbBackups: my-mongodb-backups           # MongoDB nightly dumps
      studioAssets: my-studio-assets               # Unity Studio publications
      postgresBackups: my-postgres-backups         # optional: PostgreSQL backups and WAL
```

If you omit `objectStore`, or leave `provider: garage`, the behavior stays exactly as before, so no existing manifest needs to change.

* **Before you deploy, create every bucket you name, and one access key pair that can read, write, and delete objects in all of them.** Backup retention and pgBackRest both delete what they expire. On this provider, `shdctl secret generate` prompts for that key pair instead of generating one. A key scoped to only some of the buckets generates cleanly, and then fails much later, at backup or transformation time.
* **`buckets.studioAssets` needs a CORS rule and an `https` endpoint.** Allow the origin `https://<your appDomain>`, the methods `GET`, `PUT`, and `HEAD`, and all request headers (`*`), and expose `ETag`. shdctl checks neither, and both fail only in the browser while the server reports success, so publish an asset and check it rather than trusting a green deployment. If your store is reachable only over `http`, Studio publishing doesn't work in this release.
* **`buckets.postgresBackups` is optional.** Naming it moves PostgreSQL's backups off their persistent volume, and stops provisioning that volume. It requires an `https` endpoint: `shdctl release generate` refuses the combination rather than leaving the bucket unused. If you leave it out, PostgreSQL keeps backing up to its volume, whatever the other buckets are.
* **On MinIO, Ceph RGW, or StorageGRID, confirm that a transformation's step logs are readable after you switch.** `forcePathStyle: true` doesn't yet reach the step-log clients, so working MongoDB backups aren't evidence that step logs work. If they don't, contact Unity. This doesn't apply to AWS S3.
* **Switching an existing deployment doesn't move PostgreSQL's backup history.** A fresh backup chain starts in the bucket. Take a manual backup first if you need the old chain, and keep the backup volume until you're satisfied with the new one.
* **An endpoint that presents a privately issued certificate isn't supported in this release.** It must present a publicly trusted certificate, or be reached over `http`, which neither `postgresBackups` nor `studioAssets` supports.

For the endpoint grammar, the warnings that shdctl emits for a partial configuration, and the behavior of each bucket, refer to [Bringing your own object storage](../shdctl/manifest#bringing-your-own-object-storage).

To switch an existing deployment without losing its MongoDB backups or Studio publications, refer to [Switching an existing deployment to your own buckets](../shdctl/manifest#switching-an-existing-deployment-to-your-own-buckets).

#### Unity Studio

Unity Studio is now deployed, as two new services: `studio-file-server` and `studio-publisher-service`. On the in-cluster object store, the deployment creates a `studio-assets` bucket for you, so there's no storage to set up. With `configuration.objectStore.provider: s3`, you must also name `buckets.studioAssets`, extend your access key to it, configure CORS on it, and reach your store over `https`, as described in [Bring your own object storage](#bring-your-own-object-storage). Studio publications are user data, and no backup that this release configures covers them.

**Action required:** before you deploy, allow your cluster's own outbound addresses through your ingress allowlist, or Studio fails while everything else stays healthy. Refer to [Ingress](./installation/infrastructure.md#ingress).

Studio trusts a privately issued ingress certificate: if your ingress presents a certificate from a private CA, the `configuration.networking.trustedCaSecretName` you already set covers Studio too. With `configuration.authentication.x509.enabled: true`, however, Studio publishing doesn't work in this release. That setting turns on mutual TLS (mTLS), which requires every client that reaches your deployment to present a certificate of its own, and the Studio publisher has none to present. Nothing in the manifest exempts it, so leave x509 client authentication off if you need Studio publishing.

#### Optional ingress routes for the ArgoCD, Argo Workflows, and PMM user interfaces

You can now expose the ArgoCD, Argo Workflows, and PMM user interfaces at `argocd.<appDomain>`, `argoworkflows.<appDomain>`, and `pmm.<appDomain>`. All three routes are disabled by default: leave them disabled unless you put authentication in front of them. The Argo Workflows server runs unauthenticated, and its permissions allow submitting workflows and reading namespace secrets, so exposing it grants those capabilities to anyone who can reach your load balancer. Omitting the DNS record doesn't protect the route, because the client supplies the hostname.

To enable the routes, first restrict access to trusted sources. `configuration.networking.allowedIngressCIDRs` does that only with the `LoadBalancer` service type; with `NodePort` or `ClusterIP`, restrict access on your own load balancer or firewall. Then set:

```yaml
configuration:
  overrides:
    traefik:
      values:
        ingressRoutes:
          argocd:
            enabled: true
            # only if your ArgoCD release isn't named `argocd`
            serviceName: <your-release>-argocd-server
          argoWorkflows:
            enabled: true
          pmm:
            enabled: true
```

You must also create DNS records for the hostnames you enable, pointing at your load balancer.

#### Image pull secret generated for you

`shdctl secret generate` now renders the secret named by `configuration.kubernetes.imagePullSecret` from the container registry credentials you already supply, and `shdctl secret deploy` applies it with the rest. You no longer need the separate `kubectl create secret docker-registry` step.

**Action required if something else in your cluster creates that secret:** refer to [Keep an image pull secret that something else creates](./maintenance/migration.md#keep-an-image-pull-secret-that-something-else-creates).

The block form, with `name` and `generate`, is the new form of `imagePullSecret`. A plain secret name still works and needs no change now: it means `generate: true`, and shdctl logs a notice that points at the block form until a future release retires the string.

#### Database monitoring tokens created automatically

When database monitoring is enabled (`configuration.monitoring.database.enabled: true`), the PMM server tokens that let the MongoDB and PostgreSQL clusters report to PMM are now created automatically during deployment. `shdctl secret generate` no longer asks you for either token, and you no longer need to create them in the PMM user interface. Each database gets its own PMM service account, so revoking one database's access in PMM leaves the other reporting.

During the upgrade to this release, an existing token that you supplied is replaced by a newly created one, and MongoDB and PostgreSQL each restart once to pick up theirs. After that, running `shdctl secret generate` again and reapplying secrets no longer disturbs either token, because neither is part of the generated secrets anymore.

If a token ever needs replacing, for example because it was revoked in PMM, set `FORCE_ROTATE` to `"true"` for the `pmm-integration-job` chart through the manifest's per-chart override, and redeploy. `FORCE_ROTATE` covers every monitored database, so both MongoDB and PostgreSQL get new tokens and restart once. Remove the override after that deployment: left in place, the next upgrade issues new tokens and restarts both databases again.

```yaml
configuration:
  overrides:
    pmm-integration-job:
      values:
        env:
          FORCE_ROTATE: "true"
```

If PMM doesn't become reachable, the `pmm-integration-job` job fails without affecting the databases or the rest of the release, but it doesn't retry on its own. Once PMM is healthy, delete the failed job before you redeploy (`kubectl delete job -n <namespace> -l app=pmm-integration-job`); otherwise, the redeployment doesn't recreate it. A database whose token couldn't be created is left unmonitored, and the others are still integrated.

Once PostgreSQL reports to PMM, PMM lists a second service next to the database instance, named `<instance>-patroni-external`, and shows its status as `Unspecified` or `Failed` even though it works. The metrics it collects are present and queryable; no action is needed.

#### Size the PostgreSQL backup volume

The new `configuration.infrastructure.components.postgresql.backupStorage` manifest field sizes the volume that PostgreSQL's backups sit on, separately from `storage`, which sizes the database's own data. If you leave it out, the sizing profile decides it as before: 100Gi on `small`, 800Gi on `medium`, and 1600Gi on `large`. It has no effect when `configuration.objectStore.buckets.postgresBackups` sends those backups to a bucket instead.

Raising the value resizes the volume in place, which needs `allowVolumeExpansion: true` on the StorageClass. Lowering it doesn't: a persistent volume can't shrink, so a smaller value is refused and the volume stays as it is. To reclaim space, delete the backup volume and let the operator recreate it, which discards the backup history.

#### GPU transformations run without GPU nodes

A new `automation-manager` value, `env.vpcGpuAvailable`, defaults to `false`. Set it to `true` only on clusters with GPU nodes. When it's `false`, GPU transformation actions are rewritten to run on the `argocpu` pool with a software rasterizer, instead of staying `Pending` until the workflow times out. The 3D Data Streaming image ships the Mesa lavapipe driver they render with.

#### Pod annotations, and clusters behind an HTTP proxy

The new `configuration.kubernetes.podAnnotations` manifest field adds annotations to every platform pod. A chart's `configuration.overrides` can change or remove one, with `null`, for that chart alone.

On AKS with an HTTP proxy (`httpProxyConfig`), set `kubernetes.azure.com/no-http-proxy-vars: "true"`, so that no platform pod receives the proxy variables that AKS injects, and services keep reaching each other inside the cluster. Nodes still pull images through the proxy, but the pods get no internet access. The automation-manager job still needs the proxy, to pull the release manifest from your registry: pass it through that chart's overrides, unless your cluster reaches the registry without the proxy.

```yaml
configuration:
  kubernetes:
    podAnnotations:
      kubernetes.azure.com/no-http-proxy-vars: "true"
  overrides:
    automation-manager:
      values:
        env:
          httpsProxy: http://<proxy>:<port>
          noProxy: .svc,.cluster.local,localhost,127.0.0.1
```

For what the proxy must allow, refer to [Clusters behind an HTTP proxy](./installation/prerequisites.md#clusters-behind-an-http-proxy).

### Improvements

#### Requiring action

* **vpctl is renamed shdctl.** The command-line tool is now `shdctl`, and its installer is `install-shdctl.sh`. The installer leaves a `vpctl` symlink, so your existing scripts keep running throughout shdctl 1.x, and print a notice each time. Update your scripts to `shdctl`, and to the `SHDCTL_USERNAME` and `SHDCTL_PASSWORD` environment variables, before shdctl 2.0.0, which drops the old names. Credentials already stored in `~/.vpctl/config.json` are still read; to move them, run `shdctl configure <registry>`.
* **Secrets files that vpctl persisted don't hold the storage key.** If you keep your secret values in a file that vpctl wrote with `--persist`, rebuild it from the cluster before you generate the secrets, or deploying rotates the key the cluster runs with: refer to [Rebuild a secrets file that vpctl persisted](./maintenance/migration.md#rebuild-a-secrets-file-that-vpctl-persisted).
* **Pipeline automation upgraded to v0.0.77.** Snapshot the automation database before you upgrade, and set `DISPLAY` in your own action images if they relied on the platform for it: refer to [Automation 0.0.77: snapshot its database first](./maintenance/migration.md#automation-0.0.77:-snapshot-its-database-first) and [Set DISPLAY in your own action images](./maintenance/migration.md#set-display-in-your-own-action-images).
* **Monitoring stack installed like every other component.** `helm history`, `helm rollback`, and `helm uninstall` now work for it, and its setup jobs run in the correct order on every upgrade. A deployment without ArgoCD now waits for the monitoring stack before it installs the rest of the release, and allows 10 minutes for each component; `shdctl release deploy --timeout` raises that. If you deploy without ArgoCD and already run the monitoring stack, hand it over to Helm once during the upgrade: refer to [Helm deployments: hand the monitoring stack over to Helm](./maintenance/migration.md#helm-deployments:-hand-the-monitoring-stack-over-to-helm). Deployments that use ArgoCD need no action.
* **Failed thumbnail renders retry on a larger node.** A failed thumbnail render now retries on the `argocpu-large` pool, requesting 8 CPUs and 48 GB of memory. Make sure that pool can provide a node with that much allocatable capacity, or the retry stays `Pending` until the workflow times out.
* **Shared workflow volume for 3D Data Streaming.** The `automation` service now provisions a shared workflow persistent volume claim (`sync-share-3dds`, `ReadWriteMany`) on the storage class named by `configuration.kubernetes.storage.readWriteManyStorageClass`. No action is required if that class already provisions volumes dynamically.

#### No action required

* **Observability stack upgraded.** Loki 3.7, Grafana 13.1, Prometheus 3.13, and Alloy v1.18. Each restarts once, so log queries, dashboards, and metric queries are briefly unavailable. Stored logs, stored metrics, and saved dashboards are preserved.
* **The `platform` manifest field is ignored.** You can delete the `platform:` line from your `manifest.yaml`: the generated charts are identical with or without it. Removing it is optional in this release; a future release will reject the field.
* **Baseline examples are reference code only.** The AWS and Azure baseline examples (`aws-baseline-example/` and `azure-baseline-example/`) are reference code. Their changes are no longer listed in these release notes, and they may break a stack built from an earlier copy, so review the differences before you reapply one.

### Fixed issues

#### Requiring action

* **Node drains and cluster upgrades no longer stall on PodDisruptionBudgets.** Every service, Keycloak included, now allows one pod at a time to be evicted. Services that run a single replica (`minReplicas: 1`) can now be briefly interrupted while their pod moves to another node: set `minReplicas: 2` for any service that must stay up through node maintenance.

#### No action required

* **Transformations no longer stall on a tainted `argocpu` pool.** The four transformation steps that retry on a larger node, Pixyz file import, spatializer, scene analyzer, and Pixyz publisher, no longer stay `Pending` if you taint your `argocpu` pool with `argo-workflows=cpu:NoSchedule`. Pools tainted only with `aks-node-pool`, as the bundled baseline examples are, were never affected.
* **Upgrades no longer stop at the notification setup.** You no longer need to delete the completed `novu-manager` job by hand on every upgrade, and new and changed notification templates now reach Novu.
* **Built-in workflow templates upload once per release.** They're no longer uploaded again every few minutes. If the workflow engine doesn't answer yet when the upload runs, the upload retries for about 2.5 hours before the job is reported as failed; deleting that job runs the upload again.
* **Transformations start during node maintenance.** Starting a transformation no longer fails with `Unexpected error calling Workflow Engine` while nodes are drained: the workflow engine now keeps at least one instance serving.
* **Fewer restarts under load.** Platform services are no longer restarted for briefly failing a health check under heavy load.
* **Keycloak recovers on its own.** A Keycloak pod that loses its place in the cluster now restarts itself after 13 minutes of continuous unreadiness, instead of staying `Running` but never `Ready` until someone deletes it. If Keycloak still ends up short a replica, delete both pods together (`kubectl delete pod keycloak-0 keycloak-1 -n <namespace>`) and let them come back in order. `kubectl rollout restart` does nothing while a pod is unready, and deleting only the pod that still looks healthy leaves you with no working Keycloak.
* **Notifications work on single-stack IPv6 clusters.** This includes the Dashboard's notification feed and preferences, and notifications for comments and annotations.
* **Rollouts no longer fail requests.** Rolling out or scaling down a platform service no longer fails requests, except on single-stack IPv6: a stopping pod keeps serving for 10 seconds while traffic moves to other replicas, so rollouts and node drains take slightly longer.
* **The shdctl installer creates its directory.** `install-shdctl.sh` now creates a missing installation directory with `sudo` when you can't create it yourself, for example `/opt/bin` as a non-root user.

## Version 0.16.0 — August 12, 2026

Upgrade vpctl to 0.13.0 or newer before you pull and deploy this release.

### New features

#### Validate your cluster before you deploy

vpctl 0.13.0 adds the `cluster check` command, which verifies that the cluster your current kubeconfig context points at meets the deployment prerequisites:

```sh
vpctl cluster check
```

Run it before you pull the release, after any cluster change, and before every upgrade. For the full list of checks and options, refer to [cluster command](/self-hosted-deployment/shdctl/commands/cluster.md).

#### Built-in Optimize and Convert 3D Asset pipeline

Deployment now installs, certifies, and publishes an **Optimize and Convert 3D Asset** transformation pipeline to the Asset Manager for all organizations without manual setup.

The pipeline's steps run the Unity Asset Manager and Unity Asset Transformer (Pixyz) app versions that your deployment already installs, so the pipeline always matches the apps present on the cluster.

The post-deployment `automation-manager` job reconciles the pipeline on every upgrade and fills in only what's missing, so a pipeline version that's already installed is left untouched.

If the installation fails, the job reports it in its log without blocking the rest of the deployment.

If you don't want to install the pipeline, set the `automation-manager` value `env.pipelinesList` to an empty string.

#### Asset collaboration service uses PostgreSQL

The asset collaboration service now connects to PostgreSQL, in the `collaboration` database.

**Action required:** this adds a new secret field. Regenerate your secrets and redeploy so that the service picks up its PostgreSQL connection string:

```sh
vpctl secret generate --import secrets.import.yaml --use-defaults
vpctl secret deploy
```

#### Repair script for Unity Version Control data volumes

The release package now includes a repair script for Unity Version Control (UVCS) data volumes at `common/scripts/fix-uvcs-jet-ownership.sh`.

A volume that an older UVCS version created holds files owned by `root`. Now that the server runs as a non-root user, every write to those files logs `Unable to update timestamp of file '/jet/...': Access to the path ... is denied`. UVCS keeps serving requests, but the errors fill its logs.

From the extracted release, run the read-only check to find out whether your deployment is affected:

```sh
./common/scripts/fix-uvcs-jet-ownership.sh check
```

If it is, correct the ownership:

```sh
./common/scripts/fix-uvcs-jet-ownership.sh repair
```

The repair runs a short-lived job and briefly restarts UVCS. Deployments whose volume was created by a recent release aren't affected and need no action.

### Improvements

#### Requiring action

* **Built-in automation apps updated.** Unity Asset Transformer (Pixyz) and Unity Asset Manager are both updated to 1.2.1. The updated versions are registered alongside the existing ones at deployment time. Automations you already created stay on the app version they were created with and keep working, because the images those versions need remain in the registry mirror. To use the updated app in an existing automation, recreate the automation against the new app version.
* **Quieter Unity Version Control logs.** The UVCS server now logs at `INFO` level by default instead of `DEBUG`, which sharply reduces its log output and its disk and log-ingestion footprint. For a support investigation, you can temporarily restore verbose logging by setting the environment variable `UVCS_LOG_LEVEL=DEBUG` on the UVCS container.
* **Collaboration and automation API routes regenerated.** Both sets of routes are now generated from Unity Services Gateway v2 definitions. Redeploy to pick up the regenerated Traefik routes.
* **EKS add-ons upgrade automatically.** The `baseline-example` Terraform now installs and upgrades EKS add-ons to the latest version compatible with the cluster's Kubernetes version on every `terraform apply`, so add-on versions no longer need manual bumping. The `addon_*_version` Terraform variables are removed: delete any such entries from tfvars files that you copied from an earlier baseline, to avoid an undeclared-variable warning. The first apply after you update upgrades all add-ons in place through a rolling update, with no expected downtime.
* **Kubernetes 1.34 in the reference infrastructure.** The `baseline-example` Terraform now provisions Kubernetes 1.34 EKS clusters. To upgrade an existing cluster built from an earlier baseline, apply the updated configuration. EKS upgrades one minor version at a time, so a cluster more than one minor version behind needs intermediate `eks_cluster_version` steps, with one apply for each. EKS Auto Mode replaces nodes automatically after each control-plane upgrade. The unused `addon_pod_identity_agent_version` setting is removed, because EKS Auto Mode has the pod-identity agent built in; delete it from tfvars files copied from an earlier baseline.
* **Hardened ArgoCD installation values.** The `baseline-example` now ships hardened ArgoCD installation values at `common/argocd/values.yaml`. Without a PodDisruptionBudget, a node drain that evicted two of ArgoCD's three Redis replicas at once left ArgoCD unable to elect a new master, and every application then reported the sync status `Unknown` with `EOF` errors. The values add PodDisruptionBudgets, `podManagementPolicy: Parallel` on the Redis StatefulSet, and CPU and memory requests on Redis (plus its sentinel and HAProxy) and on the ArgoCD controller, server, repo-server, and applicationset containers. The last four previously ran with no requests at all, so a cluster autoscaler could remove the node running ArgoCD's only repo server, which broke manifest generation for every application until the pod was rescheduled.

  **Action required if you installed ArgoCD by following this example:** re-run `helm upgrade --install` with the updated file. Because `podManagementPolicy` is immutable, that setting also requires you to delete the Redis StatefulSet once, which makes ArgoCD unavailable for about a minute. Redis is an in-memory cache here, so there's nothing to back up:

  ```sh
  kubectl delete sts argocd-redis-ha-server
  ```
* **Longer node consolidation grace period.** The `baseline-example` NodePools now wait 15 minutes of node underutilization before consolidating a node, instead of 60 seconds. The short grace period made Karpenter repack nodes moments after every deployment rollout and between transformation steps, which evicted application services and in-flight transformation pods while they were in use. If you use these NodePools, re-apply them on existing clusters with `kubectl apply -f custom-nodepool.yaml`. Underutilized nodes now linger up to 15 minutes longer before scale-down.
* **S3-native Terraform state locking.** The `baseline-example` now locks Terraform state with the S3-native lock file instead of a DynamoDB table, whose backend setting Terraform has deprecated. `just init` no longer reads `TF_LOCK_TABLE`. On an already-initialized checkout, run `terraform init -reconfigure` once to switch. An existing lock table is no longer used and you can delete it.

#### No action required

* **Pipeline automation upgraded to v0.0.73.** Job-queue concurrency limits are now set explicitly: at most 2,000 concurrent automation jobs across the platform and ten for each organization. Previously, the service's built-in limits applied. No manifest or secret changes are required.
* **Bounded Valkey cache memory.** The Valkey cache now runs with CPU and memory requests and limits, and with a memory budget of 1 GiB. Previously it had no resource requests, which made it the first pod evicted under node memory pressure. When the budget is exhausted, Valkey refuses new writes instead of evicting data, so nothing — cache entries, queues, or locks — is silently dropped. Services report write errors until memory is freed.
* **Valkey upgraded to 9.1.1.** This upgrade contains security fixes. Valkey storage is ephemeral in this deployment, so the upgrade needs no data preparation. Cached data and queued notifications rebuild when the pod is replaced.
* **Pinned Terraform CLI version.** The `baseline-example` now includes a `.terraform-version` file that records the exact Terraform CLI version the example is validated with. Version-manager tools such as tfenv and tenv pick it up automatically. The `Terraform >= 1.12.0` requirement is unchanged.

### Fixed issues

#### Requiring action

* **User-scoped API calls work.** The access token issued to the `sdk`, `dashboard`, and `mini-usf` clients was missing the `sub` (user ID) claim, which made user-scoped API calls fail. Those clients now include the `basic` client scope, so their access tokens carry `sub` and `auth_time`.

  **Action required for existing deployments:** this isn't applied automatically, because the `unity` realm already exists and Keycloak skips the realm import. To add the scope manually:

  1. In the Keycloak Admin console, select the **unity** realm.
  2. Go to **Clients** and open the **sdk** client.
  3. Go to **Client scopes** > **Add client scope**, select **basic**, and add it as **Default**.
  4. Repeat for the **dashboard** and **mini-usf** clients.

  No redeployment is needed. New sign-ins immediately receive the `sub` claim.
* **Keycloak runs with multiple replicas on IPv6.** Keycloak now works with more than one replica on IPv6 single-stack clusters. Previously the replicas couldn't reach each other, so additional pods never became ready and blocked the deployment. If extra Keycloak replicas are already stuck unready when you upgrade, delete the remaining old pod once with `kubectl delete pod keycloak-0` so that all instances restart with the fix.
* **3D Data Streaming transformations schedule correctly.** Fixed 3D Data Streaming transformations stalling with pods stuck `Pending` forever. This affects only clusters provisioned with the `baseline-example` custom NodePools: the `transformations` NodePool carried an `argo-workflows=cpu` taint that the workflow's memory-escalation retry steps don't tolerate, so no node could be provisioned for them. The taint is removed. If you use those NodePools, re-apply them on existing clusters with `kubectl apply -f custom-nodepool.yaml`. Clusters with their own node pool setup aren't affected.
* **Automation apps register on clusters that use the baseline ECR registry.** Pulls made with a token refreshed by the ECR token-refresher CronJob were denied (`not authorized to perform: ecr:BatchGetImage`), because the refresher's IAM role could mint tokens but couldn't pull with them. The role now carries the ECR pull permissions: apply the updated `baseline-example` Terraform on existing clusters. The `SETUP.md` command that deploys the CronJob is also fixed to substitute the ArgoCD Helm credentials variable. A CronJob deployed with the previous command crashed with `unbound variable` after refreshing only two of the three secrets, so re-apply the CronJob with the updated command.

#### No action required

* **Faster asset search under load.** Reduced the `public-api` Redis timeout errors (`Timeout performing HMGET (5000ms)` in the service logs) that slowed asset search and aggregation responses under concurrent load. The service now starts with a larger .NET thread pool and can use up to 2 CPUs instead of 1, so cache responses are processed promptly during request bursts.
* **Interrupted transformations report as failed.** Transformations interrupted by a node disruption, such as a spot reclaim, a node upgrade, or a drain, no longer stay `Pending` in Asset Manager forever. They now report as failed and you can retry them.
* **Transformation data transfers retry.** Transformation steps that download and upload asset data, including the 3D Data Streaming import-validation step, now retry up to three times instead of failing the whole transformation on a single transient error.
* **Node consolidation no longer interrupts transformations.** Running transformation pods are annotated `karpenter.sh/do-not-disrupt: "true"`, so Karpenter node consolidation no longer evicts them mid-run. This has no effect on clusters that don't run Karpenter.
* **Download links use your external domain.** Dataset and artifact download links returned by the workspace service now use the deployment's external domain. Previously these links pointed at an in-cluster address (`http://uvcs:8000/...`) that is unreachable from outside the cluster, so those downloads failed for external clients. In-cluster consumers aren't affected.
* **Transformation actions pull all required images.** Transformation actions could fail with image pull errors on deployments that use a private registry, because several container images required by the built-in automation apps were missing from the registry mirror. All images used by the automation apps are now mirrored by the artifact sync.
* **Air-gapped mirror includes the deployed Istio proxy image.** The registry mirror now includes the Istio proxy image tag that the cluster actually deploys. Previously the mirrored and deployed tags differed.

## Version 0.15.0 — July 10, 2026

You must use vpctl 0.12.0 or later to deploy this release. Upgrade vpctl before you pull and deploy the release.

### New features

#### Unity Licensing Server on-premises

The Unity Licensing Server is now deployed on-premises and is reachable at `/licensing` under your application domain. It runs as a stateful service backed by a 10 GiB persistent volume and authenticates against the in-cluster Keycloak. No manifest configuration is required.

The volume must be on block storage, because the embedded database doesn't support NFS-class storage. It provisions on your cluster's default storage class, or on `configuration.kubernetes.storage.defaultStorageClass` when set. If you later need to move it to a different storage class, no data backup is required: remove the licensing server and its volume, redeploy the release, then request and import a new license bundle. For more information about managing the licensing server, refer to [Licensing](/self-hosted-deployment/admin/licensing.md).

On new deployments, the `unity-licensing-server` Keycloak client is created automatically with the ID-token mapper the licensing server requires, and `vpctl secret generate` auto-generates the matching `unity-licensing-server` Kubernetes Secret without operator input.

**Action required for existing deployments:** the Keycloak client isn't added on upgrade, because the `unity` realm already exists and Keycloak skips the realm import. To add the Keycloak client:

1. Use [upc-cli](/self-hosted-deployment/admin/upc-cli.md) to generate the client import file. The command requires `kubectl` access to the cluster:

```sh
python3 upc-cli.py --fqdn <your-domain> --no-auth keycloak generate-client-json --output unity-licensing-server-client.json
```

1. In the Keycloak Admin console, select the **unity** realm.
2. Go to **Clients** > **Import client**.
3. Browse to `unity-licensing-server-client.json`.
4. Select **Save**.

#### Identity synchronization and entitlements tracking

The platform now deploys scheduled jobs that:

* Periodically pull new and updated users, projects, organizations, role mappings, and group roles from your identity provider into Asset Manager.
* Take a daily entitlements snapshot.

No manifest configuration is required.

#### Single-stack IPv6 support

You can now deploy on an IPv6-only Kubernetes cluster. Set `configuration.networking.ipFamily: ipv6` in your manifest:

```yaml
configuration:
  networking:
    ipFamily: ipv6
```

This requires vpctl 0.12.0 or later and Kubernetes 1.29 or later.

Deployments that omit the field keep the IPv4 defaults.

If you provision reference AWS infrastructure from the `baseline-example` Terraform included in the release package, set `enable_ipv6_only = true` to provision an IPv6-only EKS cluster with the required VPC, subnet, and DNS64/NAT64 configuration.

#### Restricted Pod Security Admission compliance

All Asset Manager workloads now render a security context that complies with the Kubernetes Restricted Pod Security Admission profile:

* A non-root user.
* No privilege escalation.
* All Linux capabilities dropped.
* Using the `RuntimeDefault` seccomp profile.

This means you can deploy the platform into namespaces that enforce the `restricted` profile.

UVCS now runs as a non-root user.

Istio CNI, ztunnel, and the host-metrics node exporter remain privileged by design and need their own namespace exemptions if you enable enforcement.

### Improvements

* **Pipeline automation upgraded to v0.0.72.** This version adds a new secret: run `vpctl secret generate` (press Enter to auto-generate the value) and redeploy. The automation database migration runs automatically on deploy, so you need to snapshot your automation PostgreSQL database first. Leave the generated value unchanged on future upgrades.
* **Configurable in-cluster DNS service name.** The new `configuration.kubernetes.dnsService` manifest field (default `kube-dns`) overrides the in-cluster DNS service name that the Loki log-collection gateway resolves against. If the `loki-gateway` pod crash-loops with the error `host not found in resolver`, set the field to your Kubernetes distribution's CoreDNS service, for example `rke2-coredns-rke2-coredns` on RKE2. EKS, AKS, and k3s deployments keep the default.
* **Multiple deployments in one AWS account.** The `baseline-example` Terraform now supports running several deployments in the same AWS account without ECR or IAM name collisions. Use a distinct `project_name` for each project within a region, and IAM role names are now region-qualified so the same project can also deploy across regions. ECR repositories are namespaced for each project through the new `ecr_repository_prefix` variable, which defaults to `project_name`; set your manifest's `configuration.kubernetes.docker.namespace` to the same value.

### Fixed issues

* **Sign-on flows and OIDC discovery use your public domain.** Fixed sign-on flows redirecting to an unreachable `http://keycloak` URL, and in-cluster services discovering unreachable Keycloak OIDC endpoints. The bundled Keycloak 26 ignores the deprecated hostname options the chart previously set, so OIDC URLs were built from the request host instead of your public domain. The chart now pins the public frontend URL; in-cluster requests keep resolving internally.
* **Project creation works.** Fixed project creation failing with a 404 error. The bundled Traefik routes were missing the create-project endpoint, so creating a new project failed. This didn't impact management of existing projects.
* **Traefik installs without middleware conflicts.** Fixed a Traefik installation failure (`Middleware ... already exists`) caused by duplicate data-streaming route definitions. The deprecated data-streaming `tiles` path (`.../instances/tiles/{tileId}`) is removed; instead, use the `groups` path (`.../instances/groups/{groupId}`), which returns the same backend response.
* **3D Data Streaming workflows use the correct image.** The 3DDS storage-tool step previously had no container image configured, so the workflow failed at runtime.
* **Configuration changes restart UVCS and the licensing server.** The Unity Version Control (UVCS) and Unity Licensing Server pods now restart automatically when their configuration changes on upgrade. Previously, a configuration change was applied but the running pod kept serving the old configuration until you restarted it manually.
* **Asset storage uses the in-cluster message broker.** The `asset-storage` service now connects to the in-cluster RabbitMQ broker for its service message queue.

## Version 0.14.0 — June 3, 2026

### New features

#### Deploy charts in parallel

`vpctl release deploy` can now deploy independent charts within the same deployment wave in parallel, which reduces total deployment time. Pass `--concurrency N` on the command line, or set a default value for your environment in the manifest:

```yaml
deployment:
  helm:
    concurrency: 4
```

The default value is `1`, which deploys charts sequentially. Existing behavior remains unchanged unless you enable parallel deployment. If you set a concurrency value greater than `1`, `vpctl` buffers each chart's output and displays it after that chart finishes. As a result, the output order differs from sequential deployments. At the end of each deployment wave and after the deployment completes, `vpctl` displays a summary of successful and failed deployments.

#### Select hardened images in the manifest

You can now select the container image variant in your manifest with the new `configuration.imageVariant` field. Set the value to `hardened` to receive the hardened image builds:

```yaml
configuration:
  imageVariant: hardened
```

Previously, release packaging automatically applied the hardened image suffix. You now select either the base or hardened images directly in the manifest, which lets you deploy both image variants from the same release.

**Action required:** If you use hardened images, set `configuration.imageVariant: hardened` in your manifest before you upgrade. Otherwise, the deployment uses the base images.

#### Deploy in single-node infrastructure mode

Use the new `configuration.infrastructure.singleNode` option to collapse the stateful infrastructure components Garage, PostgreSQL (Percona), MongoDB (Percona), Elasticsearch (ECK), and RabbitMQ to a single replica each. This option also disables PodDisruptionBudgets and removes hard anti-affinity:

```yaml
configuration:
  infrastructure:
    singleNode: true
```

Use this option for single-node or constrained clusters that you use for ephemeral testing and evaluation environments. Don't use it in production environments. Resource sizing, monitoring, backups, and component-specific overrides continue to work as before.

#### Configurable Traefik node ports

Kubernetes now assigns Traefik node ports for the `web` and `websecure` entry points by default instead of using the previously hardcoded `32080` port for `web`. Existing deployments keep their current node ports after you upgrade because Kubernetes doesn't reassign a node port when the chart no longer requests a specific value.

If your firewall or external load balancer requires a fixed port, set the new `configuration.networking.ingress.traefik.nodePorts` field. Each value must be within the `30000-32767` range:

```yaml
configuration:
  networking:
    ingress:
      traefik:
        nodePorts:
          web: 32080
```

This field requires `vpctl` 0.11.0 or later. Earlier versions reject the manifest during validation with the error `nodePorts: field not allowed`.

### Improvements

* **Keycloak supports upstream TLS termination.** If an upstream load balancer terminates TLS, such as an NLB with an ACM certificate, and `configuration.networking.ingress.traefik.tls.enabled` is set to `false`, Traefik now forwards the correct HTTPS headers on the secure entry point. Previously, the Keycloak admin console redirected users to an unreachable `http://` URL and rejected sign-ins.
* **Garage starts successfully on the first deployment.** On a new installation, Garage pods could remain in a not-ready state because their health probes checked a cluster-level endpoint that remained unavailable until the bootstrap job completed. At the same time, the bootstrap job waited for the pods to become ready, which created a deadlock. The health probes have been removed to resolve this issue.
* **Monitoring resources deploy only when Prometheus is enabled.** The `secret-manager` and `argo-workflows` charts previously created `ServiceMonitor` resources even when Prometheus was disabled. Deployments without the Prometheus Operator failed with the error `no matches for kind "ServiceMonitor"`. These resources are now gated on `configuration.monitoring.prometheus.enabled`.
* **Traefik installs correctly in custom namespaces.** Two issues that could prevent Traefik from installing have been fixed. The CORS-preflight middlewares on the public data-streaming routes now use distinct names, and the API path rewrite middleware now deploys to your installation namespace instead of a hardcoded namespace. As a result, installations in custom namespaces no longer fail because of namespace conflicts or duplicate middleware resources.
* **Automation app registration succeeds.** The `automation-manager` post-install job previously entered a crash loop with the error `mkdir /.docker: permission denied` because the non-root container didn't have a writable home directory for registry credentials. The job now authenticates successfully with your container registry. No action is required other than redeploying the release.
* **Updated UVCS server and stronger password validation.** Updated the [UVCS](/unity-version-control.md) server to version `11.0.16.10181`. UVCS user and administrator passwords must now contain at least 32 characters. If you provide or import your own passwords, `vpctl secret generate` rejects shorter passwords before deployment instead of allowing the deployment to fail later with an authorization error. Automatically generated passwords already meet this requirement.
* **Use one private CA for ingress TLS and client authentication.** The certificate generation helper script can now issue the Traefik ingress certificate from the same private CA that it uses for X.509 client certificates. This change makes it easier to configure a fully private CA deployment, such as an internal or government PKI.

## Version 0.13.0 — May 12, 2026

### New features

#### Garage object storage replaces RustFS

The on-premises deployment now uses Garage as the S3-compatible object store, replacing RustFS. Garage runs as a 3-node distributed cluster (`replicationFactor: 3`) in all sizing profiles by default, and it stores Argo workflow artifacts and Percona MongoDB scheduled backups in its `argo-artifacts` and `psmdb-backups` buckets.

Use the new `configuration.infrastructure.components.garage` manifest field to configure Garage. The available settings are `resources` (standard CPU and memory requests and limits), `metaStorage`, `dataStorage`, `replicas`, and `replicationFactor` (capped at 3).

**Requirements:**

* vpctl 0.10.0 or later.
* At least 3 schedulable nodes in the general workloads pool. MongoDB and RabbitMQ already require this minimum because they spread their three replicas across distinct nodes by using `podAntiAffinity`. Garage uses the same model.

For the upgrade procedure and data preservation paths, refer to the **Breaking change** section that follows.

#### Customer-supplied CA bundle for internally-signed TLS

A new `configuration.networking.trustedCaSecretName` manifest field lets you mount your CA chain into the Argo workflow containers, the StorageTool, and all `asset-manager-*` Pixyz workflow templates. Use it when your Asset Manager ingress presents a TLS certificate signed by a private CA, such as a DoD PKI or an internal corporate CA, instead of a publicly trusted CA.

Reference a pre-existing Kubernetes Secret that holds a PEM-encoded CA bundle under the single key `ca-bundle.crt`:

```yaml
configuration:
  networking:
    trustedCaSecretName: my-ca-bundle
```

The .NET workflow containers and the Pixyz workflow templates pick up the bundle when they start.

### Improvements

* **Larger default PostgreSQL storage.** This release increases default PostgreSQL data and pgBackRest backup persistent volume sizes by sizing profile: 50 GiB data and 100 GiB backup (`small`), 400 GiB data and 800 GiB backup (`medium`), 800 GiB data and 1600 GiB backup (`large`). For existing clusters, ensure your StorageClass has `allowVolumeExpansion: true` so that the Percona PostgreSQL operator can resize the PVCs online; otherwise, resize the PVCs manually after upgrading.
* **Automation step logs stream again.** The `automation-external-secrets` Secret now also includes `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, mirrored from `s3-api-storage-credentials`, which the AutomationService needs to stream Argo step logs from object storage. After upgrading, rerun `vpctl secret generate` and `vpctl secret deploy`, then run `kubectl -n asset-solutions rollout restart deployment/automation` so that the AutomationService picks up the new environment variables.

### Breaking change

#### RustFS replaced by Garage

This release removes the `configuration.infrastructure.components.rustfs` manifest field. The S3-compatible object store is now Garage and uses the new `configuration.infrastructure.components.garage` manifest field. You must use vpctl `0.10.0` or later to deploy this release.

**Customer-visible side effects**

* The `s3-api-storage-credentials` Kubernetes Secret keeps its name, but the field names changed: `RUSTFS_ACCESS_KEY` is now `GARAGE_ACCESS_KEY`, and `RUSTFS_SECRET_KEY` is now `GARAGE_SECRET_KEY`. The `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` aliases still mirror those values for the Percona MongoDB operator. After upgrading vpctl, rerun `vpctl secret generate` and `vpctl secret deploy` to pick up the new schema.
* A new `garage-rpc-secret` Kubernetes Secret (single field `rpcSecret`, 64-character hex) holds the Garage cluster RPC secret. The Garage chart consumes it through `existingRpcSecret`. vpctl creates this Secret automatically as part of `vpctl secret generate` — no extra action is required beyond the standard first-time deploy flow.
* Percona MongoDB scheduled backups now write to the Garage `psmdb-backups` bucket through `garage:3900`. There's no manifest-level change required.
* The `/rustfs` Traefik debug ingress route is removed. To reach the S3 API directly, use `kubectl port-forward svc/garage 3900:3900`.

##### Migration paths

Choose one of these paths before you run `vpctl release deploy`.

**Path A — wipe and redeploy (recommended for staging environments).** RustFS object data isn't preserved. Argo workflow artifacts are ephemeral, Percona MongoDB regenerates backups on the next scheduled run, and Asset Manager re-ingests content on demand.

Before you continue with the rest of the upgrade guide, drain the RustFS PVCs:

```sh
kubectl -n asset-solutions delete pvc -l app.kubernetes.io/name=rustfs
```

Then return to the upgrade guide and complete steps 4 (sync artifacts), 5 (regenerate and deploy secrets), and 6 (regenerate and deploy charts). When `vpctl release deploy` completes, Garage replaces RustFS in the same release, and the `garage-bucket-bootstrap` post-sync Job assigns the cluster layout, imports your `GARAGE_ACCESS_KEY` and `GARAGE_SECRET_KEY` into Garage, and creates the `argo-artifacts` and `psmdb-backups` buckets.

**Path B — preserve data with `mc mirror`.** Recommended if you want to keep existing PSMDB backup dumps. This release includes a helper script, `migrate-rustfs-to-garage.sh`, under `extracted-release/common/scripts/`.

Before you regenerate and deploy the new secrets (step 5 in the upgrade guide), run the backup phase from a workstation that can reach the cluster. At this point, the in-cluster `s3-api-storage-credentials` Secret still holds the old `RUSTFS_*` fields, so the script can mirror the `argo-artifacts` and `psmdb-backups` buckets from RustFS to a local directory:

```sh
export RUSTFS_ACCESS_KEY=$(kubectl -n asset-solutions get secret s3-api-storage-credentials -o jsonpath='{.data.RUSTFS_ACCESS_KEY}' | base64 -d)
export RUSTFS_SECRET_KEY=$(kubectl -n asset-solutions get secret s3-api-storage-credentials -o jsonpath='{.data.RUSTFS_SECRET_KEY}' | base64 -d)
NAMESPACE=asset-solutions BACKUP_DIR=./rustfs-backup ./extracted-release/common/scripts/migrate-rustfs-to-garage.sh backup
```

Return to the upgrade guide and complete steps 5 (regenerate and deploy secrets) and 6 (regenerate and deploy charts). After `vpctl release deploy` finishes and both the Garage StatefulSet and the `garage-bucket-bootstrap` Job are complete, restore the buckets to Garage:

```sh
export GARAGE_ACCESS_KEY=$(kubectl -n asset-solutions get secret s3-api-storage-credentials -o jsonpath='{.data.GARAGE_ACCESS_KEY}' | base64 -d)
export GARAGE_SECRET_KEY=$(kubectl -n asset-solutions get secret s3-api-storage-credentials -o jsonpath='{.data.GARAGE_SECRET_KEY}' | base64 -d)
NAMESPACE=asset-solutions BACKUP_DIR=./rustfs-backup ./extracted-release/common/scripts/migrate-rustfs-to-garage.sh restore
```

## Version 0.12.0 — April 30, 2026

### Improvements

#### Hardened [UVCS](/unity-version-control.md) container security

The `uvcs` (previously Plastic SCM) StatefulSet now runs as a non-root user (UID 1000) with a hardened security context. This disables privilege escalation, drops all Linux capabilities, and enforces the `RuntimeDefault` seccomp profile. This change lets you deploy in clusters that enforce strict Pod Security Standards or Kyverno policies that forbid `runAsUser: 0`.

**Action required before you upgrade existing deployments**

1. **Plan a maintenance window.** On the first `uvcs` pod restart after the upgrade, Kubernetes recursively changes ownership of the `uvcs` persistent volume (`/jet`) to GID 1000 through `fsGroupChangePolicy: OnRootMismatch`. For large repositories, this operation can take several minutes, during which the `uvcs` pod is unavailable.
2. **Validate that your CSI driver applies `fsGroup` correctly.**
3. **Verify the upgrade.** After the upgrade completes, confirm the new security context:
   * `kubectl exec uvcs-0 -c uvcs -- id` returns `uid=1000 gid=1000`.
   * `kubectl exec uvcs-0 -c uvcs -- ls -ld /jet` shows group `1000` and no permission errors.
   * `kubectl logs uvcs-0 -c uvcs` shows the entrypoint creating symlinks under `/opt/plasticscm5/server` without errors and `plasticd` binding `:8087`.

## Version 0.11.0 — April 24, 2026

### New features

#### Helm chart sourcing (preview)

The new `deployment.helmChartMode` manifest setting lets you choose how Helm charts are delivered:

* `local` (default): the process installs charts from the release package. This is the safest option for existing deployments and for air-gapped environments.
* `remote`: the process pulls charts from an OCI Helm registry at deployment time.

The `remote` mode and the matching `vpctl artifact sync charts` command are available as a preview in this release. Not all charts are published to the Unity OCI Helm registry yet, so a fully remote-only deployment isn't supported. For production deployments, continue to use the default `local` mode.

#### Default monitoring alerts

The Prometheus monitoring stack now ships with a curated set of cluster and workload alerting rules out of the box. You no longer need to assemble these rules manually before going to production.

#### Hardened container variant for the upc-job image

The `upc-job` image now ships in a hardened variant, which is built on a minimal base image with a reduced attack surface for stricter security baselines.

### Improvements

* **Higher default resource allocations**: MongoDB, mini-usf, and public-api now request more CPU and memory by default, which reduces the need for manual tuning to reach production-level performance.
* **Idempotent onboarding**: the `upc-onboarding` job is now safe to rerun. The job no longer fails or duplicates resources if you retrigger it after a partial deployment.
* **More resilient RabbitMQ scheduling**: RabbitMQ pods now schedule successfully on clusters that don't expose availability zone labels.
* **Reliable Keycloak tokens**: Keycloak-issued tokens now include the `sub` and `auth_time` claims required by downstream services. This fixes a regression introduced by Keycloak 26's stricter scope handling.
* **Mini-usf routing fixes**: legacy admin routes and the groups routes are now matched correctly, including the right middlewares and permissions for the global admin role.
* **Quieter object storage logs**: RustFS no longer floods the log volume at default verbosity. The default log level is now `error`, which prevents disk pressure on the log PVC.
* **Organization management connectivity**: the `organization-management` service now reads the correct RabbitMQ consumer queue setting and starts cleanly.

## Version 0.10.0 — March 20, 2026

### New features

#### Official Keycloak 26 image

The identity stack now runs the official Keycloak 26 image through the new keycloak-standalone chart, replacing the previous Bitnami-based Keycloak distribution. This change brings access to upstream Keycloak features and a faster security update cadence.

If you previously customized the Bitnami Keycloak chart, review your manifest before upgrading.

#### Automation app scheduling

A new `uc-scheduler-runner` image powers scheduled jobs for automation apps such as Asset Manager and Pixyz. Scheduling now runs as part of the deployment without additional manual setup.

### Improvements

* The fallback namespace used for automation resource isolation (`UCAUTOMATION_ResourceIsolationOptions__FallbackNamespace`) now follows the namespace defined in your manifest instead of being hardcoded. Multi-namespace deployments work without code changes.

## Version 0.9.0 — March 17, 2026

### New features

#### Automation app management

Automation apps such as Asset Manager and Pixyz are now automatically registered during deployment. A post-deployment job handles app registration, removing the need for manual setup.

## Version 0.8.0 — March 13, 2026

### New features

#### Log storage configuration

You can now control the persistent volume size for log storage independently from data storage for the object storage component. Sizing profile defaults range from 1 GiB (`small`) to 10 GiB (`large`), and you can override the value per component.

#### Transformation parallelism control

A new `configuration.transformations.parallelism` manifest field lets you set the maximum number of concurrent transformation workflows. The default value is 20.

### Improvements

* Deployment validation now enforces that the store encryption key is exactly 32 characters, catching misconfigured keys before they cause runtime errors.

### Breaking change

The `configuration.licensing` section, including FlexLM and `sdkLicenses` settings, has been removed. Built-in transformation workflows are now always enabled, and their concurrency is controlled through the new `configuration.transformations.parallelism` manifest field. Remove any licensing configuration from your manifest before upgrading.

## Version 0.7.0 — March 3, 2026

### New features

#### CLI version compatibility checks

The release package now declares the minimum required `vpctl` version. The `vpctl release generate` and `vpctl secret generate` commands check this requirement before running and block execution if the CLI version is too old. This prevents silent misconfigurations from manifest schema changes.

### Improvements

#### Object storage distributed mode

Object storage now runs in distributed mode by default, improving data durability and availability.

## Version 0.6.0 — February 23, 2026

### New features

#### Infrastructure sizing profiles

You can now control the CPU, memory, and storage allocations for the following infrastructure components directly from the manifest: MongoDB, PostgreSQL, RabbitMQ, object storage, and Elasticsearch.

Choose from three named sizing profiles: `small`, `medium`, or `large`. Alternatively, override the resources for individual components to match your workload.

#### Improved container image management

All infrastructure images, including Istio and Percona MongoDB backup images, are now sourced from your private container registry instead of public registries. This method improves reliability and security in air-gapped or restricted network environments.

### Breaking change

Support for the custom Pixyz scripts has been removed. If you previously used the `automation.customPixyzScript` manifest configuration, remove it from your manifest before upgrading.

## Version 0.5.0 — February 17, 2026

### New features

#### Centralized log collection

Log collection is now available through Loki and Alloy. Enable it in your manifest with the `monitoring.logCollection.enabled` option to aggregate logs from all services in your deployment.

### Improvements

#### Automated MongoDB backups

Percona MongoDB now automatically backs up data to RustFS S3-compatible storage, improving data durability without requiring manual backup configuration.

## Version 0.4.0 — February 12, 2026

### New features

#### Istio service mesh support

You can now enable Istio with ambient mode for service-to-service traffic management and observability. Configure Istio in your manifest under `configuration.networking.serviceMesh.istio`.

#### SDK license management

A new `sdkLicenses` setting in the manifest licensing section lets you specify how many Pixyz SDK licenses are available. This setting controls the maximum number of concurrent transformation workflows.

### Improvements

* Improved container image handling for workflow execution
* Improved object storage reliability with automated bucket creation during deployment

## Version 0.3.0 — January 28, 2026

### New features

#### Full application suite

This release adds the complete set of application services, including:

* **Asset Manager**: full asset management with storage, collaboration, and search
* **Automations and workflows**: pipeline automation with Argo Workflows
* **Identity and access management**: Keycloak for authentication and role-based access control
* **Notifications**: event notifications through Novu
* **Ingress**: Traefik as the ingress controller and load balancer

## Version 0.2.0 — December 8, 2025

### New features

#### Core infrastructure services

This release adds the foundational infrastructure layer, including:

* **Databases**: PostgreSQL (via PG Operator) and Elasticsearch for relational data and search
* **Caching**: Valkey for in-memory data storage
* **Messaging**: RabbitMQ for asynchronous communication
* **Asset services**: storage abstraction, collaboration, authoring, bulk operations, and catalog management

## Version 0.1.0 — November 28, 2025

### New features

First release of Self-Hosted Deployment On-Premises.
