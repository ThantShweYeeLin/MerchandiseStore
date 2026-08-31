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
// In this mock version, the "AD claims" come from whatever the person
// typed into the sign-in form instead of a hardcoded value.
async function signInWithUniversitySSO(formInput) {
  await wait(900);
  return {
    displayName: formInput.displayName,
    email: formInput.email,
    department: formInput.department,
    role: formInput.role,
    adObjectId: `mock-${Math.random().toString(36).slice(2, 10)}`,
  };
}

const DEPARTMENTS = ["Computer Science", "Engineering", "Business Administration", "Nursing", "Architecture"];
const ROLES = ["STUDENT", "STAFF", "ADMIN"];

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
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    department: DEPARTMENTS[0],
    role: "STUDENT",
  });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const canSubmit = form.displayName.trim() && form.email.trim();

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
          <div style={{ ...styles.display, fontSize: 21, fontWeight: 700, marginBottom: 6 }}>
            Merchandise Store
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>
            Sign in or create a test account to continue.
          </div>
        </div>

        <FormField label="Full name">
          <input
            value={form.displayName}
            onChange={update("displayName")}
            placeholder="e.g. Aye Myat Myat Mon"
            style={inputStyle}
          />
        </FormField>

        <FormField label="University email">
          <input
            value={form.email}
            onChange={update("email")}
            placeholder="e.g. 6611944@au.edu"
            style={inputStyle}
          />
        </FormField>

        <div style={{ display: "flex", gap: 10 }}>
          <FormField label="Department" grow>
            <select value={form.department} onChange={update("department")} style={inputStyle}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Role" grow>
            <select value={form.role} onChange={update("role")} style={inputStyle}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </FormField>
        </div>

        <button
          onClick={() => onSignIn(form)}
          disabled={signingIn || !canSubmit}
          style={{
            width: "100%",
            background: COLORS.red,
            color: COLORS.white,
            border: "none",
            padding: "13px 16px",
            borderRadius: 6,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: signingIn || !canSubmit ? "default" : "pointer",
            opacity: !canSubmit ? 0.5 : 1,
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          }}
        >
          {signingIn ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              Signing in…
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Sign in
            </>
          )}
        </button>

        <div style={{ fontSize: 11.5, color: COLORS.muted, marginTop: 14, textAlign: "center", lineHeight: 1.5 }}>
          Role and department are chosen here for testing only — in production
          these come from your real university AD account, not a form field.
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function FormField({ label, children, grow }) {
  return (
    <div style={{ marginBottom: 14, flex: grow ? 1 : undefined }}>
      <label style={{ display: "block", fontSize: 12.5, color: COLORS.muted, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: 5,
  border: `1px solid ${COLORS.line}`,
  fontSize: 14,
  boxSizing: "border-box",
  color: COLORS.ink,
};

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

  const handleSignIn = async (formInput) => {
    setSigningIn(true);
    const claims = await signInWithUniversitySSO(formInput);
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
