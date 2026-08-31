import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function clearRecaptcha() {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Ignored
    }
    recaptchaVerifier = null;
  }
}

export async function requestMobileOtp(phoneNumber: string, containerOrId?: any): Promise<ConfirmationResult | null> {
  try {
    if (typeof window !== 'undefined' && containerOrId) {
      clearRecaptcha();
      recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerOrId, { size: 'invisible' });
      await recaptchaVerifier.render();
      return await signInWithPhoneNumber(firebaseAuth, phoneNumber, recaptchaVerifier);
    }
    return null;
  } catch (error) {
    clearRecaptcha();
    console.warn('Firebase phone auth error (using fallback verification):', error);
    return null;
  }
}
