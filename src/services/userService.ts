import api from './api';

export const driverService = {
  becomeDriver: async (data: any) => {
    const response = await api.post('/api/v1/users/driver', data);
    return response.data;
  },

  getDriverProfile: async () => {
    const response = await api.get('/api/v1/users/me/driver-profile');
    return response.data;
  },

  toggleOnlineStatus: async (isOnline: boolean) => {
    const response = await api.post(`/api/v1/drivers/status/online?isOnline=${isOnline}`);
    return response.data;
  },
};

export const userService = {
  getMe: async () => {
    const res = await api.get('/api/v1/users/me');
    return res.data;
  },

  updateProfile: async (data: { firstName?: string; lastName?: string; phone?: string }) => {
    const res = await api.put('/api/v1/users/profile', data);
    return res.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    await api.put('/api/v1/users/password', { currentPassword, newPassword });
  },

  getNotifications: async (page = 0, size = 20) => {
    const res = await api.get(`/api/v1/notifications?page=${page}&size=${size}`);
    return res.data;
  },

  markNotificationRead: async (id: string) => {
    await api.patch(`/api/v1/notifications/${id}/read`);
  },

  markAllRead: async () => {
    await api.patch('/api/v1/notifications/read-all');
  },
};

export const geocodeService = {
  search: async (query: string): Promise<Array<{ name: string; lat: number; lon: number }>> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cm&limit=5`,
        { headers: { 'Accept-Language': 'fr' } }
      );
      const data = await res.json();
      return data.map((item: any) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }));
    } catch {
      return [];
    }
  },

  reverseGeocode: async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        { headers: { 'Accept-Language': 'fr' } }
      );
      const data = await res.json();
      return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  },
};
