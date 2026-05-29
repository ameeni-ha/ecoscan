const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

export async function apiRequest(path, { method = "GET", token, body } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Une erreur est survenue");
  }
  return data;
}

