/** Recorded-supplier decision, shared by the live client and the offline holdout.
 * A dated timeout may use one smaller catalog shortlist. A successful empty
 * result, an undated timeout, and an HTTP or provider error must not. */
export type SupplierAttempt<T> =
  | { status: "products"; products: T[] }
  | { status: "timeout"; dated: boolean }
  | { status: "empty" }
  | { status: "error" };

export function recoverSupplierSearch<T extends { catalogOnly?: true }>(
  primary: SupplierAttempt<T>,
  catalog: SupplierAttempt<T> | null = null,
): { products: T[]; usedCatalogFallback: boolean } {
  if (primary.status === "products")
    return { products: primary.products, usedCatalogFallback: false };
  if (primary.status !== "timeout" || !primary.dated || !catalog)
    return { products: [], usedCatalogFallback: false };
  if (catalog.status !== "products")
    return { products: [], usedCatalogFallback: false };
  return {
    products: catalog.products.map((product) => ({
      ...product,
      catalogOnly: true as const,
    })),
    usedCatalogFallback: true,
  };
}
