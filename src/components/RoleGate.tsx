import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { tokenManager } from "@/lib/api";

interface RoleGateProps {
  allow: Array<"Borrower" | "Lender">;
  children: React.ReactNode;
}

const RoleGate: React.FC<RoleGateProps> = ({ allow, children }) => {
  const { user, loading } = useAuth();
  const hasToken = !!tokenManager.get();

  // Wait for auth hydration
  if (loading) return null;

  // If token exists but user not yet hydrated, avoid redirect loop
  if (!user && hasToken) {
    return null;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!allow.includes(user.role)) {
    toast.error("Access restricted for your role");
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleGate;
