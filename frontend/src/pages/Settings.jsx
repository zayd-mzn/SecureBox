/**
 * Settings.jsx - Enhanced SecureBox Settings Page
 * Features: Profile, MFA, Security, Preferences, Notifications, Privacy
 */

import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/Settings.css';
import axios from 'axios';

const Settings = () => {
  // Loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Profile State
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    avatar: null,
    hasAvatar: false
  });

  // Security State
  const [security, setSecurity] = useState({
    mfaEnabled: false,
    mfaMethod: 'totp',
    trustedDevices: 0,
    lastPasswordChange: ''
  });

  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: false,
    uploadSuccess: true,
    downloadActivity: false,
    shareRequests: true,
    storageWarnings: true,
    securityAlerts: true,
    weeklyDigest: false
  });

  // Privacy Settings
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'team',
    showEmail: false,
    showActivity: true,
    allowFileIndexing: true
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    language: 'en',
    theme: 'light',
    dateFormat: 'MM/DD/YYYY',
    timezone: 'America/New_York',
    defaultView: 'list',
    itemsPerPage: 25
  });

  // UI State
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Password Change State
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // MFA State
  const [mfaSetup, setMfaSetup] = useState({
    secret: '',
    provisioningUri: '',
    verificationCode: '',
    backupCodes: []
  });

  const API_URL = 'http://localhost:5000/api';

  // Load all settings on mount
  useEffect(() => {
    fetchAllSettings();
  }, []);

  const fetchAllSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch all settings in parallel
      const [profileRes, mfaRes, preferencesRes, notificationsRes, privacyRes] = await Promise.all([
        axios.get(`${API_URL}/settings/profile`, { headers }),
        axios.get(`${API_URL}/settings/mfa/status`, { headers }),
        axios.get(`${API_URL}/settings/preferences`, { headers }),
        axios.get(`${API_URL}/settings/notifications`, { headers }),
        axios.get(`${API_URL}/settings/privacy`, { headers })
      ]);
      
      // Set profile data
      if (profileRes.data) {
        setProfile({
          username: profileRes.data.username || '',
          email: profileRes.data.email || '',
          fullName: profileRes.data.full_name || '',
          phone: profileRes.data.phone || '',
          avatar: profileRes.data.avatar || null,
          hasAvatar: profileRes.data.has_avatar || false
        });
      }
      
      // Set MFA status
      if (mfaRes.data) {
        setSecurity(prev => ({
          ...prev,
          mfaEnabled: mfaRes.data.mfa_enabled || false,
          mfaMethod: mfaRes.data.mfa_method || 'totp'
        }));
      }
      
      // Set preferences
      if (preferencesRes.data) {
        setPreferences({
          language: preferencesRes.data.language || 'en',
          theme: preferencesRes.data.theme || 'light',
          dateFormat: preferencesRes.data.date_format || 'MM/DD/YYYY',
          timezone: preferencesRes.data.timezone || 'America/New_York',
          defaultView: preferencesRes.data.default_view || 'list',
          itemsPerPage: preferencesRes.data.items_per_page || 25
        });
        
        // Also set notification settings from preferences
        setNotifications({
          emailNotifications: preferencesRes.data.email_notifications ?? true,
          pushNotifications: preferencesRes.data.push_notifications ?? false,
          uploadSuccess: preferencesRes.data.upload_success ?? true,
          downloadActivity: preferencesRes.data.download_activity ?? false,
          shareRequests: preferencesRes.data.share_requests ?? true,
          storageWarnings: preferencesRes.data.storage_warnings ?? true,
          securityAlerts: preferencesRes.data.security_alerts ?? true,
          weeklyDigest: preferencesRes.data.weekly_digest ?? false
        });
        
        // Set privacy settings from preferences
        setPrivacy({
          profileVisibility: preferencesRes.data.profile_visibility || 'team',
          showEmail: preferencesRes.data.show_email ?? false,
          showActivity: preferencesRes.data.show_activity ?? true,
          allowFileIndexing: preferencesRes.data.allow_file_indexing ?? true
        });
      }
      
      // Set notification settings if separate endpoint
      if (notificationsRes.data) {
        setNotifications(prev => ({ ...prev, ...notificationsRes.data }));
      }
      
      // Set privacy settings if separate endpoint
      if (privacyRes.data) {
        setPrivacy(prev => ({ ...prev, ...privacyRes.data }));
      }
      
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (section) => {
    setSaving(true);
    setSaveMessage('');
    
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      let endpoint = '';
      let data = {};
      
      switch(section) {
        case 'profile':
          endpoint = `${API_URL}/settings/profile`;
          data = {
            username: profile.username,
            email: profile.email,
            full_name: profile.fullName,
            phone: profile.phone
          };
          break;
        case 'preferences':
          endpoint = `${API_URL}/settings/preferences`;
          data = preferences;
          break;
        case 'notifications':
          endpoint = `${API_URL}/settings/notifications`;
          data = notifications;
          break;
        case 'privacy':
          endpoint = `${API_URL}/settings/privacy`;
          data = privacy;
          break;
        default:
          return;
      }
      
      await axios.put(endpoint, data, { headers });
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveMessage(err.response?.data?.error || 'Failed to save settings');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      alert('New passwords do not match!');
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('access_token');
      await axios.put(`${API_URL}/settings/password`, {
        current_password: passwords.current,
        new_password: passwords.new,
        confirm_password: passwords.confirm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSaveMessage('Password changed successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setShowPasswordModal(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      console.error('Error changing password:', err);
      setSaveMessage(err.response?.data?.error || 'Failed to change password');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleMFASetup = async () => {
    // First, get MFA setup secret
    try {
      setSaving(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API_URL}/settings/mfa/setup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMfaSetup({
        ...mfaSetup,
        secret: response.data.secret,
        provisioningUri: response.data.provisioning_uri
      });
      
      // Show QR code modal (you would generate QR code from provisioning URI)
      setShowMFAModal(true);
    } catch (err) {
      console.error('Error setting up MFA:', err);
      setSaveMessage(err.response?.data?.error || 'Failed to setup MFA');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!mfaSetup.verificationCode) {
      alert('Please enter verification code');
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/settings/mfa/verify`, {
        verification_code: mfaSetup.verificationCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSecurity({ ...security, mfaEnabled: true });
      setSaveMessage('MFA enabled successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setShowMFAModal(false);
      setMfaSetup({ ...mfaSetup, verificationCode: '', secret: '', provisioningUri: '' });
    } catch (err) {
      console.error('Error verifying MFA:', err);
      setSaveMessage(err.response?.data?.error || 'Invalid verification code');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDisableMFA = async () => {
    if (window.confirm('Are you sure you want to disable Two-Factor Authentication?')) {
      try {
        setSaving(true);
        const token = localStorage.getItem('access_token');
        await axios.post(`${API_URL}/settings/mfa/disable`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setSecurity({ ...security, mfaEnabled: false });
        setSaveMessage('MFA disabled successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } catch (err) {
        console.error('Error disabling MFA:', err);
        setSaveMessage(err.response?.data?.error || 'Failed to disable MFA');
        setTimeout(() => setSaveMessage(''), 3000);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const avatarBase64 = reader.result;
        
        try {
          setSaving(true);
          const token = localStorage.getItem('access_token');
          await axios.post(`${API_URL}/avatar`, {
            avatar: avatarBase64,
            mime_type: file.type
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setProfile({ ...profile, avatar: avatarBase64, hasAvatar: true });
          setSaveMessage('Avatar updated successfully!');
          setTimeout(() => setSaveMessage(''), 3000);
        } catch (err) {
          console.error('Error uploading avatar:', err);
          setSaveMessage('Failed to upload avatar');
          setTimeout(() => setSaveMessage(''), 3000);
        } finally {
          setSaving(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/avatar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProfile({ ...profile, avatar: null, hasAvatar: false });
      setSaveMessage('Avatar removed successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Error removing avatar:', err);
      setSaveMessage('Failed to remove avatar');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/settings/export-data`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSaveMessage('Data export initiated. You will receive an email when ready.');
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err) {
      console.error('Error exporting data:', err);
      setSaveMessage('Failed to export data');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    const password = prompt('Please enter your password to confirm account deletion:');
    if (!password) return;
    
    if (window.confirm('Are you absolutely sure? This will permanently delete all your data and cannot be undone!')) {
      try {
        const token = localStorage.getItem('access_token');
        await axios.delete(`${API_URL}/settings/delete-account`, {
          data: { password },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Clear local storage and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        window.location.href = '/login';
      } catch (err) {
        console.error('Error deleting account:', err);
        setSaveMessage(err.response?.data?.error || 'Failed to delete account');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'fa-user' },
    { id: 'security', label: 'Security', icon: 'fa-shield-alt' },
    { id: 'notifications', label: 'Notifications', icon: 'fa-bell' },
    { id: 'privacy', label: 'Privacy', icon: 'fa-lock' },
    { id: 'preferences', label: 'Preferences', icon: 'fa-cog' }
  ];

  // Loading state
  if (loading) return <LoadingSpinner message="Loading settings..." />;

  // Error state
  if (error) return (
    <div className="error-container">
      <i className="fas fa-exclamation-triangle"></i>
      <p>{error}</p>
      <button onClick={fetchAllSettings} className="retry-btn">Try Again</button>
    </div>
  );

  const renderProfileTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h2>
          <i className="fas fa-user-circle"></i>
          Profile Information
        </h2>
        
        <div className="profile-avatar-section">
          <div className="avatar-preview">
            {profile.avatar ? (
              <img src={profile.avatar} alt="Avatar" />
            ) : (
              <div className="avatar-placeholder">
                <i className="fas fa-user"></i>
              </div>
            )}
          </div>
          <div className="avatar-actions">
            <label htmlFor="avatar-upload" className="btn-primary">
              <i className="fas fa-upload"></i>
              Upload Photo
            </label>
            <input
              type="file"
              id="avatar-upload"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
            {profile.hasAvatar && (
              <button 
                className="btn-secondary"
                onClick={handleRemoveAvatar}
              >
                <i className="fas fa-trash"></i>
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>
              <i className="fas fa-user"></i>
              Full Name
            </label>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-at"></i>
              Username
            </label>
            <input
              type="text"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              placeholder="Enter username"
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-envelope"></i>
              Email Address
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              placeholder="Enter email"
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-phone"></i>
              Phone Number
            </label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="btn-primary"
            onClick={() => handleSave('profile')}
            disabled={saving}
          >
            <i className="fas fa-save"></i>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h2>
          <i className="fas fa-shield-alt"></i>
          Security Settings
        </h2>

        {/* Password Section */}
        <div className="security-item">
          <div className="security-item-header">
            <div className="security-item-info">
              <i className="fas fa-key"></i>
              <div>
                <h3>Password</h3>
                <p>Change your password</p>
              </div>
            </div>
            <button 
              className="btn-primary"
              onClick={() => setShowPasswordModal(true)}
            >
              <i className="fas fa-edit"></i>
              Change Password
            </button>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="security-item">
          <div className="security-item-header">
            <div className="security-item-info">
              <i className={`fas fa-mobile-alt ${security.mfaEnabled ? 'text-success' : 'text-muted'}`}></i>
              <div>
                <h3>Two-Factor Authentication (2FA)</h3>
                <p>
                  {security.mfaEnabled 
                    ? 'Enabled - Your account is protected'
                    : 'Add an extra layer of security to your account'
                  }
                </p>
              </div>
            </div>
            {security.mfaEnabled ? (
              <button 
                className="btn-danger"
                onClick={handleDisableMFA}
              >
                <i className="fas fa-times"></i>
                Disable 2FA
              </button>
            ) : (
              <button 
                className="btn-success"
                onClick={handleMFASetup}
              >
                <i className="fas fa-check"></i>
                Enable 2FA
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h2>
          <i className="fas fa-bell"></i>
          Notification Preferences
        </h2>

        <div className="notification-category">
          <h3>
            <i className="fas fa-envelope"></i>
            Email Notifications
          </h3>
          <div className="notification-items">
            <div className="notification-item">
              <div className="notification-info">
                <strong>Email Notifications</strong>
                <p>Receive notifications via email</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.emailNotifications}
                  onChange={(e) => setNotifications({ ...notifications, emailNotifications: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="notification-item">
              <div className="notification-info">
                <strong>Upload Success</strong>
                <p>Get notified when files are uploaded successfully</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.uploadSuccess}
                  onChange={(e) => setNotifications({ ...notifications, uploadSuccess: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="notification-item">
              <div className="notification-info">
                <strong>Download Activity</strong>
                <p>Receive alerts when your files are downloaded</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.downloadActivity}
                  onChange={(e) => setNotifications({ ...notifications, downloadActivity: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="notification-item">
              <div className="notification-info">
                <strong>Share Requests</strong>
                <p>Get notified when someone shares a file with you</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.shareRequests}
                  onChange={(e) => setNotifications({ ...notifications, shareRequests: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="notification-category">
          <h3>
            <i className="fas fa-exclamation-triangle"></i>
            System Alerts
          </h3>
          <div className="notification-items">
            <div className="notification-item">
              <div className="notification-info">
                <strong>Storage Warnings</strong>
                <p>Alert when storage is running low</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.storageWarnings}
                  onChange={(e) => setNotifications({ ...notifications, storageWarnings: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="notification-item">
              <div className="notification-info">
                <strong>Security Alerts</strong>
                <p>Important security notifications</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.securityAlerts}
                  onChange={(e) => setNotifications({ ...notifications, securityAlerts: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="notification-category">
          <h3>
            <i className="fas fa-calendar-alt"></i>
            Digest & Summaries
          </h3>
          <div className="notification-items">
            <div className="notification-item">
              <div className="notification-info">
                <strong>Weekly Digest</strong>
                <p>Receive weekly summary of your activity</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications.weeklyDigest}
                  onChange={(e) => setNotifications({ ...notifications, weeklyDigest: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="btn-primary"
            onClick={() => handleSave('notifications')}
            disabled={saving}
          >
            <i className="fas fa-save"></i>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h2>
          <i className="fas fa-user-shield"></i>
          Privacy Settings
        </h2>

        <div className="form-group">
          <label>
            <i className="fas fa-eye"></i>
            Profile Visibility
          </label>
          <select
            value={privacy.profileVisibility}
            onChange={(e) => setPrivacy({ ...privacy, profileVisibility: e.target.value })}
            className="form-select"
          >
            <option value="public">Public - Anyone can see my profile</option>
            <option value="team">Team Only - Only my team members</option>
            <option value="private">Private - Only me</option>
          </select>
        </div>

        <div className="privacy-options">
          <div className="privacy-item">
            <div className="privacy-info">
              <i className="fas fa-envelope"></i>
              <div>
                <strong>Show Email Address</strong>
                <p>Display your email on your profile</p>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={privacy.showEmail}
                onChange={(e) => setPrivacy({ ...privacy, showEmail: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="privacy-item">
            <div className="privacy-info">
              <i className="fas fa-chart-line"></i>
              <div>
                <strong>Show Activity Status</strong>
                <p>Let others see when you're active</p>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={privacy.showActivity}
                onChange={(e) => setPrivacy({ ...privacy, showActivity: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="privacy-item">
            <div className="privacy-info">
              <i className="fas fa-search"></i>
              <div>
                <strong>File Indexing</strong>
                <p>Allow your files to be indexed for search</p>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={privacy.allowFileIndexing}
                onChange={(e) => setPrivacy({ ...privacy, allowFileIndexing: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="danger-zone">
          <h3>
            <i className="fas fa-exclamation-triangle"></i>
            Danger Zone
          </h3>
          <div className="danger-actions">
            <div className="danger-item">
              <div>
                <strong>Export Your Data</strong>
                <p>Download a copy of all your data</p>
              </div>
              <button className="btn-secondary" onClick={handleExportData}>
                <i className="fas fa-download"></i>
                Export Data
              </button>
            </div>
            <div className="danger-item">
              <div>
                <strong>Delete Account</strong>
                <p>Permanently delete your account and all data</p>
              </div>
              <button className="btn-danger" onClick={handleDeleteAccount}>
                <i className="fas fa-trash-alt"></i>
                Delete Account
              </button>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="btn-primary"
            onClick={() => handleSave('privacy')}
            disabled={saving}
          >
            <i className="fas fa-save"></i>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h2>
          <i className="fas fa-sliders-h"></i>
          Preferences
        </h2>

        <div className="form-grid">
          <div className="form-group">
            <label>
              <i className="fas fa-language"></i>
              Language
            </label>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
              className="form-select"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-palette"></i>
              Theme
            </label>
            <select
              value={preferences.theme}
              onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
              className="form-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-calendar"></i>
              Date Format
            </label>
            <select
              value={preferences.dateFormat}
              onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
              className="form-select"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-globe"></i>
              Timezone
            </label>
            <select
              value={preferences.timezone}
              onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
              className="form-select"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-th-list"></i>
              Default View
            </label>
            <select
              value={preferences.defaultView}
              onChange={(e) => setPreferences({ ...preferences, defaultView: e.target.value })}
              className="form-select"
            >
              <option value="list">List View</option>
              <option value="grid">Grid View</option>
              <option value="compact">Compact View</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-list-ol"></i>
              Items Per Page
            </label>
            <select
              value={preferences.itemsPerPage}
              onChange={(e) => setPreferences({ ...preferences, itemsPerPage: Number(e.target.value) })}
              className="form-select"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="btn-primary"
            onClick={() => handleSave('preferences')}
            disabled={saving}
          >
            <i className="fas fa-save"></i>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1>
            <i className="fas fa-cog"></i>
            Settings
          </h1>
          <p className="settings-subtitle">Manage your account settings and preferences</p>
        </div>
        {saveMessage && (
          <div className={`save-success-message ${saveMessage.includes('failed') ? 'error' : 'success'}`}>
            <i className={`fas ${saveMessage.includes('failed') ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
            {saveMessage}
          </div>
        )}
      </div>

      <div className="settings-container">
        {/* Tabs Navigation */}
        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fas ${tab.icon}`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="settings-content">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'security' && renderSecurityTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'privacy' && renderPrivacyTab()}
          {activeTab === 'preferences' && renderPreferencesTab()}
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-key"></i>
                Change Password
              </h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
              <div className="password-requirements">
                <p><i className="fas fa-info-circle"></i> Password must contain:</p>
                <ul>
                  <li>At least 8 characters</li>
                  <li>One uppercase letter</li>
                  <li>One lowercase letter</li>
                  <li>One number</li>
                  <li>One special character</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handlePasswordChange} disabled={saving}>
                <i className="fas fa-check"></i>
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MFA Setup Modal */}
      {showMFAModal && (
        <div className="modal-overlay" onClick={() => setShowMFAModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-mobile-alt"></i>
                Enable Two-Factor Authentication
              </h2>
              <button className="modal-close" onClick={() => setShowMFAModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="mfa-setup-steps">
                <div className="mfa-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h3>Download an Authenticator App</h3>
                    <p>Install Google Authenticator, Authy, or any TOTP-compatible app</p>
                  </div>
                </div>
                <div className="mfa-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h3>Scan QR Code</h3>
                    <div className="qr-code-container">
                      <div className="qr-code-placeholder">
                        <i className="fas fa-qrcode"></i>
                        <p>Use secret key: <strong>{mfaSetup.secret}</strong></p>
                      </div>
                      <p className="secret-key">
                        <strong>Manual Entry:</strong> {mfaSetup.secret}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mfa-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h3>Enter Verification Code</h3>
                    <input
                      type="text"
                      value={mfaSetup.verificationCode}
                      onChange={(e) => setMfaSetup({ ...mfaSetup, verificationCode: e.target.value })}
                      placeholder="Enter 6-digit code"
                      className="verification-input"
                      maxLength="6"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowMFAModal(false)}>
                Cancel
              </button>
              <button className="btn-success" onClick={handleVerifyMFA} disabled={saving}>
                <i className="fas fa-check"></i>
                {saving ? 'Verifying...' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;