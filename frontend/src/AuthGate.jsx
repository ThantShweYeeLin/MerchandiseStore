import React, { useEffect, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import {
  ShieldCheck,
  Loader2,
  LogOut,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { API_BASE_URL, ENTRA_AUTHORITY, ENTRA_CLIENT_ID } from "./config";

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

// On a real redirect return, handleRedirectPromise() resolves with the
// fresh sign-in result. On a plain page load/refresh it resolves to null —
// but MSAL still has the account cached (sessionStorage), so we silently
// re-acquire a token for it instead of forcing the user through
// Microsoft's login screen again on every refresh.
const msalReady = msalInstance.initialize().then(async () => {
  const redirectResponse = await msalInstance.handleRedirectPromise();
  if (redirectResponse) return redirectResponse;

  const [existingAccount] = msalInstance.getAllAccounts();
  if (!existingAccount) return null;

  try {
    return await msalInstance.acquireTokenSilent({
      account: existingAccount,
      scopes: ["openid", "profile", "email"],
    });
  } catch {
    return null; // silent refresh failed — falls back to the sign-in screen
  }
});

// Called periodically by App.jsx while the user is actively browsing (see
// TOKEN_REFRESH_INTERVAL_MS there) — the ID token is short-lived (~1 hour),
// and without this, a long-running tab (no page reload) eventually starts
// sending an expired token and every API call 401s until the page is
// manually refreshed. Returns the fresh token, or null if silent renewal
// isn't possible (e.g. the underlying Microsoft session itself expired) —
// callers should just keep using the old token and let the user's next
// manual refresh sort it out, rather than force a disruptive sign-out.
export async function refreshToken() {
  const [existingAccount] = msalInstance.getAllAccounts();
  if (!existingAccount) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({
      account: existingAccount,
      scopes: ["openid", "profile", "email"],
    });
    return result?.idToken || null;
  } catch {
    return null;
  }
}

async function signInWithEntra() {
  if (!ENTRA_CLIENT_ID) {
    throw new Error(
      "Entra ID is not configured. Set the VITE_ENTRA_CLIENT_ID value.",
    );
  }
  if (!isGuid(ENTRA_CLIENT_ID)) {
    throw new Error(
      "VITE_ENTRA_CLIENT_ID must be the frontend app registration's Application (client) ID GUID.",
    );
  }
  const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || "";
  // "common"/"organizations"/"consumers" are Microsoft's multi-tenant aliases
  // (used when the app accepts any Microsoft account, not one fixed tenant)
  // — a real tenant GUID is only expected for a single-tenant app registration.
  const MULTI_TENANT_ALIASES = ["common", "organizations", "consumers"];
  if (!isGuid(tenantId) && !MULTI_TENANT_ALIASES.includes(tenantId)) {
    throw new Error(
      "VITE_ENTRA_TENANT_ID must be the Microsoft Entra Directory (tenant) ID GUID, or one of common/organizations/consumers.",
    );
  }

  // No custom API scope requested — an access token scoped to our own
  // exposed API would require Microsoft to provision that resource inside
  // the signed-in user's own tenant first, which doesn't happen for
  // arbitrary outside tenants (this is what caused AADSTS500011). The ID
  // token needs none of that: it's always issued for our own client app,
  // for any Microsoft account, in any tenant.
  await msalReady;
  await msalInstance.loginRedirect({
    scopes: ["openid", "profile", "email"],
  });
}

function userFromAuthResponse(response) {
  if (!response?.account || !response.idToken) return null;
  const account = response.account;
  const claims = account.idTokenClaims || {};
  const groupsOrRoles = [...(claims.roles || []), ...(claims.groups || [])];

  return {
    displayName:
      account.name || claims.name || claims.preferred_username || "Entra user",
    email: account.username || claims.preferred_username || claims.email || "",
    department: claims.department || "General",
    role: mapEntraRole(groupsOrRoles),
    adObjectId: claims.oid || account.localAccountId,
    token: response.idToken,
    account,
  };
}

// The Entra-claims-derived role/department above is only a best guess (app
// role assignments Entra itself knows about). The backend can also promote
// someone via AD_ADMIN_EMAILS (Entra has no idea this happened) and assigns
// department manually (see PATCH /admin/users/:id/department) — so the real
// values always come from here, overriding the guess once available.
async function fetchMe(token) {
  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Could not load account details (${response.status})`);
  return response.json();
}

function isGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
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

// Same gradient/frame as SignInScreen so there's no visible flash if it
// turns out no session exists and SignInScreen replaces it a moment later.
function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100svh",
        background: `linear-gradient(180deg, ${COLORS.red} 0%, ${COLORS.redDeep} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Loader2 size={28} color={COLORS.white} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SignInScreen({ onSignIn, signingIn, error }) {
  return (
    <div
      style={{
        minHeight: "100svh",
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
        minHeight: "100svh",
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
              <Briefcase size={16} /> Manage catalog ({user.role === "ADMIN" ? "admin" : "staff"})
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

export default function AuthGate({ onEnterStorefront, onEnterAdmin, autoEnter }) {
  const [user, setUser] = useState(null);
  // True until the initial silent-session check (see msalReady above)
  // finishes — while true we show a neutral loading screen instead of
  // flashing the sign-in form before immediately replacing it once an
  // existing session is found.
  const [checkingSession, setCheckingSession] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    msalReady
      .then(async (response) => {
        const signedInUser = userFromAuthResponse(response);
        if (!signedInUser) return;
        let finalUser = signedInUser;
        try {
          const me = await fetchMe(signedInUser.token);
          finalUser = {
            ...signedInUser,
            role: me.role,
            department: me.department || signedInUser.department,
            displayName: me.displayName || signedInUser.displayName,
          };
        } catch {
          // Backend unreachable — fall back to the Entra-claims-derived
          // guess rather than blocking sign-in entirely.
        }
        setUser(finalUser);

        // A remembered destination (App.jsx restores this from
        // sessionStorage on refresh) means this is a silently-restored
        // session, not a fresh interactive sign-in — skip straight back to
        // where they were instead of showing the "where do you want to go"
        // card again. Only auto-enter admin if the role actually still
        // allows it (a demoted user falls through to the normal card).
        if (autoEnter === "storefront") {
          onEnterStorefront?.(finalUser);
        } else if (autoEnter === "admin" && (finalUser.role === "STAFF" || finalUser.role === "ADMIN")) {
          onEnterAdmin?.(finalUser);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setCheckingSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (checkingSession) {
    return <LoadingScreen />;
  }

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
        await msalInstance.logoutRedirect({ account: user.account });
      }}
      onEnterStorefront={() => onEnterStorefront?.(user)}
      onEnterAdmin={() => onEnterAdmin?.(user)}
    />
  );
}
