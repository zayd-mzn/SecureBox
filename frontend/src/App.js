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

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Admin Route Component
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

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public Routes - No Layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
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
          <Route path="/logs" element={
            <AdminRoute>
              <ActivityLogs />
            </AdminRoute>
          } />
          <Route path="/users" element={
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          } />
          <Route path="/acls" element={
            <AdminRoute>
              <ACLManagement />
            </AdminRoute>
          } />
          <Route path="/quota" element={
            <AdminRoute>
              <QuotaManagement />
            </AdminRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
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