export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_TENANT_ID}`,
    redirectUri: process.env.REACT_APP_REDIRECT_URI,
    postLogoutRedirectUri: process.env.REACT_APP_REDIRECT_URI,
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

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function getRoleFromToken(account) {
  const roles = account?.idTokenClaims?.roles || [];
  if (roles.includes("Fleet.Admin")) return "admin";
  if (roles.includes("Fleet.Staff")) return "staff";
  return "user";
}
