// Frontend values are public Entra application metadata, not secrets.

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export const MOCK_AD_BASE_URL =
  import.meta.env.VITE_MOCK_AD_BASE_URL || "http://localhost:4001";

export const ENTRA_CLIENT_ID =
  import.meta.env.VITE_ENTRA_CLIENT_ID || "";

export const ENTRA_TENANT_ID =
  import.meta.env.VITE_ENTRA_TENANT_ID || "common";

export const ENTRA_AUTHORITY =
  import.meta.env.VITE_ENTRA_AUTHORITY ||
  `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`;

export const ENTRA_API_SCOPE =
  import.meta.env.VITE_ENTRA_API_SCOPE ||
  (ENTRA_CLIENT_ID
    ? `api://${ENTRA_CLIENT_ID}/access_as_user`
    : "");