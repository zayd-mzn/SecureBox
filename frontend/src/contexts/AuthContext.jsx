import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("access_token") || null;
  });

  const [userRole, setUserRole] = useState(() => {
    // Lire d'abord depuis user object, puis fallback sur user_role
    const saved = localStorage.getItem("user");
    if (saved) {
      const userData = JSON.parse(saved);
      return userData.role || localStorage.getItem("user_role") || "user";
    }
    return localStorage.getItem("user_role") || "user";
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("access_token");
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const savedUser = localStorage.getItem("user");
      const parsedUser = savedUser ? JSON.parse(savedUser) : null;
      setToken(localStorage.getItem("access_token"));
      setUser(parsedUser);
      setUserRole(parsedUser?.role || localStorage.getItem("user_role") || "user");
      setIsAuthenticated(!!localStorage.getItem("access_token"));
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (userData, jwtToken) => {
    const role = userData.role || "user";
    setUser(userData);
    setToken(jwtToken);
    setUserRole(role);  // ← mise à jour immédiate du rôle
    setIsAuthenticated(true);
    
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("access_token", jwtToken);
    localStorage.setItem("user_role", role);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setUserRole("user");
    setIsAuthenticated(false);
    
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      userRole, 
      isAuthenticated,
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}