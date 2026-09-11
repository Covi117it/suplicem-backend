import { User } from "../../../domain/entities/User";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { AuthService } from "../../../domain/services/AuthService";
import { RegistrationBotService } from "../../../infrastructure/services/RegistrationBotService";
import { SynthIDDetectorService } from "../../../infrastructure/services/SynthIDDetectorService";
import { CreateUserDto } from "../../dtos/UserDtos";

export class CreateUserUseCase {
  private botService = new RegistrationBotService();
  private synthIDDetector = new SynthIDDetectorService();

  constructor(
    private userRepo: UserRepository,
    private authService: AuthService
  ) {}

  async execute(data: CreateUserDto): Promise<void> {
    const { email, password, names, lastNames, userType, identification, identificationImage } = data;

    // Analizar la foto de la identificación con el filtro SynthID
    let aiRiskFlag = false;
    let aiRiskScore = 0;
    let aiRiskReason = "";

    if (identificationImage) {
      const analysis = await this.synthIDDetector.analyzeImage(identificationImage);
      aiRiskFlag = analysis.isAIGenerated;
      aiRiskScore = analysis.riskScore;
      aiRiskReason = analysis.reason;
    }

    // Crear usuario en Firebase Auth
    const { uid } = await this.authService.registerWithEmailAndPassword(
      email,
      password,
      `${names} ${lastNames}`
    );

    // Guardar en Firestore con estado "pending" para aprobación del Administrador
    const userToSave: User = {
      uid,
      identificationType: data.identificationType || "Cedula",
      identification: data.identification || "",
      email: data.email,
      names: data.names,
      lastNames: data.lastNames,
      phone: data.phone,
      userType: data.userType || "client",
      createdAt: new Date().toISOString(),
      status: "pending",
      aiRiskFlag,
      aiRiskScore,
    };

    if (data.identificationImage) {
      userToSave.identificationImage = data.identificationImage;
    }
    if (aiRiskFlag && aiRiskReason) {
      userToSave.aiRiskReason = aiRiskReason;
    }
    if (data.addresses && data.addresses.length > 0) {
      userToSave.addresses = data.addresses;
    }
    if (data.vehicle) {
      userToSave.vehicle = data.vehicle;
    }

    // 1. Guardar en la base de datos de Firestore PRIMERO
    await this.userRepo.create(userToSave);

    // 2. Despachar correos en segundo plano de forma totalmente asíncrona y no bloqueante
    Promise.all([
      this.authService
        .login(email, password)
        .then(({ idToken }) => this.authService.sendVerificationEmail(idToken))
        .catch((err) => console.warn("Aviso Firebase Verification Email:", err?.message)),
      this.botService
        .sendWelcomeEmailBot(email, names, lastNames, userType, identification)
        .catch((err) => console.warn("Aviso Welcome Bot Email:", err?.message)),
    ]).catch((err) => console.warn("Error en tareas secundarias:", err?.message));
  }
}
