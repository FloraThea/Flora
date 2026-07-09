/**
 * Ordres imposés par les méthodes pédagogiques.
 * Utilisé uniquement pour réordonner les modules issus de la programmation.
 */
export const METHOD_MODULE_ORDERS: Record<string, string[]> = {
  MHM: [
    "module 1",
    "module 2",
    "module 3",
    "module 4",
    "module 5",
    "module 6",
    "module 7",
    "module 8",
    "module 9",
    "module 10",
  ],
  Narramus: ["séquence 1", "séquence 2", "séquence 3", "séquence 4", "séquence 5"],
  "ACCÈS": ["période 1", "période 2", "période 3", "période 4", "période 5"],
  "Cap Maths": ["période 1", "période 2", "période 3", "période 4", "période 5"],
  "Méthode Piano": ["étape 1", "étape 2", "étape 3", "étape 4", "étape 5"],
};

export function normalizeMethodKey(methode: string): string {
  return methode.trim();
}

export function sortModulesByMethod(modules: string[], methode: string): string[] {
  const order = METHOD_MODULE_ORDERS[normalizeMethodKey(methode)];
  if (!order || modules.length === 0) return modules;

  return [...modules].sort((left, right) => {
    const leftIndex = order.findIndex((item) =>
      left.toLowerCase().includes(item.toLowerCase()),
    );
    const rightIndex = order.findIndex((item) =>
      right.toLowerCase().includes(item.toLowerCase()),
    );

    const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return safeLeft - safeRight;
  });
}
