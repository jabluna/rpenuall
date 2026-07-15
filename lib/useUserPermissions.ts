"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type PermissionAction = "ver" | "crear" | "editar" | "eliminar";

export type PermissionModule =
  | "roles"
  | "usuarios"
  | "proveedoresBodega"
  | "clientes"
  | "inventarioEtiquetas";

export type Permissions = Partial<
  Record<PermissionModule | string, Partial<Record<PermissionAction, boolean>>>
>;

export type FirestoreUserProfile = {
  id: string;
  authUid?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  fotoUrl?: string;
  rolId?: string;
  rolNombre?: string;
  activo?: boolean;
};

export type FirestoreRole = {
  id: string;
  nombre?: string;
  permisos?: Permissions;
};

export function useUserPermissions() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FirestoreUserProfile | null>(null);
  const [role, setRole] = useState<FirestoreRole | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthUser(currentUser);
      setProfile(null);
      setRole(null);
      setPermissions({});
      setIsActive(false);

      if (!currentUser?.email) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const usersQuery = query(
          collection(db, "usuarios"),
          where("email", "==", currentUser.email.toLowerCase())
        );

        const usersSnap = await getDocs(usersQuery);

        if (usersSnap.empty) {
          setLoading(false);
          return;
        }

        const userDoc = usersSnap.docs[0];
        const userProfile = {
          id: userDoc.id,
          ...userDoc.data(),
        } as FirestoreUserProfile;

        setProfile(userProfile);

        const active = userProfile.activo !== false;
        setIsActive(active);

        if (!active || !userProfile.rolId) {
          setLoading(false);
          return;
        }

        const roleSnap = await getDoc(doc(db, "roles", userProfile.rolId));

        if (!roleSnap.exists()) {
          setLoading(false);
          return;
        }

        const userRole = {
          id: roleSnap.id,
          ...roleSnap.data(),
        } as FirestoreRole;

        setRole(userRole);
        setPermissions(userRole.permisos || {});
      } catch (error) {
        console.error("Error cargando permisos:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const can = useMemo(() => {
    return (module: PermissionModule | string, action: PermissionAction) => {
      return permissions?.[module]?.[action] === true;
    };
  }, [permissions]);

  const canView = useMemo(() => {
    return (module: PermissionModule | string) => can(module, "ver");
  }, [can]);

  return {
    authUser,
    profile,
    role,
    permissions,
    loading,
    isActive,
    can,
    canView,
  };
}
