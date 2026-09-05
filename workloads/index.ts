import * as k8s from "@pulumi/kubernetes";

import { provider } from "./k8s";

new k8s.helm.v3.Chart("akri", {
    chart: "akri-dev",
    version: "0.14.0",
    namespace: "akri",
    fetchOpts:{
        repo: "https://project-akri.github.io/akri",
    },
    values: {
      udev: {
        configuration: {
          enabled: true,
          discoveryDetails: {
            udevRules: [
              'DRIVERS=="cp210x"'
            ],
            groupRecursive: true,
          }
        },
        discovery: {
          enabled: true
        }
      }
    }
}, { provider });
