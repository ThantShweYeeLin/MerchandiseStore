import React, { useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import {
  ShieldCheck,
  Loader2,
  LogOut,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { ENTRA_API_SCOPE, ENTRA_AUTHORITY, ENTRA_CLIENT_ID } from "./config";

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: ENTRA_CLIENT_ID,
    authority: ENTRA_AUTHORITY,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
});

const msalReady = msalInstance.initialize();

async function signInWithEntra() {
  if (!ENTRA_CLIENT_ID || !ENTRA_API_SCOPE) {
    throw new Error(
      "Entra ID is not configured. Set the VITE_ENTRA_CLIENT_ID and VITE_ENTRA_API_SCOPE values.",
    );
  }

  await msalReady;
  const response = await msalInstance.loginPopup({ scopes: [ENTRA_API_SCOPE] });
  const claims = response.account.idTokenClaims || {};
  const groupsOrRoles = [...(claims.roles || []), ...(claims.groups || [])];

  return {
    displayName:
      response.account.name ||
      claims.name ||
      claims.preferred_username ||
      "Entra user",
    email:
      response.account.username ||
      claims.preferred_username ||
      claims.email ||
      "",
    department: claims.department || "General",
    role: mapEntraRole(groupsOrRoles),
    adObjectId: claims.oid || response.account.localAccountId,
    token: response.accessToken,
    account: response.account,
  };
}

function mapEntraRole(groupsOrRoles) {
  if (groupsOrRoles.includes("MerchStoreAdmin")) return "ADMIN";
  if (groupsOrRoles.includes("MerchStoreStaff")) return "STAFF";
  return "STUDENT";
}

/* ------------------------------------------------------------------ */
/* Design tokens — matches storefront / admin panel                    */
/* ------------------------------------------------------------------ */

const COLORS = {
  red: "#A61C2E",
  redDeep: "#7A1220",
  redSoft: "#F3D6D9",
  white: "#FFFFFF",
  ink: "#20262F",
  muted: "#8A8371",
  line: "#E3D9DA",
  bg: "#FAF7F7",
};

const styles = {
  display: {
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  },
};

/* ------------------------------------------------------------------ */
/* Screens                                                              */
/* ------------------------------------------------------------------ */

function SignInScreen({ onSignIn, signingIn, error }) {
  return (
    <div
      style={{
        minHeight: "100%",
        background: `linear-gradient(180deg, ${COLORS.red} 0%, ${COLORS.redDeep} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: COLORS.white,
          borderRadius: 10,
          width: 400,
          maxWidth: "100%",
          padding: "36px 32px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: `2px solid ${COLORS.red}`,
              margin: "0 auto 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...styles.display,
              fontWeight: 700,
              fontSize: 19,
              color: COLORS.red,
            }}
          >
            AU
          </div>
          <div
            style={{
              ...styles.display,
              fontSize: 21,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Merchandise Store
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Sign in or create your account with Microsoft.
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "#FBEAEC",
              color: COLORS.redDeep,
              fontSize: 12.5,
              padding: "10px 12px",
              borderRadius: 5,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={onSignIn}
          disabled={signingIn}
          style={{
            width: "100%",
            background: COLORS.red,
            color: COLORS.white,
            border: "none",
            padding: "13px 16px",
            borderRadius: 6,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: signingIn ? "default" : "pointer",
            opacity: signingIn ? 0.7 : 1,
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          }}
        >
          {signingIn ? (
            <>
              <Loader2
                size={16}
                style={{ animation: "spin 1s linear infinite" }}
              />
              Connecting to Microsoft…
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Continue with Microsoft
            </>
          )}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function SignedInScreen({ user, onSignOut, onEnterStorefront, onEnterAdmin }) {
  const canManage = user.role === "STAFF" || user.role === "ADMIN";
  return (
    <div
      style={{
        minHeight: "100%",
        background: COLORS.bg,
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: COLORS.white,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 10,
          width: 400,
          maxWidth: "100%",
          padding: 30,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: COLORS.redSoft,
              color: COLORS.redDeep,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...styles.display,
              fontWeight: 700,
              fontSize: 17,
            }}
          >
            {user.displayName
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {user.displayName}
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.muted }}>
              {user.email}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <span
            style={{
              background: COLORS.redSoft,
              color: COLORS.redDeep,
              fontSize: 11.5,
              padding: "4px 10px",
              borderRadius: 20,
              fontWeight: 600,
            }}
          >
            {user.role}
          </span>
          <span
            style={{
              background: COLORS.bg,
              color: COLORS.ink,
              fontSize: 11.5,
              padding: "4px 10px",
              borderRadius: 20,
              border: `1px solid ${COLORS.line}`,
            }}
          >
            {user.department}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onEnterStorefront} style={navButton(false)}>
            <GraduationCap size={16} /> Browse the store
          </button>
          {canManage && (
            <button onClick={onEnterAdmin} style={navButton(true)}>
              <Briefcase size={16} /> Manage catalog (admin)
            </button>
          )}
        </div>

        <button
          onClick={onSignOut}
          style={{
            marginTop: 20,
            width: "100%",
            background: "none",
            border: "none",
            color: COLORS.muted,
            fontSize: 12.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );
}

function navButton(primary) {
  return {
    width: "100%",
    background: primary ? COLORS.red : COLORS.white,
    color: primary ? COLORS.white : COLORS.ink,
    border: `1px solid ${primary ? COLORS.red : COLORS.line}`,
    padding: "11px 14px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
}

/* ------------------------------------------------------------------ */
/* Root component                                                       */
/* ------------------------------------------------------------------ */

export default function AuthGate({ onEnterStorefront, onEnterAdmin }) {
  const [user, setUser] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState(null);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      const claims = await signInWithEntra();
      setUser(claims);
    } catch (err) {
      setError(err.message);
    } finally {
      setSigningIn(false);
    }
  };

  if (!user) {
    return (
      <SignInScreen
        onSignIn={handleSignIn}
        signingIn={signingIn}
        error={error}
      />
    );
  }

  return (
    <SignedInScreen
      user={user}
      onSignOut={async () => {
        await msalReady;
        await msalInstance.logoutPopup({ account: user.account });
        setUser(null);
      }}
      onEnterStorefront={() => onEnterStorefront?.(user)}
      onEnterAdmin={() => onEnterAdmin?.(user)}
    />
  );
}
