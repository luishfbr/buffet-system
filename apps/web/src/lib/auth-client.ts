"use client";

import { createBuffetAuthClient } from "@buffet/auth/client";

/** Singleton Better-Auth client pointed at the Nest API. */
export const authClient = createBuffetAuthClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"
);

export const { useSession, signIn, signUp, signOut, organization } = authClient;
