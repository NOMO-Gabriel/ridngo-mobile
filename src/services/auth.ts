import * as SecureStore from 'expo-secure-store';
import api from './api';
import { BASE_URL } from './api';
import { AuthResponse, UserObj, UserRole } from '../types/api';

export const authService = {
  login: async (identifier: string, password: string): Promise<{ success: boolean; role?: string; message?: string }> => {
    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/login', { identifier, password });
      return await finalizeSession(response.data);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message || "Identifiants invalides";
      return { success: false, message: msg };
    }
  },

  register: async (data: {
    username: string; password: string; email: string; phone: string;
    firstName: string; lastName: string; role: UserRole; photo?: any;
  }): Promise<{ success: boolean; role?: string; message?: string }> => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');

      // Build multipart manually using fetch (Axios breaks multipart on React Native)
      const boundary = '----RidnGoBoundary' + Date.now();

      const registerDto = JSON.stringify({
        username: data.username,
        password: data.password,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        roles: [data.role],
      });

      let body = '';
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="data"\r\n`;
      body += `Content-Type: application/json\r\n\r\n`;
      body += `${registerDto}\r\n`;

      if (data.photo) {
        // For photo we still use FormData separately
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="file"; filename="${data.photo.fileName || 'photo.jpg'}"\r\n`;
        body += `Content-Type: ${data.photo.mimeType || 'image/jpeg'}\r\n\r\n`;
      }

      body += `--${boundary}--\r\n`;

      const headers: any = {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers,
        body,
      });

      const responseData = await res.json();

      if (!res.ok) {
        const msg = responseData?.message || responseData?.error || `Erreur ${res.status}`;
        return { success: false, message: msg };
      }

      return await finalizeSession(responseData as AuthResponse);
    } catch (error: any) {
      return { success: false, message: error.message || "Erreur lors de l'inscription" };
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
  },

  getUser: async (): Promise<UserObj | null> => {
    try {
      const raw = await SecureStore.getItemAsync('user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await SecureStore.getItemAsync('accessToken');
    return !!token;
  },
};

const finalizeSession = async (authData: AuthResponse): Promise<{ success: boolean; role: string }> => {
  if (!authData.accessToken) throw new Error('Token manquant');
  await SecureStore.setItemAsync('accessToken', authData.accessToken);
  if (authData.refreshToken) await SecureStore.setItemAsync('refreshToken', authData.refreshToken);

  const isDriver = authData.roles?.includes('RIDE_AND_GO_DRIVER');
  const isAdmin = authData.roles?.includes('RIDE_AND_GO_ADMIN');

  let userProfile: any = {};
  try {
    const profileRes = await api.get(isDriver ? '/api/v1/users/me/driver-profile' : '/api/v1/users/me');
    userProfile = isDriver ? (profileRes.data.user || profileRes.data) : profileRes.data;
  } catch {
    userProfile = { id: authData.username, email: '', name: authData.username };
  }

  const userObj: UserObj = {
    id: userProfile.id || authData.username,
    name: userProfile.name || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || authData.username,
    email: userProfile.email || '',
    phone: userProfile.telephone,
    role: isDriver ? 'DRIVER' : isAdmin ? 'ADMIN' : 'PASSENGER',
  };

  await SecureStore.setItemAsync('user', JSON.stringify(userObj));
  return { success: true, role: userObj.role };
};