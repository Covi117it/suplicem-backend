export interface AuthService {
  login(
    email: string,
    password: string
  ): Promise<{
    idToken: string;
    refreshToken: string;
    expiresIn: string;
    email: string;
    uid: string;
  }>;
  refreshIdToken(refreshToken: string): Promise<{
    token: string;
    refreshToken: string;
    expiresIn: string;
    uid: string;
  }>;
  registerWithEmailAndPassword(
    email: string,
    password: string,
    displayName: string
  ): Promise<{ uid: string; email: string }>;
  sendVerificationEmail(idToken: string): Promise<void>;
  sendPasswordResetEmail(email: string): Promise<void>;
  getUserByUid(uid: string): Promise<{ emailVerified: boolean }>;
  sendPushNotification(token: string, title: string, body: string): Promise<void>;
  deleteUser(uid: string): Promise<void>;
}
