/** Routes et outils réservés au développement local — jamais exposés en production. */
export function isDevOnlyRouteEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** @deprecated Utiliser isDevOnlyRouteEnabled */
export function isAdministrationEnabled(): boolean {
  return isDevOnlyRouteEnabled();
}
