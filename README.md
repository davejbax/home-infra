# home-infra

This repo manages my home infrastructure with Pulumi.

## Ingredients

* Raspberry Pi 4 (8GB)
* Talos OS
* Pulumi
  * R2 backend

## Setup

```sh
mise install
cp .env.example .env && chmod 0600 .env # Fill in .env
pnpm install
```

## Stacks

This repo is split into two stacks:

* `metal` -- Requires Pi subnet access. Used for bootstrapping Talos.
* `workloads` -- Kubernetes resources, applied over Tailscale. Applied by CI.

### metal

`make metal-up`

### workloads

`make workloads-up`

## Bootstrapping the cluster

1. Generate the image schematic URL: `make image-url`
2. Flash Pi with the image
3. Wait for boot, take note of DHCP-assigned IP; set as `NODE_IP`
4. Install Talos: `make metal-up`

## Kubernetes access

* Direct access: `make kubeconfig`
* Tailscale access: `make kubeconfig-ts`

## Appendix

### GitHub Actions setup

* `preview` environment
  * Make sure required reviews is turned on
* `deploy` environment

Both environments need five secrets:

* `AWS_ACCESS_KEY_ID` - R2 bucket access key ID
* `AWS_SECRET_ACCESS_KEY` - R2 bucket secret key
* `PULUMI_CONFIG_PASSPHRASE` - Pulumi passphrase for secrets
* `TS_OAUTH_CLIENT_ID` - Tailscale OIDC credential (needs auth key write permission for `tag:ci`)
* `TS_AUDIENCE` - Tailscale OIDC credential (as above)

### Tailscale setup

* `tag:k8s` - This tag will be assigned to Kubernetes nodes
* `tag:ci` - This tag will be assigned to the CI runners, and needs to have permission to access `tag:k8s` on port 6443 (Kubernetes API)

