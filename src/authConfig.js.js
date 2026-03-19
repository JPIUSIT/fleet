export const msalConfig = {
  auth: {
    clientId: "ae0d3e68-6e58-4f2d-8308-760d844bc142",
    authority: "https://login.microsoftonline.com/273b2264-8794-4248-aa86-f772d50456e6",
    redirectUri: "https://kevina96.github.io/jplus-fleet-manager",
    postLogoutRedirectUri: "https://kevina96.github.io/jplus-fleet-manager",
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["User.Read", "Calendars.ReadWrite", "Mail.Send"],
};

// Mappa i ruoli dell'app Azure AD ai ruoli interni
export function getRoleFromToken(account) {
  const roles = account?.idTokenClaims?.roles || [];
  if (roles.includes("Fleet.Admin")) return "admin";
  if (roles.includes("Fleet.Staff")) return "staff";
  return "user";
}