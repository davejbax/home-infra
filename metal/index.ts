import * as pulumi from "@pulumi/pulumi";
import { parse, stringify } from 'yaml';

import { TAILSCALE_HOST } from "./config";
import { images, kubeconfig, talosconfig } from "./talos";

export const diskImageUrl = images.urls.diskImage;
export const installerImage = images.urls.installer;
export const talosconfigRaw = pulumi.secret(talosconfig.talosConfig);
export const kubeconfigRaw = pulumi.secret(kubeconfig.kubeconfigRaw);

// The same credentials as kubeconfigRaw, pointed at the node's MagicDNS name
// instead of its LAN address. Talos mints the kubeconfig against the cluster
// endpoint, which is on the subnet; the workloads stack reaches the API server
// over Tailscale, so it needs this one.
export const kubeconfigTailscale = pulumi.secret(
    kubeconfig.kubeconfigRaw.apply((raw) => {
        const kc = parse(raw);
        kc.clusters[0].cluster.server = `https://${TAILSCALE_HOST}:6443`;
        return stringify(kc);
    }),
);
