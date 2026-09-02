import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

// A DIY backend puts every project under a virtual org called "organization".
const metal = new pulumi.StackReference("organization/home-infra/metal");

// The kubeconfig comes out of an Output, so there is no ambient default
// provider: every resource below has to be passed this one explicitly.
export const provider = new k8s.Provider("cluster", {
    kubeconfig: metal.requireOutput("kubeconfigTailscale").apply(String),
});
