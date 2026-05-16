import * as SecureStore from 'expo-secure-store';
import api from './api';
import {
  OfferResponse, FareResponse, RideResponse,
  CreateOfferRequest, RideTrackingResponse, Wallet, DriverTrajectory
} from '../types/api';

// ─── Helpers SecureStore ──────────────────────────────────────────────────────

export const addAppliedOffer = async (offerId: string) => {
  try {
    const stored = await SecureStore.getItemAsync('appliedOfferIds');
    const ids: string[] = stored ? JSON.parse(stored) : [];
    if (!ids.includes(offerId)) {
      await SecureStore.setItemAsync('appliedOfferIds',
        JSON.stringify([offerId, ...ids].slice(0, 20)));
    }
  } catch { }
};

export const removeAppliedOffer = async (offerId: string) => {
  try {
    const stored = await SecureStore.getItemAsync('appliedOfferIds');
    const ids: string[] = stored ? JSON.parse(stored) : [];
    await SecureStore.setItemAsync('appliedOfferIds',
      JSON.stringify(ids.filter(id => id !== offerId)));
  } catch { }
};

export const addActiveTrip = async (tripId: string, offerId?: string) => {
  try {
    const stored = await SecureStore.getItemAsync('activeTrips');
    const trips: Array<{ tripId: string; offerId?: string }> =
      stored ? JSON.parse(stored) : [];
    if (!trips.find(t => t.tripId === tripId)) {
      await SecureStore.setItemAsync('activeTrips',
        JSON.stringify([{ tripId, offerId }, ...trips].slice(0, 10)));
    }
    await SecureStore.setItemAsync('activeRideId', tripId);
  } catch { }
};

export const removeActiveTrip = async (tripId: string) => {
  try {
    const stored = await SecureStore.getItemAsync('activeTrips');
    const trips: Array<{ tripId: string; offerId?: string }> =
      stored ? JSON.parse(stored) : [];
    await SecureStore.setItemAsync('activeTrips',
      JSON.stringify(trips.filter(t => t.tripId !== tripId)));
    const current = await SecureStore.getItemAsync('activeRideId');
    if (current === tripId) await SecureStore.deleteItemAsync('activeRideId');
  } catch { }
};

export const clearPassengerRideData = async () => {
  try {
    await SecureStore.deleteItemAsync('currentOfferId');
    await SecureStore.deleteItemAsync('activeRideId');
  } catch { }
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const rideService = {

  estimateFare: async (depart: string, arrivee: string): Promise<FareResponse> => {
    const body = { depart, arrivee, heure: 'matin', meteo: 0, type_zone: 0, congestion_user: 1 };
    console.log('[rideService] estimateFare:', body);
    const res = await api.post<FareResponse>('/api/v1/fares/estimate', body);
    console.log('[rideService] estimateFare response:', res.data);
    return res.data;
  },

  createOffer: async (data: CreateOfferRequest): Promise<OfferResponse> => {
    const res = await api.post<OfferResponse>('/api/v1/offers', data);
    await SecureStore.setItemAsync('currentOfferId', res.data.id);
    return res.data;
  },

  getOfferById: async (id: string): Promise<OfferResponse> => {
    const res = await api.get<OfferResponse>(`/api/v1/offers/${id}`);
    return res.data;
  },

  getOfferBids: async (offerId: string): Promise<OfferResponse> => {
    const res = await api.get<OfferResponse>(`/api/v1/offers/${offerId}/bids`);
    return res.data;
  },

  cancelOffer: async (offerId: string): Promise<void> => {
    await api.post(`/api/v1/offers/${offerId}/cancel`);
    await clearPassengerRideData();
  },

  getAvailableOffers: async (page = 0, size = 50): Promise<OfferResponse[]> => {
    const res = await api.get<OfferResponse[]>(
      `/api/v1/offers/available?page=${page}&size=${size}`);
    return res.data;
  },

  getLandingOffers: async (limit = 10): Promise<OfferResponse[]> => {
    const res = await api.get<OfferResponse[]>(`/api/v1/offers/landing?limit=${limit}`);
    return res.data;
  },

  selectDriver: async (offerId: string, driverId: string): Promise<OfferResponse> => {
    const res = await api.patch<OfferResponse>(
      `/api/v1/offers/${offerId}/select-driver?driverId=${driverId}`);
    return res.data;
  },

  applyToOffer: async (offerId: string): Promise<OfferResponse> => {
    const res = await api.post<OfferResponse>(`/api/v1/offers/${offerId}/apply`);
    await addAppliedOffer(offerId);
    return res.data;
  },

  // Chauffeur confirme pickup → crée le Trip
  // POST /api/v1/offers/{id}/accept?driverId={driverId}
  driverAccepts: async (offerId: string, driverId: string): Promise<RideResponse> => {
    const res = await api.post<RideResponse>(
      `/api/v1/offers/${offerId}/accept?driverId=${driverId}`);
    const ride = res.data;
    await removeAppliedOffer(offerId);
    await addActiveTrip(ride.id, offerId);
    return ride;
  },

  getRideByOffer: async (offerId: string): Promise<RideResponse> => {
    const res = await api.get<RideResponse>(`/api/v1/offers/${offerId}/ride`);
    return Array.isArray(res.data) ? res.data[0] : res.data;
  },

  getRideDetails: async (rideId: string): Promise<RideResponse> => {
    const res = await api.get<RideResponse>(`/api/v1/trips/${rideId}`);
    return res.data;
  },

  // Chauffeur a récupéré le client → ONGOING
  // PATCH /api/v1/trips/{id}/status { status: "ONGOING" }
  startRide: async (rideId: string): Promise<RideResponse> => {
    const res = await api.patch<RideResponse>(`/api/v1/trips/${rideId}/status`,
      { status: 'ONGOING' });
    return res.data;
  },

  // Chauffeur termine la course → COMPLETED (seul le chauffeur)
  // PATCH /api/v1/trips/{id}/status { status: "COMPLETED" }
  completeRide: async (rideId: string): Promise<RideResponse> => {
    const res = await api.patch<RideResponse>(`/api/v1/trips/${rideId}/status`,
      { status: 'COMPLETED' });
    await removeActiveTrip(rideId);
    return res.data;
  },

  updateRideStatus: async (
    rideId: string, status: 'ONGOING' | 'COMPLETED' | 'CANCELLED'
  ): Promise<RideResponse> => {
    const res = await api.patch<RideResponse>(`/api/v1/trips/${rideId}/status`, { status });
    if (status === 'COMPLETED' || status === 'CANCELLED') await removeActiveTrip(rideId);
    return res.data;
  },

  updateLocation: async (lat: number, lon: number): Promise<void> => {
    await api.post('/api/v1/location', { latitude: lat, longitude: lon });
  },

  getTrackingInfo: async (rideId: string): Promise<RideTrackingResponse> => {
    const res = await api.get<RideTrackingResponse>(`/api/v1/trips/${rideId}/location`);
    return res.data;
  },

  getCurrentPassengerRide: async (): Promise<RideResponse | null> => {
    try {
      const rideId = await SecureStore.getItemAsync('activeRideId');
      if (!rideId) return null;
      const res = await api.get<RideResponse>(`/api/v1/trips/${rideId}`);
      if (res.data.state === 'COMPLETED' || res.data.state === 'CANCELLED') {
        await clearPassengerRideData();
        return null;
      }
      return res.data;
    } catch { return null; }
  },

  submitReview: async (rideId: string, stars: number, comment: string): Promise<void> => {
    await api.post(`/api/v1/reviews/ride/${rideId}`, { stars, comment });
  },

  postReview: async (rideId: string, stars: number, comment: string): Promise<void> => {
    await api.post(`/api/v1/reviews/ride/${rideId}`, { stars, comment });
  },

  getMyWallet: async (): Promise<Wallet> => {
    const res = await api.get<Wallet>('/api/v1/wallets/me');
    return res.data;
  },

  getRideHistory: async (): Promise<RideResponse[]> => {
    const res = await api.get<RideResponse[]>('/api/v1/trips/history');
    return res.data;
  },

  getEnrichedHistory: async (): Promise<RideResponse[]> => {
    const res = await api.get<RideResponse[]>('/api/v1/trips/enriched-history');
    return res.data;
  },

  // GET /api/v1/trips/driver/{driverId}/history
  getDriverHistory: async (driverId: string): Promise<RideResponse[]> => {
    const res = await api.get<RideResponse[]>(`/api/v1/trips/driver/${driverId}/history`);
    return res.data;
  },

  getMyTrajectories: async (): Promise<DriverTrajectory[]> => {
    const res = await api.get<DriverTrajectory[]>('/api/v1/trips/trajectories/me');
    return res.data;
  },

  getMyReviews: async () => {
    const res = await api.get('/api/v1/reviews/me');
    return res.data;
  },
};

// import * as SecureStore from 'expo-secure-store';
// import api from './api';
// import {
//   OfferResponse, FareResponse, RideResponse,
//   CreateOfferRequest, RideTrackingResponse, Wallet, DriverTrajectory
// } from '../types/api';

// export const rideService = {

//   // ─── Estimation tarifaire ───────────────────────────────────────────────
//   // depart / arrivee acceptent soit un nom soit "lat,lon" (coordonnées)
//   estimateFare: async (depart: string, arrivee: string): Promise<FareResponse> => {
//     const body = {
//       depart,
//       arrivee,
//       heure: 'matin',
//       meteo: 0,
//       type_zone: 0,
//       congestion_user: 1,
//     };
//     console.log('[rideService] estimateFare body:', body);
//     const response = await api.post<FareResponse>('/api/v1/fares/estimate', body);
//     console.log('[rideService] estimateFare response:', response.data);
//     return response.data;
//   },

//   // ─── Création d'offre passager ───────────────────────────────────────────
//   createOffer: async (data: CreateOfferRequest): Promise<OfferResponse> => {
//     console.log('[rideService] createOffer body:', data);
//     const response = await api.post<OfferResponse>('/api/v1/offers', data);
//     console.log('[rideService] createOffer response:', response.data);
//     return response.data;
//   },

//   // ─── Offres disponibles (chauffeur) ─────────────────────────────────────
//   getAvailableOffers: async (page = 0, size = 50): Promise<OfferResponse[]> => {
//     const response = await api.get<OfferResponse[]>(
//       `/api/v1/offers/available?page=${page}&size=${size}`
//     );
//     return response.data;
//   },

//   // ─── Offres landing (public) ─────────────────────────────────────────────
//   getLandingOffers: async (limit = 10): Promise<OfferResponse[]> => {
//     const response = await api.get<OfferResponse[]>(`/api/v1/offers/landing?limit=${limit}`);
//     return response.data;
//   },

//   // ─── Détail d'une offre ──────────────────────────────────────────────────
//   getOfferById: async (id: string): Promise<OfferResponse> => {
//     const response = await api.get<OfferResponse>(`/api/v1/offers/${id}`);
//     return response.data;
//   },

//   // ─── Polling bids (passager) ─────────────────────────────────────────────
//   // GET /api/v1/offers/{id}/bids → retourne l'offre avec la liste des bids enrichis
//   getOfferBids: async (offerId: string): Promise<OfferResponse> => {
//     const response = await api.get<OfferResponse>(`/api/v1/offers/${offerId}/bids`);
//     return response.data;
//   },

//   // ─── Annuler une offre ───────────────────────────────────────────────────
//   cancelOffer: async (offerId: string): Promise<void> => {
//     await api.post(`/api/v1/offers/${offerId}/cancel`);
//   },

//   // ─── Chauffeur postule ───────────────────────────────────────────────────
//   applyToOffer: async (offerId: string): Promise<OfferResponse> => {
//     console.log('[rideService] applyToOffer:', offerId);
//     const response = await api.post<OfferResponse>(`/api/v1/offers/${offerId}/apply`);
//     // Persister l'offerId pour l'onglet "Mes offres"
//     try {
//       const stored = await SecureStore.getItemAsync('appliedOfferIds');
//       const ids: string[] = stored ? JSON.parse(stored) : [];
//       if (!ids.includes(offerId)) {
//         ids.unshift(offerId); // plus récent en premier
//         // Garder max 20 entrées
//         const trimmed = ids.slice(0, 20);
//         await SecureStore.setItemAsync('appliedOfferIds', JSON.stringify(trimmed));
//       }
//     } catch { /* silent */ }
//     return response.data;
//   },

//   // ─── Handshake Step 1 : Passager sélectionne un driver ──────────────────
//   selectDriver: async (offerId: string, driverId: string): Promise<OfferResponse> => {
//     const response = await api.patch<OfferResponse>(
//       `/api/v1/offers/${offerId}/select-driver?driverId=${driverId}`
//     );
//     return response.data;
//   },

//   // ─── Handshake Step 2 : Driver confirme le pickup ───────────────────────
//   driverAccepts: async (offerId: string, driverId: string): Promise<RideResponse> => {
//     const response = await api.post<RideResponse>(
//       `/api/v1/offers/${offerId}/accept?driverId=${driverId}`
//     );
//     return response.data;
//   },

//   // ─── Récupérer la course liée à une offre ────────────────────────────────
//   getRideByOffer: async (offerId: string): Promise<RideResponse> => {
//     const response = await api.get<RideResponse>(`/api/v1/offers/${offerId}/ride`);
//     // Le backend peut renvoyer un tableau ou un objet selon la version
//     const data = Array.isArray(response.data) ? response.data[0] : response.data;
//     return data;
//   },

//   // ─── Détail d'une course ─────────────────────────────────────────────────
//   getRideDetails: async (rideId: string): Promise<RideResponse> => {
//     const response = await api.get<RideResponse>(`/api/v1/trips/${rideId}`);
//     return response.data;
//   },

//   // ─── Course en cours passager ────────────────────────────────────────────
//   getCurrentPassengerRide: async (): Promise<RideResponse | null> => {
//     try {
//       // L'API n'a pas de route dédiée côté passager → on essaie via l'offre stockée
//       return null;
//     } catch {
//       return null;
//     }
//   },

//   // ─── Tracking temps réel ─────────────────────────────────────────────────
//   // GET /api/v1/trips/{id}/location
//   getTrackingInfo: async (rideId: string): Promise<RideTrackingResponse> => {
//     const response = await api.get<RideTrackingResponse>(`/api/v1/trips/${rideId}/location`);
//     return response.data;
//   },

//   // ─── Mettre à jour la position GPS (chauffeur) ───────────────────────────
//   updateLocation: async (lat: number, lon: number): Promise<void> => {
//     await api.post('/api/v1/location', { latitude: lat, longitude: lon });
//   },

//   // ─── Statut de la course ─────────────────────────────────────────────────
//   updateRideStatus: async (
//     rideId: string,
//     status: 'ONGOING' | 'COMPLETED' | 'CANCELLED'
//   ): Promise<RideResponse> => {
//     const response = await api.patch<RideResponse>(`/api/v1/trips/${rideId}/status`, { status });
//     return response.data;
//   },

//   completeRide: async (rideId: string): Promise<RideResponse> => {
//     const response = await api.patch<RideResponse>(`/api/v1/trips/${rideId}/status`, {
//       status: 'COMPLETED',
//     });
//     return response.data;
//   },

//   // ─── Avis/Évaluation ─────────────────────────────────────────────────────
//   // POST /api/v1/reviews/ride/{rideId}
//   postReview: async (rideId: string, stars: number, comment: string): Promise<void> => {
//     await api.post(`/api/v1/reviews/ride/${rideId}`, { stars, comment });
//   },

//   submitReview: async (rideId: string, stars: number, comment: string): Promise<void> => {
//     await api.post(`/api/v1/reviews/ride/${rideId}`, { stars, comment });
//   },

//   // ─── Wallet chauffeur ────────────────────────────────────────────────────
//   getMyWallet: async (): Promise<Wallet> => {
//     const response = await api.get<Wallet>('/api/v1/wallets/me');
//     return response.data;
//   },

//   // ─── Historique des courses ──────────────────────────────────────────────
//   getRideHistory: async (): Promise<RideResponse[]> => {
//     const response = await api.get<RideResponse[]>('/api/v1/trips/history');
//     return response.data;
//   },

//   getEnrichedHistory: async (): Promise<RideResponse[]> => {
//     const response = await api.get<RideResponse[]>('/api/v1/trips/enriched-history');
//     return response.data;
//   },

//   getDriverHistory: async (driverId: string): Promise<RideResponse[]> => {
//     const response = await api.get<RideResponse[]>(
//       `/api/v1/trips/driver/${driverId}/history`
//     );
//     return response.data;
//   },

//   // ─── Trajectoires GPS ────────────────────────────────────────────────────
//   getMyTrajectories: async (): Promise<DriverTrajectory[]> => {
//     const response = await api.get<DriverTrajectory[]>('/api/v1/trips/trajectories/me');
//     return response.data;
//   },

//   // ─── Avis reçus (chauffeur) ──────────────────────────────────────────────
//   getMyReviews: async () => {
//     const response = await api.get('/api/v1/reviews/me');
//     return response.data;
//   },
// };

