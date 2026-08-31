import React, { useState, useMemo, useCallback } from "react";
import { ShoppingBag, X, Check, ChevronRight, Loader2, ShieldCheck, ShieldAlert, Menu } from "lucide-react";
import ProductDetail from "./ProductDetail";

/* ------------------------------------------------------------------ */
/* API layer — thin wrappers matching the endpoints in the proposal.   */
/* Swap the bodies of these functions for real fetch() calls against   */
/* /store/... once the backend is deployed. Everything else in this    */
/* file is written against these function signatures, so that's the    */
/* only place that needs to change.                                    */
/* ------------------------------------------------------------------ */

const MOCK_LATENCY = 550;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// GET /store/products
async function fetchProducts() {
  await wait(300);
  return PRODUCTS;
}

// POST /store/orders  ->  triggers EduCore verification server-side per
// department claimed, then returns the priced order.
async function placeOrder({ items, department }) {
  await wait(MOCK_LATENCY);
  // Simulated EduCore response — real call is server-to-server in prod.
  const verified = department ? Math.random() > 0.25 : false;
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const discount = verified
    ? items
        .filter((i) => i.product.department === department)
        .reduce((sum, i) => sum + i.product.price * i.qty * 0.15, 0)
    : 0;
  return {
    orderId: `ORD-${Math.floor(Math.random() * 90000 + 10000)}`,
    status: "PAID",
    subtotal,
    discount,
    total: subtotal - discount,
    discountApplied: verified,
    department,
  };
}

/* ------------------------------------------------------------------ */
/* Mock catalog data — stand-in for GET /store/products                */
/* ------------------------------------------------------------------ */

const PRODUCTS = [
  { id: "p1", name: "Assumption University Hoodie", category: "Apparel", department: null, price: 890, stock: 42, blurb: "Heavyweight fleece, embroidered crest." },
  { id: "p2", name: "CS Dept. Zip Jacket", category: "Apparel", department: "Computer Science", price: 1290, stock: 18, blurb: "Windbreaker shell, department discount eligible." },
  { id: "p3", name: "Engineering Faculty Mug", category: "Drinkware", department: "Engineering", price: 220, stock: 120, blurb: "Ceramic, dishwasher safe, faculty seal." },
  { id: "p4", name: "Campus Classic Tee", category: "Apparel", department: null, price: 350, stock: 200, blurb: "100% cotton, unisex fit." },
  { id: "p5", name: "Business School Tote", category: "Bags", department: "Business Administration", price: 290, stock: 60, blurb: "Canvas, reinforced base." },
  { id: "p6", name: "Nursing Dept. Scrub Cap", category: "Apparel", department: "Nursing", price: 180, stock: 75, blurb: "Adjustable, breathable cotton blend." },
  { id: "p7", name: "University Notebook Set", category: "Stationery", department: null, price: 150, stock: 300, blurb: "Set of 3, dotted pages." },
  { id: "p8", name: "Architecture Studio Tumbler", category: "Drinkware", department: "Architecture", price: 340, stock: 40, blurb: "Insulated, 500ml." },
];

const DEPARTMENTS = ["Computer Science", "Engineering", "Business Administration", "Nursing", "Architecture"];

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
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
  },
  display: {
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  },
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Badge({ children, tone = "navy" }) {
  const tones = {
    navy: { bg: COLORS.navy, fg: COLORS.cream },
    gold: { bg: COLORS.goldSoft, fg: COLORS.navyDeep },
    maroon: { bg: COLORS.maroon, fg: COLORS.cream },
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

function Header({ cartCount, onCartClick, studentDept }) {
  return (
    <header
      style={{
        background: COLORS.navy,
        color: COLORS.cream,
        padding: "18px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `3px solid ${COLORS.gold}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
    </header>
  );
}

function ProductCard({ product, onAdd, onOpen }) {
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
          background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyDeep})`,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.goldSoft,
          fontSize: 12,
          letterSpacing: "0.04em",
          cursor: "pointer",
        }}
      >
        {product.category}
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
      {product.department && <Badge tone="gold">{product.department} discount eligible</Badge>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <div style={{ ...styles.display, fontSize: 18, fontWeight: 700 }}>฿{product.price}</div>
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

function CartDrawer({ open, onClose, cart, onQtyChange, onCheckout }) {
  const total = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
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
          height: "100%",
          padding: 24,
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
          {cart.map((item) => (
            <div key={item.product.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 12 }}>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{item.product.name}</div>
                <div style={{ fontSize: 12.5, color: "#8A8371" }}>฿{item.product.price} each</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <button onClick={() => onQtyChange(item.product.id, item.qty - 1)} style={qtyBtn}>−</button>
                  <span style={{ fontSize: 13, minWidth: 14, textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => onQtyChange(item.product.id, item.qty + 1)} style={qtyBtn}>+</button>
                </div>
              </div>
              <div style={{ ...styles.display, fontSize: 14, fontWeight: 700 }}>
                ฿{item.product.price * item.qty}
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", ...styles.display, fontSize: 17, fontWeight: 700 }}>
              <span>Subtotal</span>
              <span>฿{total}</span>
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
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};

function CheckoutView({ cart, onBack, onDone }) {
  const [department, setDepartment] = useState("");
  const [claimDiscount, setClaimDiscount] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | verifying | done
  const [result, setResult] = useState(null);

  const hasEligibleItem = cart.some((i) => i.product.department);
  const eligibleDepartments = [...new Set(cart.filter((i) => i.product.department).map((i) => i.product.department))];

  const submit = async () => {
    setStatus("verifying");
    const res = await placeOrder({
      items: cart,
      department: claimDiscount ? department : null,
    });
    setResult(res);
    setStatus("done");
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
          <Check size={26} color={COLORS.gold} />
        </div>
        <div style={{ ...styles.display, fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Order placed</div>
        <div style={{ fontSize: 14, color: "#8A8371", marginBottom: 24 }}>{result.orderId}</div>

        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 20, textAlign: "left", fontSize: 14 }}>
          <Row label="Subtotal" value={`฿${result.subtotal.toFixed(0)}`} />
          {result.discountApplied ? (
            <Row
              label={
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={15} color={COLORS.navy} /> {result.department} discount
                </span>
              }
              value={`−฿${result.discount.toFixed(0)}`}
            />
          ) : claimDiscount ? (
            <Row
              label={
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.maroon }}>
                  <ShieldAlert size={15} /> Enrollment not verified
                </span>
              }
              value="฿0"
            />
          ) : null}
          <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", ...styles.display, fontWeight: 700, fontSize: 17 }}>
            <span>Total</span>
            <span>฿{result.total.toFixed(0)}</span>
          </div>
        </div>

        {claimDiscount && !result.discountApplied && (
          <div style={{ fontSize: 12.5, color: "#8A8371", marginTop: 12, lineHeight: 1.5 }}>
            EduCore couldn't confirm your enrollment in {department} right now, so this order was charged at full price.
            You can request a manual recheck afterward.
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

      {hasEligibleItem && (
        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 18, marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={claimDiscount} onChange={(e) => setClaimDiscount(e.target.checked)} />
            Claim department discount on eligible items
          </label>
          {claimDiscount && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12.5, color: "#8A8371", marginBottom: 6 }}>
                We'll verify your enrollment with EduCore before applying it.
              </div>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{ width: "100%", padding: "9px 10px", borderRadius: 4, border: `1px solid ${COLORS.line}`, fontSize: 14 }}
              >
                <option value="">Select department</option>
                {eligibleDepartments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 18, marginBottom: 20, fontSize: 14 }}>
        {cart.map((i) => (
          <Row key={i.product.id} label={`${i.product.name} × ${i.qty}`} value={`฿${i.product.price * i.qty}`} />
        ))}
      </div>

      <button
        disabled={status === "verifying" || (claimDiscount && !department)}
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
          opacity: claimDiscount && !department ? 0.5 : 1,
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

export default function StorefrontApp() {
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [view, setView] = useState("catalog"); // catalog | detail | checkout
  const [filter, setFilter] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const openProduct = (product) => {
    setSelectedProduct(product);
    setView("detail");
  };

  const categories = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
  const products = useMemo(
    () => (filter === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter)),
    [filter]
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
      <Header cartCount={cartCount} onCartClick={() => setCartOpen(true)} studentDept="Computer Science" />

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
              <ProductCard key={p.id} product={p} onAdd={addToCart} onOpen={openProduct} />
            ))}
          </div>
        </main>
      )}

      {view === "detail" && selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onBack={() => setView("catalog")}
          onAddToCart={(product, qty) => addToCart(product, qty)}
        />
      )}

      {view === "checkout" && (
        <CheckoutView
          cart={cart}
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

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onQtyChange={changeQty}
        onCheckout={() => {
          setCartOpen(false);
          setView("checkout");
        }}
      />
    </div>
  );
}
