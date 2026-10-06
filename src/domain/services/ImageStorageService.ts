import { v4 as uuid } from "uuid";
import { storage } from "../../config/firebase";

export const uploadDeliveryImage = async (
  file: Express.Multer.File,
  orderId: string,
  index: number
): Promise<string> => {
  try {
    const bucket = storage.bucket();
    const fileName = `orders/${orderId}/delivery_${index}_${Date.now()}.jpg`;
    const fileRef = bucket.file(fileName);
    const downloadToken = uuid();

    await fileRef.save(file.buffer, {
      contentType: file.mimetype || "image/jpeg",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;
  } catch (error: any) {
    console.error("Error en Firebase Storage uploadDeliveryImage:", error);
    throw new Error("No se pudo almacenar la evidencia fotográfica de la entrega en Storage.");
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
    const downloadToken = uuid();

    await fileRef.save(file.buffer, {
      contentType: file.mimetype || "image/jpeg",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;
    return { url, filePath };
  } catch (error: any) {
    console.error("Error en Firebase Storage uploadIdentificationImage:", error);
    throw new Error("No se pudo almacenar el documento de identidad en Storage.");
  }
};

export const deleteStorageFile = async (filePathOrUrl: string): Promise<void> => {
  try {
    const bucket = storage.bucket();
    let filePath = filePathOrUrl;

    if (filePath.startsWith("http")) {
      const gcsPrefix = `https://storage.googleapis.com/${bucket.name}/`;
      const fbPrefix = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/`;

      if (filePath.startsWith(gcsPrefix)) {
        filePath = filePath.replace(gcsPrefix, "").split("?")[0];
      } else if (filePath.startsWith(fbPrefix)) {
        const rawPath = filePath.replace(fbPrefix, "").split("?")[0];
        filePath = decodeURIComponent(rawPath);
      } else {
        return;
      }
    }

    const fileRef = bucket.file(filePath);
    const [exists] = await fileRef.exists();
    if (exists) {
      await fileRef.delete();
    }
  } catch (error: any) {
    console.warn("Advertencia al eliminar archivo de Storage:", error?.message);
  }
};

export const uploadReceiptImage = async (
  file: Express.Multer.File,
  userId: string
): Promise<string> => {
  try {
    const bucket = storage.bucket();
    const ext = (file.mimetype && file.mimetype.split("/")[1]) || "jpg";
    const fileName = `receipts/${userId}/comprobante_${Date.now()}.${ext}`;
    const fileRef = bucket.file(fileName);
    const downloadToken = uuid();

    await fileRef.save(file.buffer, {
      contentType: file.mimetype || "image/jpeg",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${downloadToken}`;
  } catch (error: any) {
    console.error("Error en Firebase Storage uploadReceiptImage:", error);
    throw new Error("No se pudo almacenar el comprobante de pago en Storage.");
  }
};

export const uploadProductImage = async (
  file: Express.Multer.File
): Promise<string> => {
  try {
    const bucket = storage.bucket();
    const ext = (file.mimetype && file.mimetype.split("/")[1]) || "jpg";
    const fileName = `products/prod_${Date.now()}.${ext}`;
    const fileRef = bucket.file(fileName);
    const downloadToken = uuid();

    await fileRef.save(file.buffer, {
      contentType: file.mimetype || "image/jpeg",
      public: true, // El catálogo de productos sí puede ser de lectura pública
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    });
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (error: any) {
    console.warn("Advertencia en Firebase Storage uploadProductImage:", error?.message || error);
    throw error;
  }
};