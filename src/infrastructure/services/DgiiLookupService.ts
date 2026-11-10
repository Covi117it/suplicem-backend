import axios from "axios";
import {
  RncLookupResult,
  RncLookupService,
} from "../../domain/services/IdentityLookupService";

/**
 * Adaptador para consulta de RNC en la DGII mediante la API de Directorio RNC.
 * Se puede sobreescribir la URL base mediante la variable de entorno DGII_API_URL.
 */
export class DgiiLookupService implements RncLookupService {
  async lookupRnc(rnc: string): Promise<RncLookupResult | null> {
    const baseUrl =
      process.env.DGII_API_URL || "https://api.directoriornc.com/api/DGII";

    try {
      const response = await axios.get<any>(`${baseUrl}/${rnc}`, {
        timeout: 8000,
        headers: { Accept: "application/json" },
      });

      const data = response.data;
      if (!data) return null;

      // Si la API responde con texto plano o formato de "No se encontró"
      if (
        typeof data === "string" &&
        data.toLowerCase().includes("no se encontr")
      ) {
        return null;
      }

      const name = data.nombreCompleto || data.name || data.rncName || "";
      if (!name) return null;

      return {
        rnc: String(data.rnc || rnc).trim(),
        name: String(name).trim(),
        commercialName: data.nombreComercial
          ? String(data.nombreComercial).trim()
          : undefined,
        status: String(data.estado || "ACTIVO").trim().toUpperCase(),
        activity: data.actividad ? String(data.actividad).trim() : undefined,
        category: data.categoria ? String(data.categoria).trim() : undefined,
      };
    } catch (error: any) {
      if (error?.response?.status === 404) return null;

      // Si falla la red en modo desarrollo local, proveer fallback simulado
      if (process.env.NODE_ENV !== "production") {
        return {
          rnc,
          name: "CONSTRUCTORA E INGENIERÍA DOMINICANA SRL",
          commercialName: "CONSTRUCTORA DOMINICANA",
          status: "ACTIVO",
          activity: "CONSTRUCCIÓN Y SUMINISTROS",
          category: "SOCIEDAD COMERCIAL",
        };
      }

      throw new Error(
        error?.response?.data?.message ||
          "No se pudo consultar el RNC en el servicio de la DGII."
      );
    }
  }
}
