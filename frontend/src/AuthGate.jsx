import React, { useState } from "react";
import { ShieldCheck, Loader2, LogOut, GraduationCap, Briefcase } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Auth layer — stand-in for real MSAL/OIDC.                           */
/*                                                                      */
/* In production this whole block gets replaced by @azure/msal-browser:*/
/*   import { PublicClientApplication } from "@azure/msal-browser";    */
/*   const msalInstance = new PublicClientApplication(msalConfig);     */
/*   await msalInstance.loginPopup({ scopes: ["User.Read"] });         */
/*                                                                      */
/* The backend never sees a password — it only ever verifies the JWT   */
/* access token MSAL hands back, against AD's JWKS endpoint.           */
/* ------------------------------------------------------------------ */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Stands in for msalInstance.loginPopup(...) + the token AD hands back.
async function signInWithUniversitySSO() {
  await wait(1100);
  // This is the shape of the decoded JWT claims AD would return.
  return {
    displayName: "Aye Myat Myat Mon",
    email: "6611944@au.edu",
    department: "Computer Science",
    role: "STUDENT", // or "STAFF" / "ADMIN", set by AD group membership
    adObjectId: "a1b2c3d4-...",
  };
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
  display: { fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif" },
};

/* ------------------------------------------------------------------ */
/* Screens                                                              */
/* ------------------------------------------------------------------ */

function SignInScreen({ onSignIn, signingIn }) {
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
          width: 380,
          maxWidth: "100%",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: `2px solid ${COLORS.red}`,
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...styles.display,
            fontWeight: 700,
            fontSize: 20,
            color: COLORS.red,
          }}
        >
          AU
        </div>
        <div style={{ ...styles.display, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          Merchandise Store
        </div>
        <div style={{ fontSize: 13.5, color: COLORS.muted, marginBottom: 30, lineHeight: 1.5 }}>
          Sign in with your university account to browse the catalog or manage listings.
        </div>

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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          }}
        >
          {signingIn ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              Redirecting to university sign-in…
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Sign in with University SSO
            </>
          )}
        </button>

        <div style={{ fontSize: 11.5, color: COLORS.muted, marginTop: 18, lineHeight: 1.5 }}>
          You'll be redirected to your university's login page. This app never
          sees your password.
        </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
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
            {user.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{user.displayName}</div>
            <div style={{ fontSize: 12.5, color: COLORS.muted }}>{user.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <span style={{ background: COLORS.redSoft, color: COLORS.redDeep, fontSize: 11.5, padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>
            {user.role}
          </span>
          <span style={{ background: COLORS.bg, color: COLORS.ink, fontSize: 11.5, padding: "4px 10px", borderRadius: 20, border: `1px solid ${COLORS.line}` }}>
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

  const handleSignIn = async () => {
    setSigningIn(true);
    const claims = await signInWithUniversitySSO();
    setUser(claims);
    setSigningIn(false);
  };

  if (!user) {
    return <SignInScreen onSignIn={handleSignIn} signingIn={signingIn} />;
  }

  return (
    <SignedInScreen
      user={user}
      onSignOut={() => setUser(null)}
      onEnterStorefront={() => onEnterStorefront?.(user)}
      onEnterAdmin={() => onEnterAdmin?.(user)}
    />
  );
}
