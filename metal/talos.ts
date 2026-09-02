import * as talos from "@pulumiverse/talos";
import { stringify } from 'yaml';

import { CLUSTER_NAME, TALOS_VERSION, HOSTNAME, NODE_IP, INSTALL_DISK, TAILSCALE_HOST } from "./config";
import { nodeAuthKey } from "./tailnet";

export const schematic = new talos.imagefactory.Schematic("schematic", {
    schematic: stringify({
        overlay: {
            image: 'siderolabs/sbc-raspberrypi',
            name: 'rpi_generic',
            options: {
                // Wire up GPIO-controlled fan: turn on at 55deg C.
                configTxtAppend: 'dtoverlay=gpio-fan,gpiopin=18,temp=55000',
            },
        },
        customization: {
            systemExtensions: {
                officialExtensions: ['siderolabs/tailscale'],
            }
        }
    })
});

export const images = talos.imagefactory.getUrlsOutput({
    talosVersion: TALOS_VERSION,
    schematicId: schematic.id,
    architecture: "arm64",
    sbc: "rpi_generic",
});

export const secrets = new talos.machine.Secrets("secrets", { talosVersion: TALOS_VERSION });

// The provider marks `key` secret, and secretness carries through the apply,
// so the machine config this ends up in stays encrypted in state.
const tailscaleExtension = nodeAuthKey.key.apply((key) => {
    return stringify({
            apiVersion: 'v1alpha1',
            kind: 'ExtensionServiceConfig',
            name: 'tailscale',
            environment: [
              `TS_AUTHKEY=${key}`,
            ],
        });
});

const machineConfig = talos.machine.getConfigurationOutput({
    clusterName: CLUSTER_NAME,
    clusterEndpoint: `https://${NODE_IP}:6443`,
    machineType: "controlplane",
    machineSecrets: secrets.machineSecrets,
    talosVersion: TALOS_VERSION,
    configPatches: [
        images.urls.installer.apply((image) => stringify({
            machine: {
                install: {
                    image: image,
                    disk: INSTALL_DISK,
                },
                certSANs: [NODE_IP, TAILSCALE_HOST],
            },
            cluster: {
                allowSchedulingOnControlPlanes: true,
                apiServer: {
                    certSANs: [NODE_IP, TAILSCALE_HOST]
                },
                coreDNS: {
                    image: 'registry.k8s.io/coredns/coredns:v1.14.7'
                },
            }
        })),
        //
        // Talos 1.13 sets the hostname in its own document, generated with
        // `auto: stable`. Patches merge into that document rather than replacing
        // it, so `auto` has to be turned off here or validation rejects both
        // being set.
        stringify({
            apiVersion: 'v1alpha1',
            kind: 'HostnameConfig',
            auto: 'off',
            hostname: HOSTNAME,
        }),
        tailscaleExtension,
   ],
});

const configApply = new talos.machine.ConfigurationApply("config", {
    clientConfiguration: secrets.clientConfiguration,
    machineConfigurationInput: machineConfig.machineConfiguration,
    node: NODE_IP,
});

const bootstrap = new talos.machine.Bootstrap(
    "bootstrap",
    { clientConfiguration: secrets.clientConfiguration, node: NODE_IP },
    { dependsOn: [configApply] },
);

export const kubeconfig = new talos.cluster.Kubeconfig(
    "kubeconfig",
    { clientConfiguration: secrets.clientConfiguration, node: NODE_IP },
    { dependsOn: [bootstrap] },
);

export const talosconfig = talos.client.getConfigurationOutput({
    clusterName: CLUSTER_NAME,
    clientConfiguration: secrets.clientConfiguration,
    endpoints: [NODE_IP],
    nodes: [NODE_IP],
});
