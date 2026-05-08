/** Base pour les routes API (avec proxy CRA en développement, ou URL absolue si REACT_APP_API_URL). */
export function getApiFetchBase() {
  const raw = process.env.REACT_APP_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return null;
  return "http://localhost:4000/api";
}

/** Ex: path "/auth/login" → "/api/auth/login" ou "http://host/api/auth/login". */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiFetchBase();
  if (base === null) return `/api${p}`;
  return `${base}${p}`;
}

/** Pour les uploads / médias hors préfixe /api (Chemins comme "/uploads/..."). */
export function mediaUrl(uploadPath) {
  if (!uploadPath) return "";
  if (/^https?:\/\//i.test(uploadPath)) return uploadPath;
  const base = getApiFetchBase();
  if (base === null) return uploadPath;
  const origin = base.replace(/\/api$/, "");
  return `${origin}${uploadPath}`;
}
