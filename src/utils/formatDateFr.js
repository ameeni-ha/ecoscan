export function formatDateFr(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export function formatRelativeTime(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "à l'instant";
    if (diffMins < 60) return `il y a ${diffMins}m`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    
    return formatDateFr(isoString);
  } catch {
    return "";
  }
}
