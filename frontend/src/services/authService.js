import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

export const login = async (username, password) => {
  const { data } = await axios.post(`${API_URL}/login`, { username, password });
  return data; // includes { token, user, mfa_required }
};
// cette partie concerne le register
export const register = async (username, email, password, confirm_password, role = "user") => {
  const response = await axios.post(`${API_URL}/register`, {
    username,
    email,
    password,
    confirm_password,
    role,
  });
  return response.data;
};

export const forgotPassword = async (email) => {
  const { data } = await axios.post(`${API_URL}/forgot-password`, { email });
  return data;
};

export const resetPassword = async (email, otp, new_password, confirm_password) => {
  const { data } = await axios.post(`${API_URL}/reset-password`, { email, otp, new_password, confirm_password });
  return data;
};
