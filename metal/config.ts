export const CLUSTER_NAME = "homelab";
export const TALOS_VERSION = "v1.14.0";
export const HOSTNAME = "lumbridge";
export const NODE_IP = "192.168.1.99";
export const INSTALL_DISK = "/dev/sda";

// ACL tag the node is authenticated under. Tagged devices have key expiry
// disabled, and the CI grant targets the tag rather than the device name.
export const NODE_TAG = "tag:k8s";

// MagicDNS suffix for the tailnet, from the Tailscale admin console (DNS page).
export const TAILNET = "swallow-banana.ts.net";

// Where the workloads stack reaches this node. Derived from the hostname the
// machine config pins, so it is known before the node exists -- and it
// survives the node's Tailscale IP changing.
export const TAILSCALE_HOST = `${HOSTNAME}.${TAILNET}`;
