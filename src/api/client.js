import { apiUrl } from "../utils/apiUrls";

export async function apiRequest(path, { method = "GET", token, body } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const isSerializedString = typeof body === "string";
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let bodyOut;
  if (!body) bodyOut = undefined;
  else if (isFormData) bodyOut = body;
  else if (isSerializedString) bodyOut = body;
  else bodyOut = JSON.stringify(body);

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    credentials: "include",
    body: bodyOut,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Une erreur est survenue");
  }
  return data;
}

