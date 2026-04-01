import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, userCreationAuth } from '../firebase';
import { db } from '../firebase';

export type AppRole = 'admin' | 'user' | 'technicien';

export const DEFAULT_ADMIN_EMAIL = 'admin@leoni.tn';
export const DEFAULT_ADMIN_PASSWORD = 'Superviseur***';

const PROFILES = 'userProfiles';

export type UserProfile = {
  name: string;
  email: string;
  role: AppRole;
  status: 'active' | 'inactive';
  /** True pour les comptes créés par l’admin : l’utilisateur doit choisir un mot de passe à la 1ʳᵉ connexion. */
  mustChangePassword: boolean;
};

function profileRef(uid: string) {
  return doc(db, PROFILES, uid);
}

export async function ensureDefaultAdminUser(): Promise<void> {
  const upsertAdminProfile = async (uid: string, email: string) => {
    await setDoc(
      profileRef(uid),
      {
        name: 'Administrateur',
        email,
        role: 'admin',
        status: 'active',
        mustChangePassword: false,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  };

  try {
    const cred = await signInWithEmailAndPassword(
      userCreationAuth,
      DEFAULT_ADMIN_EMAIL,
      DEFAULT_ADMIN_PASSWORD,
    );
    await upsertAdminProfile(cred.user.uid, cred.user.email ?? DEFAULT_ADMIN_EMAIL);
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        const created = await createUserWithEmailAndPassword(
          userCreationAuth,
          DEFAULT_ADMIN_EMAIL,
          DEFAULT_ADMIN_PASSWORD,
        );
        await upsertAdminProfile(created.user.uid, created.user.email ?? DEFAULT_ADMIN_EMAIL);
      } catch (createErr) {
        console.warn('ensureDefaultAdminUser:create:', createErr);
      }
    } else {
      console.warn('ensureDefaultAdminUser:signin:', e);
    }
  } finally {
    if (userCreationAuth.currentUser) {
      await signOut(userCreationAuth);
    }
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileRef(uid));
  if (!snap.exists()) return null;
  const x = snap.data();
  return {
    name: String(x.name ?? ''),
    email: String(x.email ?? ''),
    role: normalizeRole(x.role),
    status: x.status === 'inactive' ? 'inactive' : 'active',
    mustChangePassword: x.mustChangePassword === true,
  };
}

function normalizeRole(r: unknown): AppRole {
  if (r === 'admin' || r === 'user' || r === 'technicien') return r;
  return 'user';
}

/** Crée le profil Firestore si absent (ex. compte Auth existant sans doc). */
export async function ensureProfileAfterLogin(user: User): Promise<UserProfile> {
  const ref = profileRef(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const p = await fetchUserProfile(user.uid);
    if (p) return p;
  }

  const email = user.email ?? '';
  const role: AppRole = email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
  const profile: UserProfile = {
    name: email.split('@')[0] || 'Utilisateur',
    email,
    role,
    status: 'active',
    mustChangePassword: false,
  };
  await setDoc(ref, {
    ...profile,
    createdAt: Timestamp.now(),
  });
  return profile;
}

export async function signInWithCredentials(email: string, password: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureProfileAfterLogin(cred.user);
}

export async function signOutSession(): Promise<void> {
  await signOut(auth);
}

/** Après une connexion récente : nouveau mot de passe + fin du flux première connexion. */
export async function completeFirstLoginPasswordChange(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('auth/no-current-user');
  }
  await updatePassword(user, newPassword);
  await updateDoc(profileRef(user.uid), {
    mustChangePassword: false,
    updatedAt: Timestamp.now(),
  });
}

export function isLeoniDefaultAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();
}

export async function createUserWithProfile(
  email: string,
  password: string,
  profile: Omit<UserProfile, 'email' | 'mustChangePassword'> & { email?: string },
): Promise<string> {
  const emailTrim = email.trim().toLowerCase();
  const full: UserProfile = {
    name: profile.name.trim(),
    email: emailTrim,
    role: profile.role,
    status: profile.status,
    mustChangePassword: true,
  };

  const persistProfile = async (uid: string) => {
    await setDoc(
      profileRef(uid),
      {
        ...full,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  };

  try {
    const cred = await createUserWithEmailAndPassword(userCreationAuth, emailTrim, password);
    await persistProfile(cred.user.uid);
    await signOut(userCreationAuth);
    return cred.user.uid;
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';

    if (code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(userCreationAuth, emailTrim, password);
        await persistProfile(cred.user.uid);
        await signOut(userCreationAuth);
        return cred.user.uid;
      } catch (signErr) {
        await signOut(userCreationAuth).catch(() => {});
        const si =
          signErr && typeof signErr === 'object' && 'code' in signErr
            ? String((signErr as { code: string }).code)
            : '';
        if (
          si === 'auth/invalid-credential' ||
          si === 'auth/wrong-password' ||
          si === 'auth/user-not-found'
        ) {
          const err = new Error('AUTH_EXISTS_WRONG_PASSWORD');
          (err as { code: string }).code = 'AUTH_EXISTS_WRONG_PASSWORD';
          throw err;
        }
        throw signErr;
      }
    }

    throw e;
  }
}

export function createUserWithProfileErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    if (code === 'AUTH_EXISTS_WRONG_PASSWORD') {
      return 'Un compte Firebase existe déjà avec cet e-mail. Indiquez le bon mot de passe pour lier ou mettre à jour le profil.';
    }
    if (code === 'auth/weak-password') {
      return 'Mot de passe trop faible.';
    }
    if (code === 'auth/invalid-email') {
      return 'Adresse e-mail invalide.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Cet e-mail est déjà utilisé.';
    }
  }
  return 'Impossible de créer ou mettre à jour l’utilisateur.';
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'technicien':
      return 'Technicien';
    default:
      return 'Utilisateur';
  }
}

export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.';
    case 'auth/user-disabled':
      return 'Ce compte est désactivé.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou mot de passe incorrect.';
    case 'auth/requires-recent-login':
      return 'Session expirée : déconnectez-vous et reconnectez-vous pour changer le mot de passe.';
    default:
      return 'Connexion impossible. Réessayez.';
  }
}
