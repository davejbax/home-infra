# talos-pulumi

Pulumi program managing a single-node Talos Linux Kubernetes cluster on a
Raspberry Pi. State lives in a Cloudflare R2 bucket.

Everything configurable is a const at the top of `index.ts`.

## Setup

```sh
mise install
cp .env.example .env    # fill in R2 bucket, account ID, API token, passphrase
```

mise loads `.env`, and `PULUMI_BACKEND_URL` in it points Pulumi at R2 — there is
no `pulumi login` step. Then `pulumi stack init homelab`.

The cluster CAs are in the state file, encrypted with
`PULUMI_CONFIG_PASSPHRASE`. Lose the passphrase or the bucket and you lose
admin access to the cluster.

## Bring-up

Get the image URL. This creates only the Image Factory schematic, so it's safe
to run before the Pi exists:

```sh
make image-url
curl -L "<url>" | xz -d | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
```

Boot the Pi, find its DHCP lease, set `NODE_IP` in `index.ts` to it, then:

```sh
pulumi up
make talosconfig && export TALOSCONFIG=$PWD/talosconfig
make kubeconfig  && export KUBECONFIG=$PWD/kubeconfig
kubectl get nodes
```

## Upgrading

Bump `TALOS_VERSION` and the `talos` pin in `mise.toml` together, `pulumi up`,
then `talosctl upgrade --image $(pulumi stack output installerImage)`.

Check a config by hand with `talosctl validate -c <file> -m metal`.
