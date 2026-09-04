import * as k8s from "@pulumi/kubernetes";

import { provider } from "./k8s";

const apps = new k8s.core.v1.Namespace("apps", {
    metadata: { name: "apps-test" },
}, { provider });

export const appsNamespace = apps.metadata.name;
