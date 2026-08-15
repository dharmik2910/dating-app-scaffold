import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

let recaptchaVerifier: RecaptchaVerifier | null = null;
let initPromise: Promise<RecaptchaVerifier> | null = null;

export function clearRecaptcha(container?: HTMLElement | null) {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Already cleared or unmounted.
    }
    recaptchaVerifier = null;
  }
  initPromise = null;
  container?.replaceChildren();
}

async function createRecaptcha(container: HTMLElement) {
  clearRecaptcha(container);
  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, container, { size: 'invisible' });
  await recaptchaVerifier.render();
  return recaptchaVerifier;
}

export async function initRecaptcha(container: HTMLElement) {
  if (recaptchaVerifier) return recaptchaVerifier;
  if (initPromise) return initPromise;

  initPromise = createRecaptcha(container);
  try {
    return await initPromise;
  } catch (error) {
    clearRecaptcha(container);
    throw error;
  } finally {
    initPromise = null;
  }
}

export async function requestOtp(phoneNumber: string, container: HTMLElement) {
  const verifier = await initRecaptcha(container);
  try {
    return await signInWithPhoneNumber(firebaseAuth, phoneNumber, verifier);
  } catch (error) {
    clearRecaptcha(container);
    throw error;
  }
}
