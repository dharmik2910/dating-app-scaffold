import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

// Handles verification of Firebase ID tokens issued after phone/OTP sign-in
// on the client (Firebase Auth's PhoneAuthProvider). Firebase manages sending
// and verifying the actual SMS OTP; this service just validates the resulting token.
@Injectable()
export class FirebaseService implements OnModuleInit {
  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.config.get('FIREBASE_PROJECT_ID'),
          clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.config.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async verifyIdToken(idToken: string) {
    // Returns decoded token with `phone_number` and `uid` on success; throws otherwise.
    return admin.auth().verifyIdToken(idToken);
  }
}
