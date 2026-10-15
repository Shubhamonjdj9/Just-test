export function serializeVariantSelection(variants, selections) {
  if (!variants.length) return "";
  if (variants.some((variant) => !selections[variant.name])) return "";
  return JSON.stringify(
    Object.fromEntries(variants.map(({ name }) => [name, selections[name]])),
  );
}

export function formatVariant(value) {
  if (!value) return "";
  try {
    const selection = JSON.parse(value);
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) return value;
    return Object.entries(selection)
      .map(([name, option]) => `${name}: ${option}`)
      .join(" · ");
  } catch {
    return value;
  }
}
