import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Request } from "express";
import { PrismaService } from "./prisma.service";

export type FirebaseRequestUser = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

const devBypassEnabled = () => process.env.DEV_AUTH_BYPASS === "true";

const getFirebaseAuth = () => {
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey
      })
    });
  }

  return getAuth();
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: FirebaseRequestUser }>();
    const header = request.headers.authorization;

    if (devBypassEnabled() && request.headers["x-dev-auth"] === "true") {
      const headerEmail = request.headers["x-dev-auth-email"];
      const devEmail =
        typeof headerEmail === "string" && headerEmail.trim().length > 0
          ? headerEmail.trim().toLowerCase()
          : process.env.DEV_AUTH_BYPASS_EMAIL ?? "dev@diahealth.local";
      const account = await this.prisma.devAuthCredential.findUnique({
        where: { email: devEmail },
        select: { id: true }
      });

      if (!account) {
        throw new UnauthorizedException("Development session no longer exists");
      }

      const headerName = request.headers["x-dev-auth-name"];
      const devName =
        typeof headerName === "string" && headerName.trim().length > 0
          ? headerName.trim()
          : process.env.DEV_AUTH_BYPASS_NAME ?? devEmail.split("@")[0];

      request.user = {
        firebaseUid: `dev-${devEmail.replace(/[^a-z0-9]/g, "-")}`,
        email: devEmail,
        displayName: devName
      };

      return true;
    }

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.replace("Bearer ", "");
    const decoded = await getFirebaseAuth().verifyIdToken(token);

    request.user = {
      firebaseUid: decoded.uid,
      email: decoded.email ?? null,
      displayName: decoded.name ?? null
    };

    return true;
  }
}
