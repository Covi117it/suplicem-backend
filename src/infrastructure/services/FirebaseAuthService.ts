import { auth } from "../../config/firebase";
import axios from "axios";
import { AuthService } from "../../domain/services/AuthService";
import {
  FirebaseLoginResponseDto,
  FirebaseRefreshTokenResponseDto,
} from "../../application/dtos/FirebaseDtos";

const getGoogleApiUrl = () => process.env.GOOGLE_API_URL || "https://identitytoolkit.googleapis.com/v1";
const getSecureTokenGoogleApiUrl = () => process.env.SECURE_TOKEN_GOOGLE_API_URL || "https://securetoken.googleapis.com/v1";
const getFirebaseApiKey = () => process.env.FIREBASE_API_KEY || "";

export class FirebaseAuthService implements AuthService {
  async login(email: string, password: string) {
    const response = await axios.post<FirebaseLoginResponseDto>(
      `${getGoogleApiUrl()}/accounts:signInWithPassword?key=${getFirebaseApiKey()}`,
      {
        email,
        password,
        returnSecureToken: true,
      }
    );

    return {
      idToken: response.data.idToken,
      refreshToken: response.data.refreshToken,
      expiresIn: response.data.expiresIn,
      email: response.data.email,
      uid: response.data.localId,
    };
  }

  async refreshIdToken(refreshToken: string) {
    const response = await axios.post<FirebaseRefreshTokenResponseDto>(
      `${getSecureTokenGoogleApiUrl()}/token?key=${getFirebaseApiKey()}`,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return {
      token: response.data.id_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      uid: response.data.user_id,
    };
  }

  async registerWithEmailAndPassword(
    email: string,
    password: string,
    displayName: string
  ) {
    try {
      const response = await axios.post<any>(
        `${getGoogleApiUrl()}/accounts:signUp?key=${getFirebaseApiKey()}`,
        {
          email: email.toLowerCase(),
          password,
          displayName,
          returnSecureToken: true,
        }
      );

      return {
        uid: response.data.localId,
        email: response.data.email,
        idToken: response.data.idToken,
        refreshToken: response.data.refreshToken,
        expiresIn: response.data.expiresIn,
      };
    } catch (error: any) {
      console.warn("REST signup error:", error?.response?.data || error?.message);
      let errorMsg =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Error al registrar usuario en Auth";

      if (errorMsg.includes("EMAIL_EXISTS")) {
        errorMsg = "The email address is already in use by another account.";
      }
      throw new Error(errorMsg);
    }
  }

  async sendVerificationEmail(idToken: string) {
    await axios.post(
      `${getGoogleApiUrl()}/accounts:sendOobCode?key=${getFirebaseApiKey()}`,
      {
        requestType: "VERIFY_EMAIL",
        idToken,
      }
    );
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await axios.post(
      `${getGoogleApiUrl()}/accounts:sendOobCode?key=${getFirebaseApiKey()}`,
      {
        requestType: "PASSWORD_RESET",
        email,
      }
    );
  }

  async getUserByUid(uid: string) {
    const userRecord = await auth.getUser(uid);
    return { emailVerified: userRecord.emailVerified };
  }

  async sendPushNotification(token: string, title: string, body: string): Promise<void>  {
    await axios.post(
      "https://fcm.googleapis.com/fcm/send",
      {
        to: token,
        notification: {
          title,
          body,
          sound: "default",
        },
        data: {
          someData: "value",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=TU_SERVER_KEY_FCM`,
        },
      }
    );
  }

  async deleteUser(uid: string): Promise<void> {
    try {
      await auth.deleteUser(uid);
    } catch (error: any) {
      console.warn("Advertencia al eliminar usuario de Auth:", error?.message);
    }
  }
}
