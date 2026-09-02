TODO:

- deslopify (this README is terrible, and probably tear out every single comment that Claude wrote because they're all bad)
- add some workloads

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

### Policy file

The tailnet policy file is *not* managed here -- `tailscale.Acl` owns the whole
document and would overwrite console edits, which is a poor trade for one grant.
Set it by hand in Access controls:

```json
"tagOwners": {
  "tag:k8s": ["autogroup:admin"],
  "tag:ci":  ["autogroup:admin"]
},
"grants": [
  { "src": ["tag:ci"], "dst": ["tag:k8s"], "ip": ["6443"] }
]
```

The node wears `tag:k8s` and CI joins as an ephemeral node tagged `tag:ci`.
Both tags must exist in `tagOwners` before anything can wear them, so this is
the first thing to set up.

### Auth keys

The node's auth key is a `tailscale.TailnetKey` in `metal/tailnet.ts`, not a
pasted-in config value. Pulumi needs an OAuth client to mint it (Settings ->
OAuth clients) with the `auth_keys` write scope and the tag `tag:k8s` -- a
client can only mint keys carrying tags it owns:

```sh
pulumi -C metal --stack metal config set tailscale:oauthClientId <id>
pulumi -C metal --stack metal config set tailscale:oauthClientSecret <secret> --secret
```

OAuth clients don't expire; API keys cap out at 90 days, which is why this isn't
`tailscale:apiKey`.

The key is single-use and is consumed the moment the node joins, so it is
deliberately never regenerated -- otherwise every `pulumi up` would rewrite the
machine config. Before re-flashing the node, mint a fresh one with
`make new-authkey`.

CI uses a second, separate OAuth client: `auth_keys` write scope, tag `tag:ci`,
stored as the `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` repository secrets.

Repository secrets the workflow needs: `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `PULUMI_CONFIG_PASSPHRASE`, `TS_OAUTH_CLIENT_ID`,
`TS_OAUTH_SECRET`.

## Upgrading

Bump `TALOS_VERSION` in `metal/config.ts` and the `talos` pin in `mise.toml`
together, `make metal-up`, then
`talosctl upgrade --image $(pulumi -C metal --stack metal stack output installerImage)`.

Check a config by hand with `talosctl validate -c <file> -m metal`.
