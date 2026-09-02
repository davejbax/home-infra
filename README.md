# talos-pulumi

Pulumi programs managing a single-node Talos Linux Kubernetes cluster on a
Raspberry Pi. State lives in a Cloudflare R2 bucket.

## The two stacks

Both directories declare the same Pulumi project, `home-infra`, and differ by
stack:

| Stack                   | Directory    | Needs                    | Changes     |
| ----------------------- | ------------ | ------------------------ | ----------- |
| `home-infra/metal`      | `metal/`     | the node's own subnet    | rarely      |
| `home-infra/workloads`  | `workloads/` | Tailscale                | often, by CI |

`metal` owns the Talos side: the Image Factory schematic, machine secrets,
machine config, bootstrap and the kubeconfig. It talks to the Talos API on port
50000, so it only runs from home. Everything configurable is a const in
`metal/config.ts`.

`workloads` owns what runs on the cluster. It reads `metal`'s kubeconfig through
a `StackReference` and reaches the API server over Tailscale, so it runs from
anywhere -- including GitHub Actions, which applies it on every push to `main`.

Because both directories share a project name, the *selected* stack is not a
safe default: `pulumi up` in `workloads/` with `metal` selected would preview as
"destroy the cluster". Every Makefile target passes `-C <dir>` and `--stack`
explicitly, and so does CI. Do the same by hand, or trust the preview.

## Setup

```sh
mise install
cp .env.example .env    # fill in R2 bucket, account ID, API token, passphrase
pnpm install
```

mise loads `.env`, and `PULUMI_BACKEND_URL` in it points Pulumi at R2 -- there is
no `pulumi login` step.

The cluster CAs are in the state file, encrypted with
`PULUMI_CONFIG_PASSPHRASE`. Lose the passphrase or the bucket and you lose admin
access to the cluster. Both stacks must share one passphrase: a `StackReference`
cannot be handed a different one for the stack it reads.

This is a pnpm workspace. Shared dependency versions are declared once in the
catalog in `pnpm-workspace.yaml`; each project lists only what it imports,
because pnpm's `node_modules` is strict rather than hoisted.

## Bring-up

Get the image URL. This creates only the Image Factory schematic, so it's safe
to run before the Pi exists:

```sh
make image-url
curl -L "<url>" | xz -d | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
```

Boot the Pi, find its DHCP lease, set `NODE_IP` in `metal/config.ts` to it, then:

```sh
make metal-up
make talosconfig && export TALOSCONFIG=$PWD/talosconfig
make kubeconfig  && export KUBECONFIG=$PWD/kubeconfig
kubectl get nodes
```

`make kubeconfig-ts` writes the same credentials pointed at the node's MagicDNS
name instead, for use off the subnet.

## Reaching the cluster over Tailscale

The node runs the `siderolabs/tailscale` system extension, so the API server is
reachable on its tailnet address. Two things make that usable:

- `TAILNET` in `metal/config.ts` gives the node's MagicDNS name, which is added
  to the API server's `certSANs`. It's derived from `HOSTNAME`, so it's known
  before the node boots and survives the Tailscale IP changing. **Set this to
  your own tailnet before applying** -- it gets baked into the certificate.
- `kubeconfigTailscale` is the stack output pointing at that name.

CI joins the tailnet as an ephemeral node tagged `tag:ci`, which the ACL must
allow to reach the node on 6443:

```json
"tagOwners": { "tag:ci": ["autogroup:admin"] },
"grants": [
  { "src": ["tag:ci"], "dst": ["lumbridge"], "ip": ["6443"] }
]
```

Repository secrets the workflow needs: `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `PULUMI_CONFIG_PASSPHRASE`, `TS_OAUTH_CLIENT_ID`,
`TS_OAUTH_SECRET`. The Tailscale OAuth client needs the `auth_keys` write scope
and must own `tag:ci`.

## Upgrading

Bump `TALOS_VERSION` in `metal/config.ts` and the `talos` pin in `mise.toml`
together, `make metal-up`, then
`talosctl upgrade --image $(pulumi -C metal --stack metal stack output installerImage)`.

Check a config by hand with `talosctl validate -c <file> -m metal`.
