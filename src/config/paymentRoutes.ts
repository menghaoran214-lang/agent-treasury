import type { PaymentRoute, Policy, ProviderOffer } from '../domain/types.js';

export const BSC_USDT_ROUTE = Object.freeze({
  route_id: 'bsc-usdt-direct',
  chain_id: '56',
  chain_name: 'BSC',
  token_symbol: 'USDT',
  token_address: '0x55d398326f99059fF775485246999027B3197955',
  rail: 'direct-token-transfer',
  verified: true,
  priority: 100,
});

function validEvmAddress(value: string | undefined): value is string {
  return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0+$/.test(value));
}

export function getConfiguredVendorRoute(providerId: string): PaymentRoute | null {
  return getConfiguredVendorRoutes({ provider_id: providerId } as ProviderOffer)[0] ?? null;
}

function isPaymentRoute(value: unknown): value is PaymentRoute {
  if (!value || typeof value !== 'object') return false;
  const route = value as Partial<PaymentRoute>;
  return Boolean(route.chain_id?.trim() && route.chain_name?.trim() && route.token_symbol?.trim()
    && route.token_address?.trim() && route.recipient?.trim());
}

/** Vendor routes may come from a durable registry later; provider metadata is the current extension seam. */
export function getConfiguredVendorRoutes(provider: ProviderOffer): PaymentRoute[] {
  const declared = provider.metadata?.payment_routes;
  if (Array.isArray(declared)) {
    return declared.filter(isPaymentRoute).map(route => ({
      ...route,
      token_symbol: route.token_symbol.toUpperCase(),
      rail: route.rail || 'direct-token-transfer',
      verified: route.verified === true,
      priority: Number.isFinite(route.priority) ? route.priority : 0,
    })).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  const configuredVendorId = process.env.TREASURY_REAL_PROOF_VENDOR_ID?.trim() || 'real-proof-vendor';
  const recipient = process.env.TREASURY_REAL_PROOF_RECIPIENT?.trim();
  if (provider.provider_id !== configuredVendorId || !validEvmAddress(recipient)) return [];

  return [{ ...BSC_USDT_ROUTE, recipient }];
}

export interface PaymentRouteOption extends PaymentRoute {
  available: boolean;
  reason: string | null;
}

export function listPaymentRouteOptions(provider: ProviderOffer, policy?: Policy): PaymentRouteOption[] {
  return getConfiguredVendorRoutes(provider).map(route => {
    if (!route.verified) return { ...route, available: false, reason: 'Route has not been verified for real payment' };
    if (provider.currency.toUpperCase() !== route.token_symbol) return { ...route, available: false, reason: `Offer settles in ${provider.currency}` };
    const allowed = policy?.allowed_payment_routes;
    if (allowed?.length && !allowed.some(candidate => candidate.chain_id === route.chain_id
      && candidate.token_symbol.toUpperCase() === route.token_symbol
      && candidate.token_address.toLowerCase() === route.token_address.toLowerCase())) {
      return { ...route, available: false, reason: 'Route is blocked by policy' };
    }
    return { ...route, available: true, reason: null };
  });
}

export function routeFingerprint(purchaseId: string, route: PaymentRoute, amount: number): string {
  return [
    purchaseId,
    route.rail || 'direct-token-transfer',
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
  const options = listPaymentRouteOptions(provider, policy);
  if (!options.length) return { ok: false, reason: `No configured payment route for vendor: ${provider.provider_id}` };
  const chainMatches = options.filter(route => route.chain_id === configuredChainId);
  if (!chainMatches.length) return { ok: false, reason: `Unsupported chain: ${configuredChainId}; configured: ${options.map(route => `${route.chain_name} ${route.chain_id}`).join(', ')}` };
  const route = chainMatches.find(candidate => candidate.token_address.toLowerCase() === configuredToken.toLowerCase());
  if (!route) return { ok: false, reason: `Unsupported token on ${chainMatches[0].chain_name}; configured: ${chainMatches.map(item => item.token_symbol).join(', ')}` };
  if (!route.available) return { ok: false, reason: route.reason ?? 'Payment route unavailable' };
  if (policy?.allow_bridge_or_swap) {
    return { ok: false, reason: 'Bridge or swap must remain disabled for the MVP payment route' };
  }
  return { ok: true, route };
}
