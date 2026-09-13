import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ShoppingBag, X, Check, ChevronRight, Loader2, ShieldCheck, ShieldAlert, Minus, Plus, Package, Clock } from "lucide-react";
import ProductDetail from "./ProductDetail";
import { API_BASE_URL } from "./config";

/* ------------------------------------------------------------------ */
/* API layer — real calls against the Express backend.                 */
/* ------------------------------------------------------------------ */

// GET /products — the backend has one flat Category per product (it doubles
// as the "department" checked for a discount), unlike this UI's original
// mock data which had a separate category/department split. category and
// department are both set to the same name here so the rest of this file
// (written against the old two-field shape) needs no further changes.
async function fetchProducts(token) {
  const res = await fetch(`${API_BASE_URL}/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  const products = await res.json();
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category?.name ?? "Uncategorized",
    department: p.category?.name ?? null,
    price: Number(p.price),
    stock: p.stock,
    blurb: p.description || "No description yet.",
    images: p.images,
    imageUrl: p.imageUrl || null,
    // Per-product override takes priority over the department's default —
    // matches the same fallback order the backend applies when actually
    // pricing an order (see GET /orders' discount calculation).
    discountRate: p.discountRate ?? p.category?.discountRate ?? 0.15,
  }));
}

// POST /orders — the backend auto-detects every department represented in
// the cart and verifies each one separately server-side (no manual "claim
// discount" step needed); the response's peerVerificationLogs is the real
// per-department result (see docs/educore-contract.md).
async function placeOrder({ items, token }) {
  const res = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items: items.map((i) => ({ productId: i.product.id, quantity: i.qty })),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Order failed (${res.status})`);
  }
  const order = await res.json();
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  return {
    orderId: order.id,
    status: order.status,
    subtotal,
    discount: subtotal - Number(order.totalAmount),
    total: Number(order.totalAmount),
    discountApplied: order.discountApplied,
    verifications: order.peerVerificationLogs || [],
  };
}

// GET /orders/mine — status is whatever staff last set it to (see the
// "Orders" tab in the admin panel): PENDING, READY_FOR_PICKUP, PAID, or
// CANCELLED.
async function fetchMyOrders(token) {
  const res = await fetch(`${API_BASE_URL}/orders/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load your orders (${res.status})`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */

const COLORS = {
  navy: "#A61C2E",
  navyDeep: "#7A1220",
  gold: "#A61C2E",
  goldSoft: "#F3D6D9",
  cream: "#FFFFFF",
  maroon: "#7A1220",
  ink: "#20262F",
  line: "#E3D9DA",
};

const styles = {
  app: {
    fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
    background: COLORS.cream,
    color: COLORS.ink,
    minHeight: "100svh",
    display: "flex",
    flexDirection: "column",
  },
  display: {
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  },
};

// Shared by the catalog card, cart drawer, and checkout screen so the price
// shown before placing an order matches what the backend will actually
// charge (it independently re-verifies and re-prices every item at order
// time — this is just an accurate preview, not the source of truth).
function isEligibleForDiscount(product, viewerDepartment) {
  return Boolean(product.department && product.department === viewerDepartment);
}

function effectivePrice(product, viewerDepartment) {
  return isEligibleForDiscount(product, viewerDepartment)
    ? product.price * (1 - product.discountRate)
    : product.price;
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Badge({ children, tone = "navy" }) {
  const tones = {
    navy: { bg: COLORS.navy, fg: COLORS.cream },
    gold: { bg: COLORS.goldSoft, fg: COLORS.navyDeep },
    maroon: { bg: COLORS.maroon, fg: COLORS.cream },
    neutral: { bg: "#EFECE6", fg: "#5A5346" },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        background: t.bg,
        color: t.fg,
        fontSize: 11,
        letterSpacing: "0.02em",
        padding: "3px 9px",
        borderRadius: 3,
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function Header({ cartCount, onCartClick, onMyOrdersClick, studentDept }) {
  return (
    <header
      style={{
        background: COLORS.navy,
        color: COLORS.cream,
        padding: "18px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        borderBottom: `3px solid ${COLORS.gold}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: `2px solid ${COLORS.gold}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            ...styles.display,
            fontWeight: 700,
          }}
        >
          AU
        </div>
        <div>
          <div style={{ ...styles.display, fontSize: 19, lineHeight: 1.1, fontWeight: 600 }}>
            Merchandise Store
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.65, letterSpacing: "0.01em" }}>
            Signed in as student · {studentDept}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onMyOrdersClick}
          style={{
            background: "transparent",
            border: `1px solid rgba(247,243,234,0.35)`,
            color: COLORS.cream,
            padding: "8px 14px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          <Package size={16} />
          My orders
        </button>
        <button
          onClick={onCartClick}
          style={{
            background: "transparent",
            border: `1px solid rgba(247,243,234,0.35)`,
            color: COLORS.cream,
            padding: "8px 14px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          <ShoppingBag size={16} />
          Cart
          {cartCount > 0 && (
            <span
              style={{
                background: COLORS.gold,
                color: COLORS.navyDeep,
                borderRadius: "50%",
                width: 19,
                height: 19,
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

function ProductCard({ product, viewerDepartment, onAdd, onOpen }) {
  const isViewerDepartment = product.department && product.department === viewerDepartment;
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${COLORS.line}`,
        borderRadius: 6,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        onClick={() => onOpen(product)}
        style={{
          height: 120,
          borderRadius: 4,
          cursor: "pointer",
          overflow: "hidden",
          ...(product.imageUrl
            ? {}
            : {
                background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyDeep})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLORS.goldSoft,
                fontSize: 12,
                letterSpacing: "0.04em",
              }),
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          product.category
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div
          onClick={() => onOpen(product)}
          style={{ ...styles.display, fontSize: 16, fontWeight: 600, lineHeight: 1.25, cursor: "pointer" }}
        >
          {product.name}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#5A5346", lineHeight: 1.4, flexGrow: 1 }}>
        {product.blurb}
      </div>
      {product.department && (
        isViewerDepartment ? (
          <Badge tone="gold">✓ {Math.round(product.discountRate * 100)}% off — matches your department</Badge>
        ) : (
          <Badge tone="neutral">{product.department} students only — you may not qualify</Badge>
        )
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <div style={{ ...styles.display, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 7 }}>
          {isViewerDepartment ? (
            <>
              <span style={{ textDecoration: "line-through", color: "#8A8371", fontSize: 13, fontWeight: 500 }}>
                ฿{product.price}
              </span>
              <span style={{ color: COLORS.maroon }}>
                ฿{(product.price * (1 - product.discountRate)).toFixed(0)}
              </span>
            </>
          ) : (
            <span>฿{product.price}</span>
          )}
        </div>
        <button
          onClick={() => onAdd(product)}
          style={{
            background: COLORS.navy,
            color: COLORS.cream,
            border: "none",
            padding: "8px 14px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}

function CartDrawer({ open, onClose, cart, viewerDepartment, onQtyChange, onCheckout }) {
  const total = cart.reduce((s, i) => s + effectivePrice(i.product, viewerDepartment) * i.qty, 0);
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13,22,38,0.45)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 40,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 380,
          maxWidth: "90vw",
          background: COLORS.cream,
          height: "100svh",
          padding: 24,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ ...styles.display, fontSize: 20, fontWeight: 700 }}>Your cart</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} color={COLORS.ink} />
          </button>
        </div>
        {cart.length === 0 && (
          <div style={{ fontSize: 14, color: "#8A8371", marginTop: 20 }}>
            Nothing here yet. Add something from the catalog.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flexGrow: 1 }}>
          {cart.map((item) => {
            const eligible = isEligibleForDiscount(item.product, viewerDepartment);
            const unitPrice = effectivePrice(item.product, viewerDepartment);
            return (
              <div key={item.product.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 12 }}>
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.product.name}</div>
                  <div style={{ fontSize: 12.5, color: "#8A8371", display: "flex", alignItems: "center", gap: 6 }}>
                    {eligible && (
                      <span style={{ textDecoration: "line-through" }}>฿{item.product.price}</span>
                    )}
                    <span>฿{unitPrice.toFixed(0)} each</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <button onClick={() => onQtyChange(item.product.id, item.qty - 1)} style={qtyBtn}>
                      <Minus size={12} />
                    </button>
                    <span style={{ fontSize: 13, minWidth: 14, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => onQtyChange(item.product.id, item.qty + 1)} style={qtyBtn}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ ...styles.display, fontSize: 14, fontWeight: 700 }}>
                  ฿{(unitPrice * item.qty).toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
        {cart.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", ...styles.display, fontSize: 17, fontWeight: 700 }}>
              <span>Subtotal</span>
              <span>฿{total.toFixed(0)}</span>
            </div>
            <button
              onClick={onCheckout}
              style={{
                background: COLORS.maroon,
                color: COLORS.cream,
                border: "none",
                padding: "13px 16px",
                borderRadius: 4,
                fontSize: 14.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              Continue to checkout <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const qtyBtn = {
  width: 24,
  height: 24,
  borderRadius: 4,
  border: `1px solid ${COLORS.line}`,
  background: "#fff",
  color: COLORS.ink,
  cursor: "pointer",
  boxSizing: "border-box",
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function CheckoutView({ cart, token, viewerDepartment, onBack, onDone }) {
  const [status, setStatus] = useState("idle"); // idle | verifying | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Every department represented in the cart gets checked automatically,
  // server-side, once per department — no manual "claim discount" step.
  const departmentsInCart = [...new Set(cart.filter((i) => i.product.department).map((i) => i.product.department))];

  const submit = async () => {
    setStatus("verifying");
    setError(null);
    try {
      const res = await placeOrder({ items: cart, token });
      setResult(res);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  if (status === "done" && result) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center", padding: 24 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: COLORS.navy,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Check size={26} color={COLORS.cream} />
        </div>
        <div style={{ ...styles.display, fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Order placed</div>
        <div style={{ fontSize: 14, color: "#8A8371", marginBottom: 24 }}>{result.orderId}</div>

        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 20, textAlign: "left", fontSize: 14 }}>
          {result.discount > 0 && (
            <>
              <Row label="Items total" value={`฿${result.subtotal.toFixed(0)}`} />
              <Row
                label={
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={15} color={COLORS.navy} /> Department discount
                  </span>
                }
                value={`−฿${result.discount.toFixed(0)}`}
              />
            </>
          )}
          <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", ...styles.display, fontWeight: 700, fontSize: 17 }}>
            <span>Subtotal</span>
            <span>฿{result.total.toFixed(0)}</span>
          </div>
        </div>

        {result.verifications.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16, marginTop: 14, textAlign: "left" }}>
            <div style={{ fontSize: 11.5, color: "#8A8371", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Enrollment checks (one per department, real-time)
            </div>
            {result.verifications.map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, padding: "5px 0" }}>
                {v.verified ? (
                  <ShieldCheck size={15} color={COLORS.navy} />
                ) : (
                  <ShieldAlert size={15} color={COLORS.maroon} />
                )}
                <span>{v.department}</span>
                <span style={{ marginLeft: "auto", color: v.verified ? COLORS.navy : COLORS.maroon, fontWeight: 600 }}>
                  {v.verified ? "Verified" : "Not verified"}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "#8A8371", marginTop: 8, lineHeight: 1.5 }}>
              Full price applies to any department that couldn't be verified — no discount is given by default if the check fails.
            </div>
          </div>
        )}

        <button
          onClick={onDone}
          style={{
            marginTop: 24,
            background: COLORS.navy,
            color: COLORS.cream,
            border: "none",
            padding: "11px 22px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Back to catalog
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.navy, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}>
        ← Back to cart
      </button>
      <div style={{ ...styles.display, fontSize: 24, fontWeight: 700, marginBottom: 18 }}>Checkout</div>

      {departmentsInCart.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16, marginBottom: 20, fontSize: 13.5, color: "#5A5346" }}>
          Your cart includes items from <strong>{departmentsInCart.join(", ")}</strong>. Each department is
          verified automatically when you place the order — no need to select one yourself.
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 18, marginBottom: 20, fontSize: 14 }}>
        {cart.map((i) => (
          <Row
            key={i.product.id}
            label={`${i.product.name} × ${i.qty}`}
            value={`฿${(effectivePrice(i.product, viewerDepartment) * i.qty).toFixed(0)}`}
          />
        ))}
        <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", ...styles.display, fontWeight: 700 }}>
          <span>Estimated total</span>
          <span>
            ฿{cart.reduce((s, i) => s + effectivePrice(i.product, viewerDepartment) * i.qty, 0).toFixed(0)}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FBEAEC", color: COLORS.maroon, fontSize: 13, padding: "10px 12px", borderRadius: 4, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <button
        disabled={status === "verifying"}
        onClick={submit}
        style={{
          width: "100%",
          background: COLORS.maroon,
          color: COLORS.cream,
          border: "none",
          padding: "13px 16px",
          borderRadius: 4,
          fontSize: 14.5,
          fontWeight: 700,
          cursor: status === "verifying" ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {status === "verifying" ? (
          <>
            <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            Verifying enrollment…
          </>
        ) : (
          "Place order"
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const ORDER_STATUS_LABELS = {
  PENDING: { label: "Pending", tone: "neutral" },
  READY_FOR_PICKUP: { label: "Ready for pickup", tone: "gold" },
  PAID: { label: "Paid", tone: "navy" },
  CANCELLED: { label: "Cancelled", tone: "maroon" },
};

function MyOrdersView({ token, onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        setOrders(await fetchMyOrders(token));
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.navy, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}>
        ← Back to catalog
      </button>
      <div style={{ ...styles.display, fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Your orders</div>
      <div style={{ fontSize: 13.5, color: "#8A8371", marginBottom: 22 }}>
        Track whether each order is still pending or ready for you to pick up.
      </div>

      {loadError && (
        <div style={{ background: "#FBEAEC", color: COLORS.maroon, padding: "12px 14px", borderRadius: 5, marginBottom: 18, fontSize: 13.5 }}>
          {loadError}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8A8371" }}>Loading…</div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8A8371" }}>
          <Package size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>No orders yet.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders.map((o) => {
            const statusInfo = ORDER_STATUS_LABELS[o.status] || { label: o.status, tone: "neutral" };
            return (
              <div key={o.id} style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, color: "#8A8371" }}>
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                  <Badge tone={statusInfo.tone}>
                    {o.status === "PENDING" && <Clock size={11} style={{ marginRight: 4, verticalAlign: -1 }} />}
                    {statusInfo.label}
                  </Badge>
                </div>
                <div style={{ fontSize: 13.5, marginBottom: 8 }}>
                  {o.items.map((i) => `${i.product.name} × ${i.quantity}`).join(", ")}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", ...styles.display, fontWeight: 700, fontSize: 15 }}>
                  <span>Total</span>
                  <span>฿{Number(o.totalAmount).toFixed(0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
      <span style={{ color: "#5A5346" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root app                                                             */
/* ------------------------------------------------------------------ */

export default function StorefrontApp({ token, department, resetKey }) {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [view, setView] = useState("catalog"); // catalog | detail | checkout | myorders
  const [filter, setFilter] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchProducts(token)
      .then(setAllProducts)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Clicking "Storefront" in the top nav should always land back on the
  // actual catalog, even if you were mid-checkout, viewing a product, or on
  // "My orders" — otherwise clicking it while already on this page (a very
  // easy thing to do) silently does nothing.
  useEffect(() => {
    setView("catalog");
    setCartOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const openProduct = (product) => {
    setSelectedProduct(product);
    setView("detail");
  };

  const categories = ["All", ...new Set(allProducts.map((p) => p.category))];
  const products = useMemo(
    () => (filter === "All" ? allProducts : allProducts.filter((p) => p.category === filter)),
    [filter, allProducts]
  );

  const addToCart = useCallback((product, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { product, qty }];
    });
    setCartOpen(true);
  }, []);

  const changeQty = (id, qty) => {
    setCart((prev) =>
      qty <= 0 ? prev.filter((i) => i.product.id !== id) : prev.map((i) => (i.product.id === id ? { ...i, qty } : i))
    );
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div style={styles.app}>
      <Header
        cartCount={cartCount}
        onCartClick={() => setCartOpen(true)}
        onMyOrdersClick={() => setView("myorders")}
        studentDept={department}
      />

      {view === "catalog" && (
        <main style={{ padding: "28px 32px", maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ ...styles.display, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
              Official university merchandise
            </div>
            <div style={{ fontSize: 14, color: "#8A8371" }}>
              Department items apply a discount once your enrollment is verified at checkout.
            </div>
          </div>

          {loading && <div style={{ padding: 40, textAlign: "center", color: "#8A8371" }}>Loading products…</div>}
          {loadError && (
            <div style={{ background: "#FBEAEC", color: COLORS.maroon, padding: "12px 14px", borderRadius: 5, marginBottom: 20, fontSize: 13.5 }}>
              {loadError} — is the backend running on {`localhost:3000`}?
            </div>
          )}
          {!loading && !loadError && allProducts.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#8A8371", fontSize: 14 }}>
              No products yet — a STAFF/ADMIN user needs to add some in the admin panel first.
            </div>
          )}

          {!loading && allProducts.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilter(c)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: `1px solid ${filter === c ? COLORS.navy : COLORS.line}`,
                      background: filter === c ? COLORS.navy : "#fff",
                      color: filter === c ? COLORS.cream : COLORS.ink,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} viewerDepartment={department} onAdd={addToCart} onOpen={openProduct} />
                ))}
              </div>
            </>
          )}
        </main>
      )}

      {view === "detail" && selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          viewerDepartment={department}
          onBack={() => setView("catalog")}
          onAddToCart={(product, qty) => addToCart(product, qty)}
        />
      )}

      {view === "checkout" && (
        <CheckoutView
          cart={cart}
          token={token}
          viewerDepartment={department}
          onBack={() => {
            setView("catalog");
            setCartOpen(true);
          }}
          onDone={() => {
            setCart([]);
            setView("catalog");
          }}
        />
      )}

      {view === "myorders" && <MyOrdersView token={token} onBack={() => setView("catalog")} />}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        viewerDepartment={department}
        onQtyChange={changeQty}
        onCheckout={() => {
          setCartOpen(false);
          setView("checkout");
        }}
      />
    </div>
  );
}
