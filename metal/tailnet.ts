import * as tailscale from "@pulumi/tailscale";

import { CLUSTER_NAME, NODE_TAG } from "./config";

// Tailscale auth key used for Talos nodes
export const nodeAuthKey = new tailscale.TailnetKey("node", {
    description: `Talos nodes for ${CLUSTER_NAME}`,
    reusable: true,
    ephemeral: false,
    preauthorized: true,
    recreateIfInvalid: "always",
    expiry: 90*24*60*60, // 90 days
    tags: [NODE_TAG],
});
