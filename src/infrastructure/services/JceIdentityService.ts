import axios from "axios";
import {
  IdentityLookupResult,
  IdentityLookupService,
} from "../../domain/services/IdentityLookupService";

/**
 * Adaptador para la consulta de cédulas en la Junta Central Electoral.
 * El contrato exacto del proveedor se configura por variables de entorno
 * (JCE_API_URL y JCE_API_TOKEN) y se normaliza la respuesta aquí.
 */
export class JceIdentityService implements IdentityLookupService {
  async lookupCedula(cedula: string): Promise<IdentityLookupResult | null> {
    const baseUrl = process.env.JCE_API_URL || "";
    const token = process.env.JCE_API_TOKEN || "";

    if (!baseUrl) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("El servicio de consulta de cédulas no está configurado.");
      }
      return null;
    }

    try {
      const response = await axios.get<any>(baseUrl, {
        params: { cedula },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 8000,
      });

      const data = response.data?.data || response.data;
      if (!data) return null;

      const names =
        data.nombres || data.names || data.firstName || data.nombre || "";
      const lastNames =
        data.apellidos || data.lastNames || data.lastName || data.apellido || "";
      const fullName = data.nombreCompleto || data.fullName || undefined;

      if (!names && !fullName) return null;

      return {
        cedula,
        names: String(names || "").trim(),
        lastNames: String(lastNames || "").trim(),
        fullName: fullName ? String(fullName).trim() : undefined,
      };
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw new Error(
        error?.response?.data?.message ||
          "No se pudo consultar la cédula en la JCE."
      );
    }
  }
}
