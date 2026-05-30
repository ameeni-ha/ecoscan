export function canUseScan(user) {
  return Boolean(user?.role !== "admin" && user?.accountType === "collecteur");
}

export function canForumComment(user) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "moderator") return true;
  return user.accountType === "collecteur" || user.accountType === "centre_de_collecte";
}

export function accountTypeLabel(at) {
  if (at === "centre_de_collecte") return "Centre";
  if (at === "collecteur") return "Collecteur";
  return "";
}
