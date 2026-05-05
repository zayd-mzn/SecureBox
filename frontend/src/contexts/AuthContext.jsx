import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user from localStorage on mount
    const storedToken = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("user");
    const storedRole = localStorage.getItem("user_role");
    
    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(parsedUser);
      // IMPORTANT: Use the role from the stored user object, not just storedRole
      const role = parsedUser.role || storedRole || "user";
      setUserRole(role);
      setIsAuthenticated(true);
      console.log("AuthProvider - Initialized with role:", role);
    }
    setLoading(false);
  }, []);

  const login = (userData, jwtToken) => {
    console.log("AuthContext login - User data:", userData);
    console.log("AuthContext login - User role:", userData.role);
    
    setUser(userData);
    setToken(jwtToken);
    const role = userData.role || "user";
    setUserRole(role);
    setIsAuthenticated(true);
    
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("access_token", jwtToken);
    localStorage.setItem("user_role", role);
    
    console.log("AuthContext login - Role set to:", role);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setUserRole("user");
    setIsAuthenticated(false);
    
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      userRole, 
      isAuthenticated,
      loading,
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