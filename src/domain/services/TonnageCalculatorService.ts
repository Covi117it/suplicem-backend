export interface TonnageItemInput {
  name?: string;
  unit?: string;
  quantity: number;
  weightKg?: number;
}

export class TonnageCalculatorService {
  /**
   * Factores oficiales Suplicem:
   * - Cemento Gris: 42.5 kg (0.0425 t)
   * - Cemento Blanco / Especial: 40.0 kg (0.0400 t)
   * - Arena en funda: 40.0 kg (0.0400 t)
   * - 1 m³ de agregado/arena: 1.40 t
   * - 1 quintal de varilla: 45.36 kg (0.04536 t)
   */
  calculateItemTons(item: TonnageItemInput): number {
    const count = Number(item.quantity) || 0;
    const itemName = (item.name || "").toLowerCase();
    const isCement = item.unit === "fundas" || !item.unit || itemName.includes("cemento");

    let factorInTons = 0.0425;

    if (item.weightKg && item.weightKg > 0) {
      factorInTons = item.weightKg / 1000;
    } else if (item.unit === "metro_cubico" || itemName.includes("metro")) {
      factorInTons = 1.4;
    } else if (item.unit === "quintal" || itemName.includes("quintal")) {
      factorInTons = 0.04536;
    } else if (item.unit === "tonelada" || item.unit === "toneladas") {
      factorInTons = 1.0;
    } else if (isCement) {
      const isSpecial =
        itemName.includes("blanco") ||
        itemName.includes("especial") ||
        itemName.includes("estructural") ||
        itemName.includes("40kg") ||
        itemName.includes("40 kg");
      factorInTons = isSpecial ? 0.0400 : 0.0425;
    } else if (item.unit === "fundas" || itemName.includes("arena")) {
      factorInTons = 0.0400;
    }

    return Number((count * factorInTons).toFixed(2));
  }

  calculateTotalTons(items: TonnageItemInput[]): number {
    const total = items.reduce((acc, item) => acc + this.calculateItemTons(item), 0);
    return Number(total.toFixed(2));
  }
}
