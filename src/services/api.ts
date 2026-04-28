import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'https://traefikdev.yowyob.com/ridngo';
export const VEHICLE_URL = 'https://vehicule-service.pynfi.com';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

export const vehicleApi: AxiosInstance = axios.create({
  baseURL: VEHICLE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

const authInterceptor = async (config: any) => {
  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {}
  return config;
};

api.interceptors.request.use(authInterceptor);
vehicleApi.interceptors.request.use(authInterceptor);

api.interceptors.response.use(
  r => r,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest.url?.includes('/api/v1/auth')) {
      return Promise.reject(error);
    }
    if (originalRequest._retry) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!refreshToken) return Promise.reject(error);

    isRefreshing = true;
    try {
      const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = res.data;
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', newRefresh);
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      processQueue(null, accessToken);
      return api(originalRequest);
    } catch (e) {
      processQueue(e, null);
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;