import { User } from "../../../domain/entities/User";
import { isValidDominicanCedula, isValidPassport } from "../../../domain/services/IdentityVerificationService";
import { isValidRnc, normalizeTaxId } from "../../../domain/services/TaxIdService";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { AuthService } from "../../../domain/services/AuthService";
import { RegistrationBotService } from "../../../infrastructure/services/RegistrationBotService";
import { SynthIDDetectorService } from "../../../infrastructure/services/SynthIDDetectorService";
import { ApplicationActor, CreateUserDto } from "../../dtos/UserDtos";
import { uploadIdentificationImage, deleteStorageFile } from "../../../domain/services/ImageStorageService";
import { NotificationDispatcherService } from "../../services/NotificationDispatcherService";

export class CreateUserUseCase {
  private botService = new RegistrationBotService();
  private synthIDDetector = new SynthIDDetectorService();

  constructor(
    private userRepo: UserRepository,
    private authService: AuthService,
    private notificationDispatcher?: NotificationDispatcherService
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
    const identificationType = parsedData?.identificationType || parsedData?.data?.identificationType || "Cedula";
    const rawIdentification = (parsedData?.identification || parsedData?.data?.identification || "").toString().trim();
    const identification = identificationType === "Cedula"
      ? rawIdentification.replace(/[^0-9]/g, "")
      : rawIdentification;
    const phone = (parsedData?.phone || parsedData?.data?.phone || "").toString().trim();
    const rawCompanyRnc = (parsedData?.companyRnc || parsedData?.data?.companyRnc || "").toString().trim();
    const companyRnc = rawCompanyRnc ? normalizeTaxId(rawCompanyRnc) : "";
    const companyName = (parsedData?.companyName || parsedData?.data?.companyName || "").toString().trim();
    // 🔒 Control estricto de escalada de privilegios
    const isAuthorizedAdmin = requester?.userType === "admin" && requester?.status === "active";
    const isAuthorizedSeller = requester?.userType === "seller" && requester?.status === "active";
    if (requestedUserType === "admin" && !isAuthorizedAdmin) {
      throw new Error("Acceso denegado: solo un administrador activo puede crear cuentas con rol admin.");
    }
    if (requestedUserType === "seller" && !isAuthorizedAdmin) {
      throw new Error("Acceso denegado: solo un administrador activo puede crear cuentas con rol seller.");
    }
    const isJuridica = parsedData?.personType === "juridica" || !!companyRnc;
    if (isJuridica && requestedUserType === "driver") {
      throw new Error("Las empresas no pueden registrarse con el rol de conductor.");
    }
    const userType = isAuthorizedAdmin
      ? requestedUserType
      : isJuridica
      ? "client"
      : requestedUserType === "driver" && !isAuthorizedSeller
      ? "driver"
      : "client";

    const effectiveCompanyName = companyName || (isJuridica ? names : "");
    const effectiveCompanyRnc = companyRnc || (isJuridica ? identification : "");
    const effectiveNames = names || effectiveCompanyName;
    const effectiveLastNames = lastNames;
    const effectiveIdentificationType = isJuridica && identificationType !== "Pasaporte"
      ? "RNC"
      : (identificationType as "Cedula" | "Pasaporte" | "RNC");
    const effectiveIdentification = effectiveIdentificationType === "RNC"
      ? (effectiveCompanyRnc || identification)
      : identification;

    if (effectiveCompanyRnc || effectiveIdentificationType === "RNC") {
      const targetRnc = effectiveCompanyRnc || effectiveIdentification;
      if (!isValidRnc(targetRnc)) {
        throw new Error("El RNC de la empresa no es válido (debe tener 9 u 11 dígitos).");
      }
      if (!effectiveCompanyName) {
        throw new Error("El nombre o razón social de la empresa es obligatorio al registrar con RNC.");
      }
    }
    const status = isAuthorizedAdmin || isAuthorizedSeller
      ? (parsedData.status || "active")
      : "pending";
    if (effectiveIdentificationType === "Cedula") {
      if (!isValidDominicanCedula(effectiveIdentification)) {
        throw new Error("El número de cédula dominicana ingresado no es válido.");
      }
    } else if (effectiveIdentificationType === "Pasaporte") {
      if (!isValidPassport(effectiveIdentification)) {
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

    // Si la cuenta la creó un Administrador o Vendedor autorizado, marcar emailVerified: true inmediatamente
    if ((isAuthorizedAdmin || isAuthorizedSeller) && this.authService.markEmailAsVerified) {
      await this.authService.markEmailAsVerified(uid);
    }

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
        identificationType: effectiveIdentificationType,
        identification: effectiveIdentification,
        email,
        names: effectiveNames,
        lastNames: effectiveLastNames,
        phone,
        userType,
        personType: isJuridica ? "juridica" : "fisica",
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
      if (parsedVehicle && userType === "driver") {
        userToSave.vehicle = parsedVehicle;
      }
      if (userType === "driver") {
        userToSave.driverCode = `COND-${uid.slice(0, 5).toUpperCase()}`;
      }
      if (effectiveCompanyRnc || isJuridica) {
        userToSave.companyRnc = effectiveCompanyRnc;
        userToSave.companyName = effectiveCompanyName;
      }
      if (isAuthorizedSeller && userType === "client") {
        userToSave.sellerId = requester!.uid;
      } else if (isAuthorizedAdmin && parsedData.sellerId) {
        userToSave.sellerId = parsedData.sellerId;
      }

      // 3. Guardar en Firestore
      await this.userRepo.create(userToSave);

      if (this.notificationDispatcher && isAuthorizedAdmin && userType === "client" && userToSave.sellerId) {
        const clientName =
          userToSave.companyName ||
          `${userToSave.names || ""} ${userToSave.lastNames || ""}`.trim() ||
          "Cliente";

        this.userRepo
          .getById(requester!.uid)
          .then((admin) => {
            const adminName = admin
              ? `${admin.names || ""} ${admin.lastNames || ""}`.trim() || "Administración"
              : "Administración";

            return this.notificationDispatcher!.notifyClientAssigned({
              sellerId: userToSave.sellerId,
              adminName,
              clientName,
            });
          })
          .catch((err) =>
            console.warn("[Notification] Error al notificar cliente creado y asignado:", err?.message || err)
          );
      }

      // 4. Despachar correo de bienvenida en segundo plano
      if (isAuthorizedAdmin) {
        this.botService
          .sendAdminCreatedAccountEmailBot(email, names, lastNames, userType, identification)
          .catch((e: any) => console.warn("Aviso Admin Welcome Bot Email:", e?.message));
      } else {
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
      }

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
