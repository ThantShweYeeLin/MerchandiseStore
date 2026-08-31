import React, { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Sparkles, Loader2, LayoutGrid, Tag } from "lucide-react";

/* ------------------------------------------------------------------ */
/* API layer — stand-ins for the real backend endpoints.               */
/* Swap these for real fetch() calls once the Express API is live.     */
/* ------------------------------------------------------------------ */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// GET /store/categories
async function fetchCategories() {
  await wait(200);
  return CATEGORIES;
}

// POST /store/products  or  PUT /store/products/:id
async function saveProduct(product) {
  await wait(400);
  return { ...product, id: product.id ?? `p${Math.random().toString(36).slice(2, 8)}` };
}

// DELETE /store/products/:id
async function deleteProductApi(id) {
  await wait(300);
  return { id };
}

// POST /store/products/:id/generate-description
// Backend sends {name, category} to the third-party AI text-gen API and
// returns an SEO-friendly description, which gets saved on the Product row.
async function generateDescription({ name, category }) {
  await wait(900);
  if (!name) return "";
  return `Show your ${category ? category.toLowerCase() + " " : ""}pride with the official ${name}. Crafted for everyday campus wear, it's built to last through classes, events, and everything in between.`;
}

/* ------------------------------------------------------------------ */
/* Mock starting data — stand-in for GET /store/products               */
/* ------------------------------------------------------------------ */

const CATEGORIES = ["Apparel", "Drinkware", "Bags", "Stationery"];

const INITIAL_PRODUCTS = [
  { id: "p1", name: "Assumption University Hoodie", category: "Apparel", department: "", price: 890, stock: 42, description: "Heavyweight fleece, embroidered crest." },
  { id: "p2", name: "CS Dept. Zip Jacket", category: "Apparel", department: "Computer Science", price: 1290, stock: 18, description: "Windbreaker shell, department discount eligible." },
  { id: "p3", name: "Engineering Faculty Mug", category: "Drinkware", department: "Engineering", price: 220, stock: 120, description: "Ceramic, dishwasher safe, faculty seal." },
];

const DEPARTMENTS = ["", "Computer Science", "Engineering", "Business Administration", "Nursing", "Architecture"];

/* ------------------------------------------------------------------ */
/* Design tokens — matches the storefront's red/white scheme            */
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
  app: {
    fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
    background: COLORS.bg,
    color: COLORS.ink,
    minHeight: "100%",
  },
  display: {
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  },
};

const emptyForm = { id: null, name: "", category: CATEGORIES[0], department: "", price: "", stock: "", description: "" };

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Header({ productCount }) {
  return (
    <header
      style={{
        background: COLORS.red,
        color: COLORS.white,
        padding: "18px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `3px solid ${COLORS.redDeep}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: `2px solid ${COLORS.white}`,
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
            Catalog Admin
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.8 }}>
            Signed in as staff · MerchStoreStaff
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, opacity: 0.9 }}>{productCount} products</div>
    </header>
  );
}

function ProductRow({ product, onEdit, onDelete }) {
  return (
    <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
      <td style={{ padding: "12px 14px" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
        <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 2, maxWidth: 320 }}>
          {product.description}
        </div>
      </td>
      <td style={{ padding: "12px 14px", fontSize: 13 }}>{product.category}</td>
      <td style={{ padding: "12px 14px", fontSize: 13 }}>
        {product.department ? (
          <span style={{ background: COLORS.redSoft, color: COLORS.redDeep, fontSize: 11.5, padding: "3px 8px", borderRadius: 3, fontWeight: 600 }}>
            {product.department}
          </span>
        ) : (
          <span style={{ color: COLORS.muted }}>—</span>
        )}
      </td>
      <td style={{ padding: "12px 14px", fontSize: 13, ...styles.display, fontWeight: 700 }}>฿{product.price}</td>
      <td style={{ padding: "12px 14px", fontSize: 13 }}>
        <span style={{ color: product.stock < 20 ? COLORS.redDeep : COLORS.ink, fontWeight: product.stock < 20 ? 700 : 400 }}>
          {product.stock}
        </span>
      </td>
      <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
        <button onClick={() => onEdit(product)} style={iconBtn} title="Edit">
          <Pencil size={15} />
        </button>
        <button onClick={() => onDelete(product.id)} style={{ ...iconBtn, color: COLORS.redDeep }} title="Delete">
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

const iconBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 6,
  marginLeft: 4,
  color: COLORS.ink,
  display: "inline-flex",
};

function ProductFormModal({ open, form, setForm, onClose, onSave, generating, onGenerateDescription }) {
  if (!open) return null;
  const isEdit = Boolean(form.id);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(32,38,47,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}
      onClick={onClose}
    >
      <div
        style={{ background: COLORS.white, borderRadius: 8, width: 480, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", padding: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ ...styles.display, fontSize: 20, fontWeight: 700 }}>
            {isEdit ? "Edit product" : "New product"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <Field label="Product name">
          <input value={form.name} onChange={update("name")} placeholder="e.g. CS Dept. Zip Jacket" style={inputStyle} />
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Category" grow>
            <select value={form.category} onChange={update("category")} style={inputStyle}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Department (optional)" grow>
            <select value={form.department} onChange={update("department")} style={inputStyle}>
              {DEPARTMENTS.map((d) => (
                <option key={d || "none"} value={d}>{d || "None"}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Price (฿)" grow>
            <input type="number" value={form.price} onChange={update("price")} style={inputStyle} />
          </Field>
          <Field label="Stock" grow>
            <input type="number" value={form.stock} onChange={update("stock")} style={inputStyle} />
          </Field>
        </div>

        <Field
          label="Description"
          action={
            <button
              onClick={onGenerateDescription}
              disabled={generating || !form.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                color: !form.name ? COLORS.muted : COLORS.red,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: !form.name ? "default" : "pointer",
                padding: 0,
              }}
            >
              {generating ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
              {generating ? "Generating…" : "Generate with AI"}
            </button>
          }
        >
          <textarea
            value={form.description}
            onChange={update("description")}
            rows={3}
            placeholder="Describe the product, or generate one from the name + category"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </Field>
        <div style={{ fontSize: 11.5, color: COLORS.muted, marginTop: -8, marginBottom: 16 }}>
          Sends the product name and category to the AI text-generation API and fills this field with the result.
        </div>

        <button
          onClick={onSave}
          disabled={!form.name || !form.price}
          style={{
            width: "100%",
            background: COLORS.red,
            color: COLORS.white,
            border: "none",
            padding: "12px 16px",
            borderRadius: 5,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: !form.name || !form.price ? "default" : "pointer",
            opacity: !form.name || !form.price ? 0.5 : 1,
          }}
        >
          {isEdit ? "Save changes" : "Add product"}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function Field({ label, children, action, grow }) {
  return (
    <div style={{ marginBottom: 14, flex: grow ? 1 : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label style={{ fontSize: 12.5, color: COLORS.muted, fontWeight: 600 }}>{label}</label>
        {action}
      </div>
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

/* ------------------------------------------------------------------ */
/* Root component                                                       */
/* ------------------------------------------------------------------ */

export default function AdminCatalog() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [generating, setGenerating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const filtered = useMemo(
    () => (categoryFilter === "All" ? products : products.filter((p) => p.category === categoryFilter)),
    [products, categoryFilter]
  );

  const openNew = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setForm(product);
    setModalOpen(true);
  };

  const handleGenerateDescription = async () => {
    setGenerating(true);
    const description = await generateDescription({ name: form.name, category: form.category });
    setForm((f) => ({ ...f, description }));
    setGenerating(false);
  };

  const handleSave = async () => {
    const saved = await saveProduct({ ...form, price: Number(form.price), stock: Number(form.stock) || 0 });
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
    });
    setModalOpen(false);
  };

  const handleDelete = async (id) => {
    await deleteProductApi(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div style={styles.app}>
      <Header productCount={products.length} />

      <main style={{ padding: "26px 32px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ ...styles.display, fontSize: 24, fontWeight: 700 }}>Product catalog</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
              Create and manage listings. Changes are recorded in the audit log.
            </div>
          </div>
          <button
            onClick={openNew}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: COLORS.red,
              color: COLORS.white,
              border: "none",
              padding: "10px 16px",
              borderRadius: 5,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus size={16} /> New product
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              style={{
                padding: "6px 13px",
                borderRadius: 20,
                border: `1px solid ${categoryFilter === c ? COLORS.red : COLORS.line}`,
                background: categoryFilter === c ? COLORS.red : COLORS.white,
                color: categoryFilter === c ? COLORS.white : COLORS.ink,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 8, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
              <LayoutGrid size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>No products in this category yet.</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.line}` }}>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th><Tag size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Department</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <ProductRow key={p.id} product={p} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      <ProductFormModal
        open={modalOpen}
        form={form}
        setForm={setForm}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        generating={generating}
        onGenerateDescription={handleGenerateDescription}
      />
    </div>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th style={{ padding: "10px 14px", fontSize: 11.5, textTransform: "none", color: COLORS.muted, fontWeight: 600, textAlign: align }}>
      {children}
    </th>
  );
}
