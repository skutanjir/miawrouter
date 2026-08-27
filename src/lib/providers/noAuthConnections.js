// Pseudo-connections for keyless (noAuth) free providers.
//
// /v1/models merges stored provider connections with these synthetic rows so
// that no-auth free providers (opencode, pollinations, …) are always listed,
// even before the user has added any credential. Each row only carries the
// fields the models pipeline reads: provider id, active flag and an empty
// providerSpecificData bag.
import { AI_PROVIDERS } from "@/shared/constants/providers";

export function buildNoAuthConnections(providers = AI_PROVIDERS) {
  return Object.values(providers || {})
    .filter((provider) => provider?.noAuth && !provider?.hidden)
    .map((provider) => ({
      id: `noauth-${provider.id}`,
      provider: provider.id,
      isActive: true,
      providerSpecificData: {},
    }));
}
