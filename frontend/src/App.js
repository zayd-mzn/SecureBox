import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import LoadingSpinner from './components/LoadingSpinner';
import './styles/global.css';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const MyFiles = lazy(() => import('./pages/MyFiles'));
const SharedWithMe = lazy(() => import('./pages/SharedWithMe'));
const RecycleBin = lazy(() => import('./pages/RecycleBin'));
const VersionHistory = lazy(() => import('./pages/VersionHistory'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const ACLManagement = lazy(() => import('./pages/ACLManagement'));
const QuotaManagement = lazy(() => import('./pages/QuotaManagement'));
const Settings = lazy(() => import('./pages/Settings'));
const Search = lazy(() => import('./pages/Search'));
const Workspace = lazy(() => import('./pages/Workspace'));

// Protected Route Component - any authenticated user
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Admin Route Component - only global_admin
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  const userData = user ? JSON.parse(user) : null;
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  if (userData?.role !== 'global_admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Space Admin Route Component - allows global_admin and space_admin
const SpaceAdminRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  const userData = user ? JSON.parse(user) : null;
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  // Allow both global_admin and space_admin
  if (userData?.role !== 'global_admin' && userData?.role !== 'space_admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public Routes - No Layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected Routes with Layout */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/my-files" element={
            <ProtectedRoute>
              <MyFiles />
            </ProtectedRoute>
          } />
          <Route path="/shared-with-me" element={
            <ProtectedRoute>
              <SharedWithMe />
            </ProtectedRoute>
          } />
          <Route path="/recycle-bin" element={
            <ProtectedRoute>
              <RecycleBin />
            </ProtectedRoute>
          } />
          <Route path="/versions" element={
            <ProtectedRoute>
              <VersionHistory />
            </ProtectedRoute>
          } />
          
          {/* Activity Logs - All authenticated users (backend filters data by role) */}
          <Route path="/logs" element={
            <ProtectedRoute>
              <ActivityLogs />
            </ProtectedRoute>
          } />
          
                    {/* Workspace - All authenticated users (space_admin can create, users can join) */}
                    <Route path="/workspace" element={
                      <ProtectedRoute>
                        <Workspace />
                      </ProtectedRoute>
                    } />
                    
          {/* User Management - Global Admin only */}
          <Route path="/users" element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          } />
          
          {/* ACL Management - Global Admin and Space Admin */}
          <Route path="/acls" element={
            <SpaceAdminRoute>
              <ACLManagement />
            </SpaceAdminRoute>
          } />
          
          {/* Quota Management - Global Admin only */}
          <Route path="/quota" element={
            <AdminRoute>
              <QuotaManagement />
            </AdminRoute>
          } />
          
          {/* Settings - All authenticated users */}
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          
          {/* Search - All authenticated users */}
          <Route path="/search" element={
            <ProtectedRoute>
              <Search />
            </ProtectedRoute>
          } />
        </Route>
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;