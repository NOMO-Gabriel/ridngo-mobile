import * as SecureStore from 'expo-secure-store';
import api from './api';
import { AuthResponse, UserObj, UserRole } from '../types/api';

export const authService = {
  login: async (identifier: string, password: string): Promise<{ success: boolean; role?: string; message?: string }> => {
    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/login', { identifier, password });
      return await finalizeSession(response.data);
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || "Identifiants invalides" };
    }
  },

  register: async (data: {
    username: string;
    password: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    photo?: any;
  }): Promise<{ success: boolean; role?: string; message?: string }> => {
    try {
      const formData = new FormData();
      const registerDto = {
        username: data.username,
        password: data.password,
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        roles: [data.role],
      };
      formData.append('data', JSON.stringify(registerDto));
      if (data.photo) {
        formData.append('file', {
          uri: data.photo.uri,
          name: data.photo.fileName || 'photo.jpg',
          type: data.photo.mimeType || 'image/jpeg',
        } as any);
      }
      const response = await api.post<AuthResponse>('/api/v1/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return await finalizeSession(response.data);
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || "Erreur lors de l'inscription" };
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
    } catch {
      return null;
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await SecureStore.getItemAsync('accessToken');
    return !!token;
  },
};

const finalizeSession = async (authData: AuthResponse): Promise<{ success: boolean; role: string; message?: string }> => {
  if (!authData.accessToken) throw new Error('Token manquant');
  await SecureStore.setItemAsync('accessToken', authData.accessToken);
  if (authData.refreshToken) await SecureStore.setItemAsync('refreshToken', authData.refreshToken);

  const isDriver = authData.roles.includes('RIDE_AND_GO_DRIVER');
  const profileRes = await api.get(isDriver ? '/api/v1/users/me/driver-profile' : '/api/v1/users/me');
  const userProfile = isDriver ? profileRes.data.user : profileRes.data;

  const userObj: UserObj = {
    id: userProfile.id,
    name: userProfile.name || `${userProfile.firstName} ${userProfile.lastName}`,
    email: userProfile.email,
    phone: userProfile.telephone,
    role: isDriver ? 'DRIVER' : authData.roles.includes('RIDE_AND_GO_ADMIN') ? 'ADMIN' : 'PASSENGER',
  };

  await SecureStore.setItemAsync('user', JSON.stringify(userObj));
  return { success: true, role: userObj.role };
};
