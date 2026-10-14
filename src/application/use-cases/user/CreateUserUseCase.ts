import { User } from "../../../domain/entities/User";
import { isValidDominicanCedula, isValidPassport } from "../../../domain/services/IdentityVerificationService";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { AuthService } from "../../../domain/services/AuthService";
import { RegistrationBotService } from "../../../infrastructure/services/RegistrationBotService";
import { SynthIDDetectorService } from "../../../infrastructure/services/SynthIDDetectorService";
import { ApplicationActor, CreateUserDto } from "../../dtos/UserDtos";
import { uploadIdentificationImage, deleteStorageFile } from "../../../domain/services/ImageStorageService";

export class CreateUserUseCase {
  private botService = new RegistrationBotService();
  private synthIDDetector = new SynthIDDetectorService();

  constructor(
    private userRepo: UserRepository,
    private authService: AuthService
  ) {}

 async execute(data: CreateUserDto, file?: Express.Multer.File,  requester?: ApplicationActor): Promise<any> {
    if (!data) {
      throw new Error("Datos de registro no recibidos.");
    }

    let parsedData: any = data || {};
    if (typeof parsedData === "string") {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (e) {}
    }

    if (parsedData && parsedData.data) {
      if (typeof parsedData.data === "string") {
        try {
          const parsed = JSON.parse(parsedData.data);
          parsedData = { ...parsed, ...parsedData };
        } catch (e) {}
      } else if (typeof parsedData.data === "object") {
        parsedData = { ...parsedData.data, ...parsedData };
      }
    }

    const email = (parsedData?.email || parsedData?.data?.email || "").toString().trim();
    const password = (parsedData?.password || parsedData?.data?.password || "").toString();
    const names = (parsedData?.names || parsedData?.data?.names || "").toString().trim();
    const lastNames = (parsedData?.lastNames || parsedData?.data?.lastNames || "").toString().trim();
    const requestedUserType = parsedData?.userType || parsedData?.data?.userType || "client";
    const identification = (parsedData?.identification || parsedData?.data?.identification || "").toString().trim();
    const identificationType = parsedData?.identificationType || parsedData?.data?.identificationType || "Cedula";
    const phone = (parsedData?.phone || parsedData?.data?.phone || "").toString().trim();
    // 🔒 Control estricto de escalada de privilegios
    const isAuthorizedAdmin = requester?.userType === "admin" && requester?.status === "active";
    if (requestedUserType === "admin" && !isAuthorizedAdmin) {
      throw new Error("Acceso denegado: solo un administrador activo puede crear cuentas con rol admin.");
    }
    const userType = isAuthorizedAdmin
      ? requestedUserType
      : requestedUserType === "driver"
      ? "driver"
      : "client";
    const status = isAuthorizedAdmin
      ? (parsedData.status || "active")
      : "pending";
    if (identificationType === "Cedula") {
      if (!isValidDominicanCedula(identification)) {
        throw new Error("El número de cédula dominicana ingresado no es válido.");
      }
    } else if (identificationType === "Pasaporte") {
      if (!isValidPassport(identification)) {
        throw new Error("El formato del pasaporte no es válido (debe tener entre 6 y 12 caracteres alfanuméricos).");
      }
    }

    // 1. Crear usuario en Firebase Auth primero
    const authResult = await this.authService.registerWithEmailAndPassword(
      email,
      password,
      `${names || ""} ${lastNames || ""}`.trim()
    );
    const { uid, idToken, refreshToken, expiresIn } = authResult as any;

    let uploadedStorageFilePath: string | null = null;
    let identificationImageUrl: string | null = null;

    try {
      // 2. Si viene un archivo subido con Multer, subirlo a Firebase Storage en id_documents/{uid}/
      if (file) {
        const uploadResult = await uploadIdentificationImage(file, uid);
        identificationImageUrl = uploadResult.url;
        uploadedStorageFilePath = uploadResult.filePath;
      } else if (parsedData.identificationImage || parsedData.data?.identificationImage) {
        identificationImageUrl = parsedData.identificationImage || parsedData.data?.identificationImage;
      }

      // Analizar la foto de la identificación con el filtro SynthID
      let aiRiskFlag = false;
      let aiRiskScore = 0;
      let aiRiskReason = "";

      if (identificationImageUrl) {
        const analysis = await this.synthIDDetector.analyzeImage(identificationImageUrl);
        aiRiskFlag = analysis.isAIGenerated;
        aiRiskScore = analysis.riskScore;
        aiRiskReason = analysis.reason;
      }

      // Parsear objetos que puedan llegar como string en multipart/form-data
      let parsedAddresses = parsedData.addresses || parsedData.data?.addresses;
      if (typeof parsedAddresses === "string") {
        try { parsedAddresses = JSON.parse(parsedAddresses); } catch (e) {}
      }

      let parsedVehicle = parsedData.vehicle || parsedData.data?.vehicle;
      if (typeof parsedVehicle === "string") {
        try { parsedVehicle = JSON.parse(parsedVehicle); } catch (e) {}
      }

      // Guardar en Firestore con estado "pending" para aprobación del Administrador
      const userToSave: User = {
        uid,
        identificationType,
        identification,
        email,
        names,
        lastNames,
        phone,
        userType,
        createdAt: new Date().toISOString(),
        status,
        aiRiskFlag,
        aiRiskScore,
      };

      if (identificationImageUrl) {
        userToSave.identificationImage = identificationImageUrl;
      }
      if (aiRiskFlag && aiRiskReason) {
        userToSave.aiRiskReason = aiRiskReason;
      }
      if (parsedAddresses && Array.isArray(parsedAddresses) && parsedAddresses.length > 0) {
        userToSave.addresses = parsedAddresses;
      }
      if (parsedVehicle) {
        userToSave.vehicle = parsedVehicle;
      }

      // 3. Guardar en Firestore
      await this.userRepo.create(userToSave);

      // 4. Despachar correo de bienvenida con botón de verificación en segundo plano
      this.authService
        .generateEmailVerificationLink(email)
        .then((verificationLink: string) =>
          this.botService.sendWelcomeEmailBot(
            email,
            names,
            lastNames,
            userType,
            identification,
            verificationLink
          )
        )
        .catch((err: any) => {
          console.warn(
            "Aviso al generar enlace de verificación, enviando bienvenida básica:",
            err?.message
          );
          this.botService
            .sendWelcomeEmailBot(email, names, lastNames, userType, identification)
            .catch((e: any) => console.warn("Aviso Welcome Bot Email:", e?.message));
        });

      return {
        user: userToSave,
        idToken,
        refreshToken,
        expiresIn,
      };
    } catch (error: any) {
      // SI FALLA LA CREACIÓN EN FIRESTORE O CUALQUIER PASO:
      // Eliminar el archivo recién subido a Storage para no dejar archivos huérfanos
      if (uploadedStorageFilePath) {
        await deleteStorageFile(uploadedStorageFilePath);
      }
      // Eliminar el usuario recién creado en Firebase Auth
      await this.authService.deleteUser(uid);
      throw error;
    }
  }
}
