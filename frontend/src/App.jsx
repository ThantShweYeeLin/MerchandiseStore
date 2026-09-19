import React, { useEffect, useState } from "react";
import AuthGate, { refreshToken, signOut } from "./AuthGate";
import StorefrontApp from "./StorefrontApp";
import AdminCatalog from "./AdminCatalog";
import { UserCircle, ShoppingBag, Briefcase, LogOut, X } from "lucide-react";

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

// Remembers which page you were on (storefront/admin) across a refresh —
// without this, "page" is only ever in React state, which resets to
// "login" on every reload even though the Entra session itself persists.
const REMEMBERED_PAGE_KEY = "merchstore.page";

function rememberPage(page) {
  try {
    if (page === "login") sessionStorage.removeItem(REMEMBERED_PAGE_KEY);
    else sessionStorage.setItem(REMEMBERED_PAGE_KEY, page);
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — refresh just
    // falls back to the normal sign-in flow, nothing else breaks.
  }
}

// Real URL paths for each page, so a link like /admin is a deep link. The
// path alone never grants anything: AuthGate still shows the sign-in screen
// until a valid Entra session exists in *this* browser (MSAL's cache lives
// in sessionStorage, which isn't shared across browsers or tabs), and the
// backend independently rejects every API call that lacks a valid token.
const PAGE_PATHS = { storefront: "/store", admin: "/admin" };

function pageFromPath(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return Object.keys(PAGE_PATHS).find((page) => PAGE_PATHS[page] === clean) || null;
}

function syncUrl(page, { replace = false } = {}) {
  const path = PAGE_PATHS[page] || "/";
  if (window.location.pathname === path) return;
  window.history[replace ? "replaceState" : "pushState"]({}, "", path);
}

// A deep link opened while signed out has to survive the round trip to
// Microsoft (which returns to the origin root), so stash the requested page
// in sessionStorage before AuthGate starts any redirect.
const deepLinkedPage = pageFromPath(window.location.pathname);
if (deepLinkedPage) rememberPage(deepLinkedPage);

function getRememberedPage() {
  try {
    return sessionStorage.getItem(REMEMBERED_PAGE_KEY);
  } catch {
    return null;
  }
}

// The Entra ID token is short-lived (~1 hour) — without proactively
// refreshing it, a tab left open across that window starts sending an
// expired token on every API call (401s, "Load failed") until the page is
// manually reloaded. 20 minutes keeps well ahead of that.
const TOKEN_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

export default function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);
  // Bumped every time "Storefront" is clicked (even if already there) — the
  // storefront has its own internal sub-views (checkout, product detail,
  // "My orders") that this button should always back out of, back to the
  // actual catalog, not just "already on this page, do nothing."
  const [storefrontResetKey, setStorefrontResetKey] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const fresh = await refreshToken();
      if (fresh) setUser((u) => (u ? { ...u, token: fresh } : u));
    }, TOKEN_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // Deliberately keyed on adObjectId (identity), not the whole `user`
    // object — that object's reference changes every time this same effect
    // updates the token, which would otherwise restart the interval on its
    // own tick instead of just refreshing in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.adObjectId]);

  // Browser back/forward: follow the URL, but never into a page the role
  // doesn't allow, and never without a user.
  useEffect(() => {
    if (!user) return;
    const onPopState = () => {
      const target = pageFromPath(window.location.pathname) || "storefront";
      const allowed = target !== "admin" || user.role === "STAFF" || user.role === "ADMIN";
      if (!allowed) {
        setPage("storefront");
        syncUrl("storefront", { replace: true });
        return;
      }
      setPage(target);
      rememberPage(target);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [user]);

  const handleEnterStorefront = (signedInUser) => {
    setUser(signedInUser);
    setPage("storefront");
    rememberPage("storefront");
    syncUrl("storefront");
    setStorefrontResetKey((n) => n + 1);
  };

  const handleEnterAdmin = (signedInUser) => {
    setUser(signedInUser);
    setPage("admin");
    rememberPage("admin");
    syncUrl("admin");
  };

  // Just opens a card with the account info already in hand — deliberately
  // doesn't touch MSAL or navigate back through AuthGate, so it can never
  // trigger a real (re-)login. Actual sign-out is the separate button
  // inside the card.
  const handleViewProfile = () => setProfileOpen(true);

  const handleSignOut = async () => {
    setSigningOut(true);
    rememberPage("login");
    try {
      await signOut(user.account);
    } finally {
      setSigningOut(false);
    }
  };

  if (page === "login") {
    return (
      <AuthGate
        onEnterStorefront={handleEnterStorefront}
        onEnterAdmin={handleEnterAdmin}
        autoEnter={getRememberedPage()}
      />
    );
  }

  const canManage = user?.role === "STAFF" || user?.role === "ADMIN";

  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          background: COLORS.ink,
          color: COLORS.white,
          padding: "8px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12.5,
          fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <TabButton
            active={page === "storefront"}
            onClick={() => {
              setPage("storefront");
              rememberPage("storefront");
              syncUrl("storefront");
              setStorefrontResetKey((n) => n + 1);
            }}
          >
            <ShoppingBag size={13} /> Storefront
          </TabButton>
          {canManage && (
            <TabButton
              active={page === "admin"}
              onClick={() => {
                setPage("admin");
                rememberPage("admin");
                syncUrl("admin");
              }}
            >
              <Briefcase size={13} /> {user.role === "ADMIN" ? "Admin" : "Staff"}
            </TabButton>
          )}
        </div>
        <button
          onClick={handleViewProfile}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}
        >
          <UserCircle size={13} /> Profile
        </button>
      </div>

      <div style={{ flexGrow: 1 }}>
        {page === "storefront" && (
          <StorefrontApp token={user.token} department={user.department} role={user.role} resetKey={storefrontResetKey} />
        )}
        {page === "admin" && <AdminCatalog token={user.token} role={user.role} department={user.department} />}
      </div>

      {profileOpen && (
        <ProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onSignOut={handleSignOut}
          signingOut={signingOut}
        />
      )}
    </div>
  );
}

function ProfileModal({ user, onClose, onSignOut, signingOut }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(32,38,47,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}
      onClick={onClose}
    >
      <div
        style={{ background: COLORS.white, borderRadius: 10, width: 360, maxWidth: "92vw", padding: 26, fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
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
          {user.department && (
            <span style={{ background: COLORS.bg, color: COLORS.ink, fontSize: 11.5, padding: "4px 10px", borderRadius: 20, border: `1px solid ${COLORS.line}` }}>
              {user.department}
            </span>
          )}
        </div>

        <button
          onClick={onSignOut}
          disabled={signingOut}
          style={{
            width: "100%",
            background: "none",
            border: `1px solid ${COLORS.line}`,
            borderRadius: 6,
            padding: "10px 14px",
            color: COLORS.redDeep,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: signingOut ? "default" : "pointer",
            opacity: signingOut ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          <LogOut size={14} /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: active ? COLORS.red : "transparent",
        color: COLORS.white,
        border: "none",
        padding: "6px 12px",
        borderRadius: 4,
        fontSize: 12.5,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
