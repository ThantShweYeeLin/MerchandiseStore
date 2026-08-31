import React, { useState } from "react";
import AuthGate from "./AuthGate";
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

export default function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);

  const handleEnterStorefront = (signedInUser) => {
    setUser(signedInUser);
    setPage("storefront");
  };

  const handleEnterAdmin = (signedInUser) => {
    setUser(signedInUser);
    setPage("admin");
  };

  const handleSignOut = () => {
    setUser(null);
    setPage("login");
  };

  if (page === "login") {
    return <AuthGate onEnterStorefront={handleEnterStorefront} onEnterAdmin={handleEnterAdmin} />;
  }

  const canManage = user?.role === "STAFF" || user?.role === "ADMIN";

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
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
          <TabButton active={page === "storefront"} onClick={() => setPage("storefront")}>
            <ShoppingBag size={13} /> Storefront
          </TabButton>
          {canManage && (
            <TabButton active={page === "admin"} onClick={() => setPage("admin")}>
              <Briefcase size={13} /> Admin
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
        {page === "storefront" && <StorefrontApp />}
        {page === "admin" && <AdminCatalog />}
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