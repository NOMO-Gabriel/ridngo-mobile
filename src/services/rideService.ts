import api from './api';
import {
  OfferResponse, FareResponse, RideResponse,
  CreateOfferRequest, RideTrackingResponse, Wallet, DriverTrajectory
} from '../types/api';

export const rideService = {
  estimateFare: async (pickup: string, destination: string): Promise<FareResponse> => {
    const body = {
      depart: pickup,
      arrivee: destination,
      heure: 'matin',
      meteo: 0,
      type_zone: 0,
      congestion_user: 1,
    };
    const response = await api.post<FareResponse>('/api/v1/fares/estimate', body);
    return response.data;
  },

  createOffer: async (data: CreateOfferRequest): Promise<OfferResponse> => {
    const response = await api.post<OfferResponse>('/api/v1/offers', data);
    return response.data;
  },

  getAvailableOffers: async (page = 0, size = 50): Promise<OfferResponse[]> => {
    const response = await api.get<OfferResponse[]>(`/api/v1/offers/available?page=${page}&size=${size}`);
    return response.data;
  },

  applyToOffer: async (offerId: string): Promise<OfferResponse> => {
    const response = await api.post<OfferResponse>(`/api/v1/offers/${offerId}/apply`);
    return response.data;
  },

  getOfferBids: async (offerId: string): Promise<OfferResponse> => {
    const response = await api.get<OfferResponse>(`/api/v1/offers/${offerId}/bids`);
    return response.data;
  },

  selectDriver: async (offerId: string, driverId: string): Promise<OfferResponse> => {
    const response = await api.patch<OfferResponse>(`/api/v1/offers/${offerId}/select-driver?driverId=${driverId}`);
    return response.data;
  },

  driverAccepts: async (offerId: string, driverId: string): Promise<RideResponse> => {
    const response = await api.post<RideResponse>(`/api/v1/offers/${offerId}/accept?driverId=${driverId}`);
    return response.data;
  },

  getTrackingInfo: async (rideId: string): Promise<RideTrackingResponse> => {
    const response = await api.get<RideTrackingResponse>(`/api/v1/trips/${rideId}/location`);
    return response.data;
  },

  updateRideStatus: async (rideId: string, status: 'ONGOING' | 'COMPLETED' | 'CANCELLED'): Promise<RideResponse> => {
    const response = await api.patch<RideResponse>(`/api/v1/trips/${rideId}/status`, { status });
    return response.data;
  },

  postReview: async (rideId: string, stars: number, comment: string) => {
    const response = await api.post(`/api/v1/reviews/ride/${rideId}`, { stars, comment });
    return response.data;
  },

  getOfferById: async (id: string): Promise<OfferResponse> => {
    const response = await api.get<OfferResponse>(`/api/v1/offers/${id}`);
    return response.data;
  },

  getMyWallet: async (): Promise<Wallet> => {
    const response = await api.get<Wallet>('/api/v1/wallets/me');
    return response.data;
  },

  getRideDetails: async (rideId: string): Promise<RideResponse> => {
    const response = await api.get<RideResponse>(`/api/v1/trips/${rideId}`);
    return response.data;
  },

  getRideByOffer: async (offerId: string): Promise<RideResponse> => {
    const response = await api.get<RideResponse>(`/api/v1/offers/${offerId}/ride`);
    const data = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!data?.id) throw new Error('Aucune course trouvée');
    return data;
  },

  getMyHistory: async (page = 0, size = 20): Promise<RideResponse[]> => {
    const response = await api.get<RideResponse[]>(`/api/v1/trips/enriched-history?page=${page}&size=${size}`);
    return response.data;
  },

  getCurrentRide: async (): Promise<RideResponse | null> => {
    try {
      const res = await api.get<RideResponse>('/api/v1/trips/driver/current');
      return res.data;
    } catch {
      return null;
    }
  },

  getCurrentPassengerRide: async (): Promise<RideResponse | null> => {
    try {
      const response = await api.get<RideResponse[]>('/api/v1/trips/history?page=0&size=1');
      const latest = response.data[0];
      if (latest && (latest.state === 'CREATED' || latest.state === 'ONGOING')) return latest;
      return null;
    } catch {
      return null;
    }
  },

  updateLocation: async (lat: number, lon: number): Promise<boolean> => {
    try {
      await api.post('/api/v1/location', { latitude: lat, longitude: lon });
      return true;
    } catch {
      return false;
    }
  },

  getMyTrajectories: async (): Promise<DriverTrajectory[]> => {
    const response = await api.get<DriverTrajectory[]>('/api/v1/trips/trajectories/me');
    return response.data;
  },
};
