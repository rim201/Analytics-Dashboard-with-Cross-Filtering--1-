import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();

const RESERVED_ADMIN_EMAIL = "admin@leoni.tn";

/**
 * Supprime un utilisateur Firebase Auth + document `userProfiles/{uid}`.
 * Appelable uniquement par un profil dont `role === "admin"`.
 */
export const deleteAuthUser = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }

  const uid = request.data?.uid;
  if (typeof uid !== "string" || !uid.trim()) {
    throw new HttpsError("invalid-argument", "Paramètre uid manquant.");
  }

  if (uid === request.auth.uid) {
    throw new HttpsError(
      "invalid-argument",
      "Impossible de supprimer votre propre compte depuis cette action.",
    );
  }

  const callerSnap = await admin.firestore().doc(`userProfiles/${request.auth.uid}`).get();
  if (callerSnap.get("role") !== "admin") {
    throw new HttpsError("permission-denied", "Réservé aux administrateurs.");
  }

  const targetRef = admin.firestore().doc(`userProfiles/${uid}`);
  const targetSnap = await targetRef.get();

  if (targetSnap.exists) {
    const email = String(targetSnap.get("email") ?? "").toLowerCase();
    if (email === RESERVED_ADMIN_EMAIL.toLowerCase()) {
      throw new HttpsError("permission-denied", "Ce compte administrateur ne peut pas être supprimé.");
    }
  }

  try {
    await admin.auth().deleteUser(uid);
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code !== "auth/user-not-found") {
      throw new HttpsError("internal", "Échec de la suppression dans Authentication.");
    }
  }

  if (targetSnap.exists) {
    await targetRef.delete();
  }

  return { ok: true };
});
