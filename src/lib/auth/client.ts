import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, organizationAdditionalFields, platformAc, platformRoles, roles } from "./permissions";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    organizationClient({
      ac,
      roles,
      schema: { organization: { additionalFields: organizationAdditionalFields } },
    }),
    adminClient({ ac: platformAc, roles: platformRoles }),
  ],
});

export const { useSession, signIn, signUp, signOut, useActiveOrganization, useListOrganizations } =
  authClient;
