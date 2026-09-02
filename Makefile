.DEFAULT_GOAL := help
.PHONY: help image-url talosconfig kubeconfig

help: ## Show this help
	@echo "Usage: make <target>"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

image-url: ## Build the Talos disk image schematic and print its download URL
	pulumi up --yes --target '**Schematic**'
	pulumi stack output diskImageUrl

talosconfig: ## Write ./talosconfig from the stack output
	pulumi stack output talosconfigRaw --show-secrets > talosconfig

kubeconfig: ## Write ./kubeconfig from the stack output
	pulumi stack output kubeconfigRaw --show-secrets > kubeconfig
