.DEFAULT_GOAL := help
.PHONY: help image-url new-authkey talosconfig kubeconfig kubeconfig-ts metal-up workloads-up

# Both directories declare the same Pulumi project (home-infra), so the selected
# stack is not a safe default -- every target names its stack explicitly.
METAL     := pulumi -C metal --stack metal
WORKLOADS := pulumi -C workloads --stack workloads

help: ## Show this help
	@echo "Usage: make <target>"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

image-url: ## Build the Talos disk image schematic and print its download URL
	$(METAL) up --yes --target '**Schematic**'
	$(METAL) stack output diskImageUrl

new-authkey: ## Force-rotate the Tailscale auth key (if it expired and a node won't join)
	$(METAL) up --replace '**TailnetKey**'

metal-up: ## Apply the machine layer (needs access to the node's subnet)
	$(METAL) up

workloads-up: ## Apply the Kubernetes layer (needs Tailscale)
	$(WORKLOADS) up

talosconfig: ## Write ./talosconfig from the stack output
	$(METAL) stack output talosconfigRaw --show-secrets > talosconfig

kubeconfig: ## Write ./kubeconfig, pointed at the node's LAN address
	$(METAL) stack output kubeconfigRaw --show-secrets > kubeconfig

kubeconfig-ts: ## Write ./kubeconfig, pointed at the node's Tailscale name
	$(METAL) stack output kubeconfigTailscale --show-secrets > kubeconfig
