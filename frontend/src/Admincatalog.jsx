import React, { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Loader2, LayoutGrid, Tag } from "lucide-react";
import { API_BASE_URL } from "./config";

/* ------------------------------------------------------------------ */
/* API layer — real calls against the Express backend. The backend has  */
/* one flat Category per product (it doubles as the "department"       */
/* checked for a discount) — there's no separate department field.     */
/* ------------------------------------------------------------------ */

function authHeaders(token) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function fetchCategories(token) {
  const res = await fetch(`${API_BASE_URL}/categories`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load categories (${res.status})`);
  return res.json();
}

async function createCategory(name, token) {
  const res = await fetch(`${API_BASE_URL}/categories`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create category (${res.status})`);
  return res.json();
}

async function fetchProducts(token) {
  const res = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  return res.json();
}

// POST /products or PUT /products/:id — the AI description is generated
// automatically server-side on save, not on demand from the UI.
async function saveProduct(product, token) {
  const body = JSON.stringify({
    name: product.name,
    slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    price: Number(product.price),
    categoryId: product.categoryId,
    stock: Number(product.stock) || 0,
  });
  const res = await fetch(
    product.id ? `${API_BASE_URL}/products/${product.id}` : `${API_BASE_URL}/products`,
    { method: product.id ? "PUT" : "POST", headers: authHeaders(token), body }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save product (${res.status})`);
  }
  return res.json();
}

async function deleteProductApi(id, token) {
  const res = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete product (${res.status})`);
  }
}

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

const emptyForm = { id: null, name: "", categoryId: "", price: "", stock: "" };

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
          {product.description || <em>No AI description yet</em>}
        </div>
      </td>
      <td style={{ padding: "12px 14px", fontSize: 13 }}>
        <span style={{ background: COLORS.redSoft, color: COLORS.redDeep, fontSize: 11.5, padding: "3px 8px", borderRadius: 3, fontWeight: 600 }}>
          {product.categoryName}
        </span>
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

function ProductFormModal({ open, form, setForm, categories, onAddCategory, onClose, onSave, saving, saveError }) {
  if (!open) return null;
  const isEdit = Boolean(form.id);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleCategoryChange = async (e) => {
    if (e.target.value === "__new__") {
      const name = window.prompt("New category / department name (e.g. \"Business\")");
      if (name && name.trim()) {
        const category = await onAddCategory(name.trim());
        setForm((f) => ({ ...f, categoryId: category.id }));
      }
      return;
    }
    setForm({ ...form, categoryId: e.target.value });
  };

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

        <Field label="Category (also used as the department checked for a discount)">
          <select value={form.categoryId} onChange={handleCategoryChange} style={inputStyle}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="__new__">+ New category…</option>
          </select>
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Price (฿)" grow>
            <input type="number" value={form.price} onChange={update("price")} style={inputStyle} />
          </Field>
          <Field label="Stock" grow>
            <input type="number" value={form.stock} onChange={update("stock")} style={inputStyle} />
          </Field>
        </div>

        <div style={{ fontSize: 11.5, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5, background: COLORS.bg, padding: "8px 10px", borderRadius: 4 }}>
          The description isn't typed here — saving sends the name and category to the AI text-generation API, and the result is saved automatically (visible in the table after saving).
        </div>

        {saveError && (
          <div style={{ background: "#FBEAEC", color: COLORS.redDeep, fontSize: 12.5, padding: "9px 11px", borderRadius: 5, marginBottom: 14 }}>
            {saveError}
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!form.name || !form.price || !form.categoryId || saving}
          style={{
            width: "100%",
            background: COLORS.red,
            color: COLORS.white,
            border: "none",
            padding: "12px 16px",
            borderRadius: 5,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: !form.name || !form.price || !form.categoryId || saving ? "default" : "pointer",
            opacity: !form.name || !form.price || !form.categoryId ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {saving ? (
            <>
              <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              Saving…
            </>
          ) : isEdit ? (
            "Save changes"
          ) : (
            "Add product"
          )}
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

export default function AdminCatalog({ token }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const productsWithCategoryName = useMemo(
    () => products.map((p) => ({ ...p, categoryName: p.category?.name ?? categoryById.get(p.categoryId) ?? "—" })),
    [products, categoryById]
  );

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [cats, prods] = await Promise.all([fetchCategories(token), fetchProducts(token)]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(
    () => (categoryFilter === "All" ? productsWithCategoryName : productsWithCategoryName.filter((p) => p.categoryName === categoryFilter)),
    [productsWithCategoryName, categoryFilter]
  );

  const openNew = () => {
    setForm(emptyForm);
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setForm({ id: product.id, name: product.name, categoryId: product.category?.id ?? product.categoryId, price: product.price, stock: product.stock });
    setSaveError(null);
    setModalOpen(true);
  };

  const handleAddCategory = async (name) => {
    const category = await createCategory(name, token);
    setCategories((prev) => [...prev, category]);
    return category;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveProduct(form, token);
      setModalOpen(false);
      await loadAll(); // re-fetch so the table reflects the AI-generated description too
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProductApi(id, token);
      await loadAll();
    } catch (err) {
      setLoadError(err.message);
    }
  };

  const categoryNames = ["All", ...new Set(categories.map((c) => c.name))];

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

        {loadError && (
          <div style={{ background: "#FBEAEC", color: COLORS.redDeep, padding: "12px 14px", borderRadius: 5, marginBottom: 18, fontSize: 13.5 }}>
            {loadError} — is the backend running on {`localhost:3000`}?
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {categoryNames.map((c) => (
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
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
              <LayoutGrid size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>No products in this category yet.</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.line}` }}>
                  <Th>Product</Th>
                  <Th><Tag size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Category / department</Th>
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
        categories={categories}
        onAddCategory={handleAddCategory}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        saving={saving}
        saveError={saveError}
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
