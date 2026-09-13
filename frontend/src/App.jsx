import React, { useEffect, useState } from "react";
import AuthGate, { refreshToken } from "./AuthGate";
import StorefrontApp from "./StorefrontApp";
import AdminCatalog from "./AdminCatalog";
import { LogOut, ShoppingBag, Briefcase } from "lucide-react";

const COLORS = {
  red: "#A61C2E",
  redDeep: "#7A1220",
  white: "#FFFFFF",
  ink: "#20262F",
  line: "#E3D9DA",
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

  const handleEnterStorefront = (signedInUser) => {
    setUser(signedInUser);
    setPage("storefront");
    rememberPage("storefront");
    setStorefrontResetKey((n) => n + 1);
  };

  const handleEnterAdmin = (signedInUser) => {
    setUser(signedInUser);
    setPage("admin");
    rememberPage("admin");
  };

  const handleSignOut = () => {
    setUser(null);
    setPage("login");
    rememberPage("login");
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
              }}
            >
              <Briefcase size={13} /> {user.role === "ADMIN" ? "Admin" : "Staff"}
            </TabButton>
          )}
        </div>
        <button
          onClick={handleSignOut}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>

      <div style={{ flexGrow: 1 }}>
        {page === "storefront" && (
          <StorefrontApp token={user.token} department={user.department} role={user.role} resetKey={storefrontResetKey} />
        )}
        {page === "admin" && <AdminCatalog token={user.token} role={user.role} department={user.department} />}
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
