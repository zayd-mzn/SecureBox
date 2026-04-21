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
    return localStorage.getItem("user_role") || "user";
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("access_token");
  });

  useEffect(() => {
    // Sync state with localStorage on changes
    const handleStorageChange = () => {
      setToken(localStorage.getItem("access_token"));
      setUser(JSON.parse(localStorage.getItem("user")));
      setUserRole(localStorage.getItem("user_role") || "user");
      setIsAuthenticated(!!localStorage.getItem("access_token"));
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    setUserRole(userData.role || "user");
    setIsAuthenticated(true);
    
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("access_token", jwtToken);
    localStorage.setItem("user_role", userData.role || "user");
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