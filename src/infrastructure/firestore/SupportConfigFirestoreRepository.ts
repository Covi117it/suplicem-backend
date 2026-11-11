import { firestore } from "../../config/firebase";
import { SupportConfig } from "../../domain/entities/SupportConfig";
import { SupportConfigRepository } from "../../domain/repositories/SupportConfigRepository";

const COLLECTION = "system_config";
const DOC_ID = "support";

const DEFAULT_CONFIG: SupportConfig = {
  whatsapp: "18095550199",
  whatsappMessage: "Hola, necesito asistencia con el sistema Suplicem",
  phone: "(809) 555-0199",
  email: "soporte@suplicem.com",
  scheduleWeekday: "8:00 AM - 6:00 PM",
  scheduleSaturday: "8:00 AM - 1:00 PM",
  scheduleSunday: "Guardias de contingencia",
};

export class SupportConfigFirestoreRepository implements SupportConfigRepository {
  async get(): Promise<SupportConfig> {
    try {
      const doc = await firestore.collection(COLLECTION).doc(DOC_ID).get();
      if (!doc.exists) {
        return DEFAULT_CONFIG;
      }
      return {
        ...DEFAULT_CONFIG,
        ...(doc.data() as Partial<SupportConfig>),
      };
    } catch (error: any) {
      console.warn("[SupportConfig] Error al obtener config:", error?.message || error);
      return DEFAULT_CONFIG;
    }
  }

  async update(data: SupportConfig): Promise<void> {
    try {
      await firestore.collection(COLLECTION).doc(DOC_ID).set(data, { merge: true });
    } catch (error: any) {
      console.error("[SupportConfig] Error al actualizar config:", error?.message || error);
      throw new Error("No se pudo actualizar la configuración de soporte");
    }
  }
}
