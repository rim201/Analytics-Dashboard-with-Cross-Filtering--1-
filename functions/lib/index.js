"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAuthUser = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
const RESERVED_ADMIN_EMAIL = "admin@leoni.tn";
/**
 * Supprime un utilisateur Firebase Auth + document `userProfiles/{uid}`.
 * Appelable uniquement par un profil dont `role === "admin"`.
 */
exports.deleteAuthUser = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentification requise.");
    }
    const uid = request.data?.uid;
    if (typeof uid !== "string" || !uid.trim()) {
        throw new https_1.HttpsError("invalid-argument", "Paramètre uid manquant.");
    }
    if (uid === request.auth.uid) {
        throw new https_1.HttpsError("invalid-argument", "Impossible de supprimer votre propre compte depuis cette action.");
    }
    const callerSnap = await admin.firestore().doc(`userProfiles/${request.auth.uid}`).get();
    if (callerSnap.get("role") !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Réservé aux administrateurs.");
    }
    const targetRef = admin.firestore().doc(`userProfiles/${uid}`);
    const targetSnap = await targetRef.get();
    if (targetSnap.exists) {
        const email = String(targetSnap.get("email") ?? "").toLowerCase();
        if (email === RESERVED_ADMIN_EMAIL.toLowerCase()) {
            throw new https_1.HttpsError("permission-denied", "Ce compte administrateur ne peut pas être supprimé.");
        }
    }
    try {
        await admin.auth().deleteUser(uid);
    }
    catch (e) {
        const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
        if (code !== "auth/user-not-found") {
            throw new https_1.HttpsError("internal", "Échec de la suppression dans Authentication.");
        }
    }
    if (targetSnap.exists) {
        await targetRef.delete();
    }
    return { ok: true };
});
//# sourceMappingURL=index.js.map