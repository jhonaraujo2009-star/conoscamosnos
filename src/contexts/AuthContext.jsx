import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import { DEFAULT_LIVE_ECONOMY, subscribeEconomyConfig } from '../services/adminService';
import { ensureUserDocument } from '../services/authService';
import { updatePresence } from '../services/userService';

const AuthContext = createContext(null);

export function isSuperAdminRole(role) {
  return role === 'SUPER_ADMIN' || role === 'admin';
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [economyConfig, setEconomyConfig] = useState(DEFAULT_LIVE_ECONOMY);
  const [loading, setLoading] = useState(true);
  const sessionSeqRef = useRef(0);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setLoading(false);
      return;
    }

    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const seq = ++sessionSeqRef.current;

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setFirebaseUser(user);
      setUserProfile(null);

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await ensureUserDocument(user);
      } catch (err) {
        console.error('Error asegurando documento de usuario:', err);
      }

      // Evitar condiciones de carrera si el usuario cambió o cerró sesión durante ensureUserDocument
      if (seq !== sessionSeqRef.current) return;

      const userRef = doc(db, 'users', user.uid);
      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (seq !== sessionSeqRef.current) return;
          if (snapshot.exists()) {
            setUserProfile({ uid: snapshot.id, id: snapshot.id, ...snapshot.data() });
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        },
        (error) => {
          if (seq !== sessionSeqRef.current) return;
          console.error('Error escuchando perfil:', error);
          setLoading(false);
        }
      );
    });

    return () => {
      sessionSeqRef.current += 1;
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Heartbeat de presencia en tiempo real
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || !isFirebaseConfigured) return;

    updatePresence(uid, true);

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence(uid, true);
      }
    }, 90 * 1000);

    const handleVisibility = () => {
      updatePresence(uid, document.visibilityState === 'visible');
    };

    const handlePageHide = () => {
      updatePresence(uid, false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [firebaseUser?.uid]);

  // Suscripción en tiempo real a precios globales de diamantes/paquetes (appConfig/economy)
  useEffect(() => {
    if (!firebaseUser?.uid || !isFirebaseConfigured) {
      setEconomyConfig(DEFAULT_LIVE_ECONOMY);
      return;
    }
    const unsub = subscribeEconomyConfig(setEconomyConfig);
    return () => unsub();
  }, [firebaseUser?.uid]);

  const isSuperAdmin = isSuperAdminRole(userProfile?.role);
  const isBanned = Boolean(
    userProfile?.isBanned ||
      userProfile?.accountStatus === 'banned' ||
      userProfile?.accountStatus === 'suspended'
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        economyConfig,
        loading,
        isAdmin: isSuperAdmin,
        isSuperAdmin,
        isBanned,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
