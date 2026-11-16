import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import { ensureUserDocument } from '../services/authService';
import { updatePresence } from '../services/userService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setLoading(false);
      return;
    }

    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
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

      const userRef = doc(db, 'users', user.uid);
      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile({ uid: snapshot.id, id: snapshot.id, ...snapshot.data() });
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error('Error escuchando perfil:', error);
          setLoading(false);
        }
      );
    });

    return () => {
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

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
        isAdmin: userProfile?.role === 'admin',
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
