import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

export const login = async (username, password) => {
  const response = await axios.post(`${API_URL}/login`, { username, password });
  return response.data;
};
// cette partie concerne le register
export const register = async (username, email, password, confirm_password, role = "user") => {
  const response = await axios.post(`${API}/auth/register`, {
    username,
    email,
    password,
    confirm_password,
    role,
  });
  return response.data;
};