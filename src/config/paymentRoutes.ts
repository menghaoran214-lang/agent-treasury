import type { PaymentRoute, Policy, ProviderOffer } from '../domain/types.js';

export const BSC_USDT_ROUTE = Object.freeze({
  chain_id: '56',
  chain_name: 'BSC',
  token_symbol: 'USDT',
  token_address: '0x55d398326f99059fF775485246999027B3197955',
});

function validEvmAddress(value: string | undefined): value is string {
  return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0+$/.test(value));
}

export function getConfiguredVendorRoute(providerId: string): PaymentRoute | null {
  const configuredVendorId = process.env.TREASURY_REAL_PROOF_VENDOR_ID?.trim() || 'real-proof-vendor';
  const recipient = process.env.TREASURY_REAL_PROOF_RECIPIENT?.trim();
  if (providerId !== configuredVendorId || !validEvmAddress(recipient)) return null;

  return { ...BSC_USDT_ROUTE, recipient };
}

export function routeFingerprint(purchaseId: string, route: PaymentRoute, amount: number): string {
  return [
    purchaseId,
    route.chain_id,
    route.token_address.toLowerCase(),
    route.recipient.toLowerCase(),
    amount.toString(),
  ].join(':');
}

export function resolvePaymentRoute(params: {
  provider: ProviderOffer;
  policy?: Policy;
  configuredChainId: string;
  configuredToken: string;
}): { ok: true; route: PaymentRoute } | { ok: false; reason: string } {
  const { provider, policy, configuredChainId, configuredToken } = params;
  const route = getConfiguredVendorRoute(provider.provider_id);
  if (!route) return { ok: false, reason: `No verified payment route for vendor: ${provider.provider_id}` };
  if (provider.currency.toUpperCase() !== route.token_symbol) {
    return { ok: false, reason: `Settlement currency mismatch: offer is ${provider.currency}, route requires ${route.token_symbol}` };
  }
  if (configuredChainId !== route.chain_id) {
    return { ok: false, reason: `Unsupported chain: ${configuredChainId} (${route.chain_name} Mainnet ${route.chain_id} only)` };
  }
  if (configuredToken.toLowerCase() !== route.token_address.toLowerCase()) {
    return { ok: false, reason: `Unsupported token: BSC ${route.token_symbol} only (${route.token_address})` };
  }
  const allowed = policy?.allowed_payment_routes;
  if (allowed?.length && !allowed.some(candidate =>
    candidate.chain_id === route.chain_id
    && candidate.token_symbol.toUpperCase() === route.token_symbol
    && candidate.token_address.toLowerCase() === route.token_address.toLowerCase()
  )) {
    return { ok: false, reason: `Payment route blocked by policy: ${route.chain_name}/${route.token_symbol}` };
  }
  if (policy?.allow_bridge_or_swap) {
    return { ok: false, reason: 'Bridge or swap must remain disabled for the MVP payment route' };
  }
  return { ok: true, route };
}
