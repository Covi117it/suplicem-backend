import { v4 as uuid } from "uuid";
import { storage } from "../../config/firebase";

export const uploadDeliveryImage = async (file: Express.Multer.File, orderId: string, index: number): Promise<string> => {
  try {
    const bucket = storage.bucket();
    const fileName = `orders/${orderId}/delivery_${index}_${Date.now()}.jpg`;
    const fileRef = bucket.file(fileName);

    await fileRef.save(file.buffer, {
      contentType: file.mimetype,
      public: true,
      metadata: {
        firebaseStorageDownloadTokens: uuid(),
      },
    });

    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (error: any) {
    console.warn("Advertencia en Firebase Storage uploadDeliveryImage:", error?.message || error, "- utilizando fallback base64");
    const mime = file.mimetype || "image/jpeg";
    const base64 = file.buffer.toString("base64");
    return `data:${mime};base64,${base64}`;
  }
};

export const uploadIdentificationImage = async (
  file: Express.Multer.File,
  userId: string
): Promise<{ url: string; filePath: string }> => {
  const ext = (file.mimetype && file.mimetype.split("/")[1]) || "jpg";
  const filePath = `id_documents/${userId}/cedula_${Date.now()}.${ext}`;

  try {
    const bucket = storage.bucket();
    const fileRef = bucket.file(filePath);

    await fileRef.save(file.buffer, {
      contentType: file.mimetype || "image/jpeg",
      public: true,
      metadata: {
        firebaseStorageDownloadTokens: uuid(),
      },
    });

    const url = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    return { url, filePath };
  } catch (error: any) {
    console.warn("Advertencia en Firebase Storage uploadIdentificationImage:", error?.message || error, "- utilizando fallback base64");
    const mime = file.mimetype || "image/jpeg";
    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${mime};base64,${base64}`;
    return { url: dataUrl, filePath };
  }
};

export const deleteStorageFile = async (filePath: string): Promise<void> => {
  try {
    const bucket = storage.bucket();
    const fileRef = bucket.file(filePath);
    await fileRef.delete();
  } catch (error: any) {
    console.warn("Advertencia al eliminar archivo de Storage:", error?.message);
  }
};
