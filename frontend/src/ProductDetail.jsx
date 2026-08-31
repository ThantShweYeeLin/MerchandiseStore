import React, { useState } from "react";
import { ChevronLeft, ShieldCheck, Minus, Plus, ShoppingBag } from "lucide-react";

/* ------------------------------------------------------------------ */
/* This is a PAGE component, not a page-fetching one. It receives a    */
/* product object as a prop and just displays it — the actual          */
/* GET /store/products/:id call happens wherever this gets rendered    */
/* from (see wiring notes at the bottom of this file).                 */
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

export default function ProductDetail({ product, onBack, onAddToCart }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // ProductImage rows from the ERD, one row per photo + sortOrder.
  // Falls back to a single placeholder slot if the product has no images.
  const images = product.images?.length
    ? product.images
    : [{ id: "placeholder", label: product.category }];

  const [activeImage, setActiveImage] = useState(0);

  const handleAdd = () => {
    onAddToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 28px" }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: COLORS.red,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
            marginBottom: 22,
          }}
        >
          <ChevronLeft size={16} /> Back to catalog
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 40 }}>
          {/* ── Gallery ─────────────────────────────────────────── */}
          <div>
            <div
              style={{
                height: 340,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDeep})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLORS.redSoft,
                fontSize: 14,
                letterSpacing: "0.04em",
                marginBottom: 10,
              }}
            >
              {images[activeImage]?.label ?? product.category}
            </div>
            {images.length > 1 && (
              <div style={{ display: "flex", gap: 8 }}>
                {images.map((img, i) => (
                  <button
                    key={img.id ?? i}
                    onClick={() => setActiveImage(i)}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 5,
                      border: `2px solid ${i === activeImage ? COLORS.red : COLORS.line}`,
                      background: `linear-gradient(135deg, ${COLORS.red}, ${COLORS.redDeep})`,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Info ────────────────────────────────────────────── */}
          <div>
            <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 6 }}>{product.category}</div>
            <div style={{ ...styles.display, fontSize: 28, fontWeight: 700, lineHeight: 1.15, marginBottom: 10 }}>
              {product.name}
            </div>

            {product.department && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: COLORS.redSoft,
                  color: COLORS.redDeep,
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "5px 11px",
                  borderRadius: 20,
                  marginBottom: 16,
                }}
              >
                <ShieldCheck size={13} />
                15% off for verified {product.department} students
              </div>
            )}

            <div style={{ ...styles.display, fontSize: 26, fontWeight: 700, marginBottom: 18 }}>
              ฿{product.price}
            </div>

            <div style={{ fontSize: 14.5, color: "#4A4438", lineHeight: 1.6, marginBottom: 22 }}>
              {product.blurb || product.description}
            </div>

            <div style={{ fontSize: 12.5, color: product.stock < 20 ? COLORS.redDeep : COLORS.muted, marginBottom: 20 }}>
              {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
              {product.stock > 0 && product.stock < 20 ? " — low stock" : ""}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${COLORS.line}`, borderRadius: 6 }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={stepBtn}>
                  <Minus size={14} />
                </button>
                <span style={{ width: 36, textAlign: "center", fontSize: 14 }}>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} style={stepBtn}>
                  <Plus size={14} />
                </button>
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted }}>
                Subtotal: <strong style={{ color: COLORS.ink }}>฿{product.price * qty}</strong>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={product.stock === 0}
              style={{
                width: "100%",
                background: added ? COLORS.ink : COLORS.red,
                color: COLORS.white,
                border: "none",
                padding: "13px 16px",
                borderRadius: 6,
                fontSize: 14.5,
                fontWeight: 700,
                cursor: product.stock === 0 ? "default" : "pointer",
                opacity: product.stock === 0 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ShoppingBag size={16} />
              {added ? "Added to cart" : "Add to cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const stepBtn = {
  width: 34,
  height: 34,
  border: "none",
  background: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: COLORS.ink,
};

/* ------------------------------------------------------------------ */
/* WIRING NOTES — how this plugs into StorefrontApp.jsx:                */
/*                                                                      */
/* 1. In StorefrontApp, add: const [selectedProduct, setSelected] =     */
/*    useState(null);                                                   */
/* 2. Give ProductCard an onClick that calls setSelected(product)       */
/*    (separate from its "Add to cart" button, which should keep        */
/*    adding directly without opening this page).                      */
/* 3. In the render, if (selectedProduct) return <ProductDetail          */
/*    product={selectedProduct} onBack={() => setSelected(null)}        */
/*    onAddToCart={(p, qty) => addToCart(p, qty)} /> instead of the      */
/*    catalog grid.                                                    */
/* ------------------------------------------------------------------ */
