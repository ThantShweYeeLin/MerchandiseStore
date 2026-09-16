import React, { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Loader2, LayoutGrid, Tag, Sparkles, Search, ClipboardList } from "lucide-react";
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load categories (${res.status})`);
  }
  return res.json();
}

async function createCategory(name, token) {
  const res = await fetch(`${API_BASE_URL}/categories`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create category (${res.status})`);
  }
  return res.json();
}

async function fetchProducts(token) {
  const res = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load products (${res.status})`);
  }
  return res.json();
}

// POST /products or PUT /products/:id — description is whatever's in the
// form (typed, generated, or both), not auto-generated server-side.
async function saveProduct(product, token) {
  const body = JSON.stringify({
    name: product.name,
    slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    price: Number(product.price),
    categoryId: product.categoryId,
    stock: Number(product.stock) || 0,
    description: product.description || "",
    imageUrl: product.imageUrl || "",
    // Required — the backend rejects a create/edit with no discountRate.
    discountRate: product.discountRate === "" || product.discountRate == null ? "" : Number(product.discountRate) / 100,
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

// POST /ai/generate-description — drafts on demand when staff click
// "Generate" in the form; calling it again returns a fresh draft (the
// model's wording varies call to call), and the result is only a starting
// point — staff can edit it freely before saving.
async function generateDescription(name, categoryName, token) {
  const res = await fetch(`${API_BASE_URL}/ai/generate-description`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name, categoryName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to generate description (${res.status})`);
  }
  const data = await res.json();
  return data.description;
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

// ADMIN only — user role/department management.
const ROLES = ["STUDENT", "STAFF", "ADMIN"];

async function fetchUsers(token) {
  const res = await fetch(`${API_BASE_URL}/admin/users`, { headers: authHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load users (${res.status})`);
  }
  return res.json();
}

async function updateUserRole(id, role, token) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${id}/role`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update role (${res.status})`);
  }
  return res.json();
}

async function updateUserDepartment(id, department, token) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${id}/department`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ department }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update department (${res.status})`);
  }
  return res.json();
}

// STAFF sees orders containing at least one item from their own department;
// ADMIN sees every order (see GET /orders on the backend for the scoping).
async function fetchOrders(token) {
  const res = await fetch(`${API_BASE_URL}/orders`, { headers: authHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load orders (${res.status})`);
  }
  return res.json();
}

const ORDER_STATUSES = ["PENDING", "READY_FOR_PICKUP", "PAID", "CANCELLED"];

async function updateOrderStatus(orderId, status, token) {
  const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update order status (${res.status})`);
  }
  return res.json();
}

// ADMIN only: the audit trail — who did what, and when.
async function fetchAuditLog(token) {
  const res = await fetch(`${API_BASE_URL}/admin/audit-log`, { headers: authHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load audit log (${res.status})`);
  }
  return res.json();
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
    minHeight: "100svh",
  },
  display: {
    fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  },
};

const emptyForm = { id: null, name: "", categoryId: "", price: "", stock: "", description: "", imageUrl: "", discountRate: "" };

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Header({ productCount, role }) {
  return (
    <header
      style={{
        background: COLORS.red,
        color: COLORS.white,
        padding: "18px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        borderBottom: `3px solid ${COLORS.redDeep}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
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
            Catalog {role === "ADMIN" ? "Admin" : "Staff"}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.8 }}>
            Signed in as {role === "ADMIN" ? "admin" : "staff"}
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

function ProductFormModal({ open, form, setForm, categories, onAddCategory, onClose, onSave, saving, saveError, token }) {
  // Hooks must run unconditionally on every render, so the `open` early
  // return happens after all of them, not before.
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryError, setNewCategoryError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  if (!open) return null;
  const isEdit = Boolean(form.id);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const canGenerate = Boolean(form.name.trim() && selectedCategory && !generating);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      // Calling this again (once a description already exists) intentionally
      // asks for a fresh draft rather than reusing the last one — the model's
      // wording varies call to call.
      const description = await generateDescription(form.name.trim(), selectedCategory.name, token);
      setForm((f) => ({ ...f, description }));
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCategoryChange = (e) => {
    if (e.target.value === "__new__") {
      setAddingCategory(true);
      setNewCategoryError(null);
      return;
    }
    setForm({ ...form, categoryId: e.target.value });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    setNewCategoryError(null);
    try {
      const category = await onAddCategory(newCategoryName.trim());
      setForm((f) => ({ ...f, categoryId: category.id }));
      setAddingCategory(false);
      setNewCategoryName("");
    } catch (err) {
      setNewCategoryError(err.message);
    } finally {
      setCreatingCategory(false);
    }
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

        {addingCategory && (
          <div style={{ display: "flex", gap: 8, marginTop: -8, marginBottom: 14 }}>
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
              placeholder='e.g. "Business"'
              style={{ ...inputStyle, flexGrow: 1 }}
            />
            <button
              onClick={handleCreateCategory}
              disabled={creatingCategory || !newCategoryName.trim()}
              style={{
                background: COLORS.red,
                color: COLORS.white,
                border: "none",
                borderRadius: 5,
                padding: "0 16px",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: creatingCategory || !newCategoryName.trim() ? "default" : "pointer",
                opacity: !newCategoryName.trim() ? 0.5 : 1,
              }}
            >
              {creatingCategory ? "…" : "Create"}
            </button>
            <button
              onClick={() => { setAddingCategory(false); setNewCategoryName(""); setNewCategoryError(null); }}
              style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", padding: "0 6px" }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {newCategoryError && (
          <div style={{ background: "#FBEAEC", color: COLORS.redDeep, fontSize: 12, padding: "8px 10px", borderRadius: 5, marginTop: -8, marginBottom: 14 }}>
            {newCategoryError}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Price (฿)" grow>
            <input type="number" value={form.price} onChange={update("price")} style={inputStyle} />
          </Field>
          <Field label="Stock" grow>
            <input type="number" value={form.stock} onChange={update("stock")} style={inputStyle} />
          </Field>
        </div>

        <Field label="Image URL (optional)">
          <input
            value={form.imageUrl}
            onChange={update("imageUrl")}
            placeholder="https://... — leave blank to show the default department placeholder"
            style={inputStyle}
          />
        </Field>
        {form.imageUrl && (
          <div style={{ marginBottom: 14 }}>
            <img
              src={form.imageUrl}
              alt="Preview"
              style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 6, border: `1px solid ${COLORS.line}` }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
              onLoad={(e) => {
                e.target.style.display = "block";
              }}
            />
          </div>
        )}

        <Field label="Discount % for verified same-department students">
          <input
            type="number"
            min="0"
            max="100"
            value={form.discountRate}
            onChange={update("discountRate")}
            placeholder="e.g. 15"
            style={inputStyle}
          />
        </Field>

        <Field
          label="Description"
          action={
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              title={!selectedCategory ? "Pick a category first" : !form.name.trim() ? "Type a product name first" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                color: COLORS.red,
                fontSize: 12,
                fontWeight: 700,
                cursor: canGenerate ? "pointer" : "default",
                opacity: canGenerate ? 1 : 0.5,
                padding: 0,
              }}
            >
              {generating ? (
                <>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  {form.description ? "Regenerate" : "Generate"}
                </>
              )}
            </button>
          }
        >
          <textarea
            value={form.description}
            onChange={update("description")}
            placeholder="Click Generate for an AI-drafted description, or type your own"
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </Field>

        {generateError && (
          <div style={{ background: "#FBEAEC", color: COLORS.redDeep, fontSize: 12, padding: "8px 10px", borderRadius: 5, marginTop: -8, marginBottom: 14 }}>
            {generateError}
          </div>
        )}

        {saveError && (
          <div style={{ background: "#FBEAEC", color: COLORS.redDeep, fontSize: 12.5, padding: "9px 11px", borderRadius: 5, marginBottom: 14 }}>
            {saveError}
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!form.name || !form.price || !form.categoryId || form.discountRate === "" || saving}
          style={{
            width: "100%",
            background: COLORS.red,
            color: COLORS.white,
            border: "none",
            padding: "12px 16px",
            borderRadius: 5,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: !form.name || !form.price || !form.categoryId || form.discountRate === "" || saving ? "default" : "pointer",
            opacity: !form.name || !form.price || !form.categoryId || form.discountRate === "" ? 0.5 : 1,
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

function UsersPanel({ token, categories }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [rowError, setRowError] = useState({});
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await fetchUsers(token));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRoleChange = async (user, role) => {
    setSavingId(user.id);
    setRowError((e) => ({ ...e, [user.id]: null }));
    try {
      const updated = await updateUserRole(user.id, role, token);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      setRowError((e) => ({ ...e, [user.id]: err.message }));
    } finally {
      setSavingId(null);
    }
  };

  const handleDepartmentChange = async (user, department) => {
    if (!department) return; // backend requires a non-empty department
    setSavingId(user.id);
    setRowError((e) => ({ ...e, [user.id]: null }));
    try {
      const updated = await updateUserDepartment(user.id, department, token);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      setRowError((e) => ({ ...e, [user.id]: err.message }));
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) => u.displayName.toLowerCase().includes(query));
  }, [users, search]);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...styles.display, fontSize: 24, fontWeight: 700 }}>Users</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
          Assign roles and departments. For a STUDENT, setting this field here is trusted
          directly as a verified department and skips the EduCore check at checkout for it —
          any other department they order from still goes through EduCore as normal.
        </div>
      </div>

      {loadError && (
        <div style={{ background: "#FBEAEC", color: COLORS.redDeep, padding: "12px 14px", borderRadius: 5, marginBottom: 18, fontSize: 13.5 }}>
          {loadError}
        </div>
      )}

      <div style={{ position: "relative", maxWidth: 320, marginBottom: 16 }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }} />
        <input
          id="users-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          style={{ ...inputStyle, paddingLeft: 32 }}
        />
      </div>

      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 8, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>No users yet.</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
            No users match your search.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.line}` }}>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Department</Th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName}</div>
                      <div style={{ fontSize: 12.5, color: COLORS.muted }}>{u.email}</div>
                      {rowError[u.id] && (
                        <div style={{ fontSize: 11.5, color: COLORS.redDeep, marginTop: 4 }}>{rowError[u.id]}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <select
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        style={{ ...inputStyle, width: "auto" }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <select
                        value={u.department || ""}
                        disabled={savingId === u.id}
                        onChange={(e) => handleDepartmentChange(u, e.target.value)}
                        style={{ ...inputStyle, width: "auto" }}
                      >
                        <option value="">— none —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function OrdersPanel({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [rowError, setRowError] = useState({});
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        setOrders(await fetchOrders(token));
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleStatusChange = async (order, status) => {
    setSavingId(order.id);
    setRowError((e) => ({ ...e, [order.id]: null }));
    try {
      const updated = await updateOrderStatus(order.id, status, token);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: updated.status } : o)));
    } catch (err) {
      setRowError((e) => ({ ...e, [order.id]: err.message }));
    } finally {
      setSavingId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
      const matchesSearch = !query || o.user.displayName.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, search]);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...styles.display, fontSize: 24, fontWeight: 700 }}>Orders</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
          Staff see orders with at least one item from their own department; admins see every order.
        </div>
      </div>

      {loadError && (
        <div style={{ background: "#FBEAEC", color: COLORS.redDeep, padding: "12px 14px", borderRadius: 5, marginBottom: 18, fontSize: 13.5 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }} />
          <input
            id="orders-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <SectionTab active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>
            All
          </SectionTab>
          {ORDER_STATUSES.map((s) => (
            <SectionTab key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s.replace(/_/g, " ")}
            </SectionTab>
          ))}
        </div>
      </div>

      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 8, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
            No orders yet{token ? " for your department" : ""}.
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
            No orders match your search or filter.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.line}` }}>
                  <Th>Student</Th>
                  <Th>Items</Th>
                  <Th>Total</Th>
                  <Th>Discount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{o.user.displayName}</div>
                      <div style={{ fontSize: 12.5, color: COLORS.muted }}>{o.user.email}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13 }}>
                      {o.items.map((i) => `${i.product.name} × ${i.quantity}`).join(", ")}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, ...styles.display, fontWeight: 700 }}>
                      ฿{o.totalAmount}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13 }}>
                      {o.discountApplied ? (
                        <span style={{ background: COLORS.redSoft, color: COLORS.redDeep, fontSize: 11.5, padding: "3px 8px", borderRadius: 3, fontWeight: 600 }}>
                          Yes
                        </span>
                      ) : (
                        <span style={{ color: COLORS.muted }}>No</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <select
                        value={o.status}
                        disabled={savingId === o.id}
                        onChange={(e) => handleStatusChange(o, e.target.value)}
                        style={{ ...inputStyle, width: "auto", fontSize: 12.5, padding: "5px 8px" }}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                      {rowError[o.id] && (
                        <div style={{ fontSize: 11, color: COLORS.redDeep, marginTop: 4 }}>{rowError[o.id]}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function AuditLogPanel({ token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [entityFilter, setEntityFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        setLogs(await fetchAuditLog(token));
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const entityTypes = useMemo(() => ["All", ...new Set(logs.map((l) => l.entityType))], [logs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((l) => {
      const matchesEntity = entityFilter === "All" || l.entityType === entityFilter;
      const matchesSearch =
        !query ||
        l.user.displayName.toLowerCase().includes(query) ||
        l.user.email.toLowerCase().includes(query) ||
        l.action.toLowerCase().includes(query);
      return matchesEntity && matchesSearch;
    });
  }, [logs, entityFilter, search]);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...styles.display, fontSize: 24, fontWeight: 700 }}>Audit log</div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
          A record of administrative and staff actions — product changes, order status updates,
          and account changes — together with who performed them and when. Most recent 200 entries.
        </div>
      </div>

      {loadError && (
        <div style={{ background: "#FBEAEC", color: COLORS.redDeep, padding: "12px 14px", borderRadius: 5, marginBottom: 18, fontSize: 13.5 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }} />
          <input
            id="audit-log-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or action…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {entityTypes.map((t) => (
            <SectionTab key={t} active={entityFilter === t} onClick={() => setEntityFilter(t)}>
              {t}
            </SectionTab>
          ))}
        </div>
      </div>

      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 8, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
            <ClipboardList size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>No actions recorded yet.</div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
            No entries match your search or filter.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.line}` }}>
                  <Th>Time</Th>
                  <Th>Performed by</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: "12px 14px", fontSize: 12.5, color: COLORS.muted, whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{log.user.displayName}</div>
                      <div style={{ fontSize: 12.5, color: COLORS.muted }}>{log.user.email}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: COLORS.redSoft, color: COLORS.redDeep, fontSize: 11.5, padding: "3px 8px", borderRadius: 3, fontWeight: 600 }}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12.5, color: COLORS.muted }}>
                      {log.entityType} · {log.entityId.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function SectionTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 16px",
        borderRadius: 20,
        border: `1px solid ${active ? COLORS.red : COLORS.line}`,
        background: active ? COLORS.red : COLORS.white,
        color: active ? COLORS.white : COLORS.ink,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Root component                                                       */
/* ------------------------------------------------------------------ */

export default function AdminCatalog({ token, role }) {
  const [section, setSection] = useState("catalog");
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
    setForm({
      id: product.id,
      name: product.name,
      categoryId: product.category?.id ?? product.categoryId,
      price: product.price,
      stock: product.stock,
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      discountRate: product.discountRate != null ? String(Math.round(product.discountRate * 100)) : "",
    });
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
      <Header productCount={products.length} role={role} />

      <main style={{ padding: "26px 32px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          <SectionTab active={section === "catalog"} onClick={() => setSection("catalog")}>Catalog</SectionTab>
          <SectionTab active={section === "orders"} onClick={() => setSection("orders")}>Orders</SectionTab>
          {role === "ADMIN" && (
            <SectionTab active={section === "users"} onClick={() => setSection("users")}>Users</SectionTab>
          )}
          {role === "ADMIN" && (
            <SectionTab active={section === "audit"} onClick={() => setSection("audit")}>Audit Log</SectionTab>
          )}
        </div>

        {section === "users" && role === "ADMIN" ? (
          <UsersPanel token={token} categories={categories} />
        ) : section === "audit" && role === "ADMIN" ? (
          <AuditLogPanel token={token} />
        ) : section === "orders" ? (
          <OrdersPanel token={token} />
        ) : (
          <>
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
                {loadError} — is the backend running at {API_BASE_URL}?
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
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
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
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
                </div>
              )}
            </div>
          </>
        )}
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
        token={token}
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
