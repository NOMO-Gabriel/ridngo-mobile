export type UserRole = 'RIDE_AND_GO_PASSENGER' | 'RIDE_AND_GO_DRIVER' | 'RIDE_AND_GO_ADMIN';
export type SimpleRole = 'PASSENGER' | 'DRIVER' | 'ADMIN';
export type OfferState = 'PENDING' | 'BID_RECEIVED' | 'DRIVER_SELECTED' | 'VALIDATED' | 'CANCELLED';
export type RideState = 'CREATED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface UserObj {
  id: string;
  name: string;
  email: string;
  phone?: string;       // mappé depuis userProfile.telephone
  role: SimpleRole;
}

export interface VehicleInfo {
  vehicleMakeName?: string;
  vehicleModelName?: string;
  vehicleTypeName?: string;
  transmissionTypeName?: string;
  fuelTypeName?: string;
  vehicleSizeName?: string;
  manufacturerName?: string;
  vehicleSerialNumber?: string;
  registrationNumber?: string;
  tankCapacity?: number;
  luggageMaxCapacity?: number;
  totalSeatNumber?: number;
  mileageAtStart?: number;
  mileageSinceCommissioning?: number;
  vehicleAgeAtStart?: number;
  averageFuelConsumptionPerKm?: number;
  makeName?: string;
  modelName?: string;
  typeName?: string;
  sizeName?: string;
  transmissionType?: string;
  airConditioned?: boolean;
  comfortable?: boolean;
  soft?: boolean;
  screen?: boolean;
  wifi?: boolean;
  tollCharge?: boolean;
  carParking?: boolean;
  alarm?: boolean;
  stateTax?: boolean;
  driverAllowance?: boolean;
}

export interface BecomeDriverRequest {
  vehicle: VehicleInfo;
  licenseNumber: string;
}

export interface UpdateUserProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface Bid {
  id?: string;
  driverId: string;
  driverName: string;
  driverPhoto?: string;
  rating?: number;
  totalTrips?: number;
  eta?: number;
  distanceToPassenger?: number;
  latitude?: number;
  longitude?: number;
  brand?: string;
  model?: string;
  licensePlate?: string;
  proposedPrice?: number;
}

export interface OfferResponse {
  id: string;
  passengerId: string;
  selectedDriverId?: string;
  startPoint: string;
  startLat?: number;
  startLon?: number;
  endPoint: string;
  endLat?: number;
  endLon?: number;
  price: number;
  passengerPhone?: string;
  departureTime?: string;
  state: OfferState;
  bids?: Bid[];
  proposals?: Bid[];
  status?: string;
  distance?: number;
  createdAt?: string;
}

export interface RideResponse {
  id: string;
  offerId?: string;
  driverId?: string;
  passengerId?: string;
  startPoint?: string;
  endPoint?: string;
  price?: number;
  state: RideState;
  rideId?: string;
  createdAt?: string;
  distance?: number;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
  vehicle?: { brand?: string; modelName?: string };
  partnerPhoto?: string;
}

/**
 * FareResponse — réponse complète de POST /api/v1/fares/estimate
 * Tous les champs sont optionnels car le backend peut évoluer.
 */
export interface FareResponse {
  // Champs principaux (toujours présents si 200)
  prix_moyen?: number;
  prix_min?: number;
  prix_max?: number;
  distance?: number;       // en mètres côté backend
  duree?: number;          // en secondes côté backend
  statut?: string;
  fiabilite?: number;      // score de fiabilité 0–100
  message?: string;        // conseil textuel

  // Champs legacy / alias
  estimatedPrice?: number;
  price?: number;
  duration?: number;

  // Champs enrichis (optionnels)
  estimations_supplementaires?: any;
  ajustements_appliques?: Record<string, any>;
  details_trajet?: Record<string, any>;
  suggestions?: string[];
}

export interface Wallet {
  id?: string;
  balance: number;
  currency?: string;
}

export interface CreateOfferRequest {
  startPoint: string;
  startLat: number;
  startLon: number;
  endPoint: string;
  endLat: number;
  endLon: number;
  price: number;
  passengerPhone: string;
  departureTime: string;
}

export interface RideTrackingResponse {
  latitude: number;
  longitude: number;
  distanceKm?: number;
  etaMinutes?: number;
  targetRole?: string;
  timestamp?: string;
}

export interface DriverTrajectory {
  id: string;
  driverId?: string;
  points?: Array<{ lat: number; lon: number }>;
  startTime?: string;
  endTime?: string;
  pointsCount?: number;
  trajectoryDataJson?: string;
  createdAt?: string;
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
}

// ── Notifications ──

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  dataJson?: string;
}

export interface PagedResultNotification {
  content: Notification[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

export interface NotificationSettings {
  userId?: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
}

export interface SettingsDto {
  email: boolean;
  sms: boolean;
  push: boolean;
  whatsapp: boolean;
}

// ── Driver ──

export interface DriverProfile {
  userId: string;
  status: string;
  licenseNumber: string;
  isOnline: boolean;
  isProfileValidated: boolean;
  isSyndicated: boolean;
  isProfileCompleted: boolean;
  vehicle?: Vehicle;
}

export interface Vehicle {
  id: string;
  makeName?: string;
  modelName?: string;
  registrationNumber?: string;
  brand?: string;
  typeName?: string;
  fuelTypeName?: string;
  transmissionType?: string;
  totalSeatNumber?: number;
}

// export type UserRole = 'RIDE_AND_GO_PASSENGER' | 'RIDE_AND_GO_DRIVER' | 'RIDE_AND_GO_ADMIN';
// export type SimpleRole = 'PASSENGER' | 'DRIVER' | 'ADMIN';
// export type OfferState = 'PENDING' | 'BID_RECEIVED' | 'DRIVER_SELECTED' | 'VALIDATED' | 'CANCELLED';
// export type RideState = 'CREATED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

// export interface AuthResponse {
//   accessToken: string;
//   refreshToken: string;
//   username: string;
//   roles: string[];
//   permissions: string[];
// }

// export interface UserObj {
//   id: string;
//   name: string;
//   email: string;
//   phone?: string;
//   role: SimpleRole;
// }

// export interface VehicleInfo {
//   vehicleMakeName?: string;
//   vehicleModelName?: string;
//   vehicleTypeName?: string;
//   transmissionTypeName?: string;
//   fuelTypeName?: string;
//   vehicleSizeName?: string;
//   manufacturerName?: string;
//   vehicleSerialNumber?: string;
//   registrationNumber?: string;
//   tankCapacity?: number;
//   luggageMaxCapacity?: number;
//   totalSeatNumber?: number;
//   mileageAtStart?: number;
//   mileageSinceCommissioning?: number;
//   vehicleAgeAtStart?: number;
//   averageFuelConsumptionPerKm?: number;
//   makeName?: string;
//   modelName?: string;
//   typeName?: string;
//   sizeName?: string;
//   transmissionType?: string;
//   airConditioned?: boolean;
//   comfortable?: boolean;
//   soft?: boolean;
//   screen?: boolean;
//   wifi?: boolean;
//   tollCharge?: boolean;
//   carParking?: boolean;
//   alarm?: boolean;
//   stateTax?: boolean;
//   driverAllowance?: boolean;
// }

// export interface Bid {
//   id: string;
//   driverId: string;
//   driverName: string;
//   driverPhoto?: string;
//   rating?: number;
//   totalTrips?: number;
//   eta?: number;
//   distanceToPassenger?: number;
//   latitude?: number;
//   longitude?: number;
//   brand?: string;
//   model?: string;
//   licensePlate?: string;
// }

// export interface OfferResponse {
//   id: string;
//   passengerId: string;
//   startPoint: string;
//   endPoint: string;
//   price: number;
//   state: OfferState;
//   proposals?: Bid[];
//   status?: string;
//   distance?: number;
//   createdAt?: string;
//   passengerPhone?: string;
//   departureTime?: string;
//   startLat?: number;
//   startLon?: number;
//   endLat?: number;
//   endLon?: number;
// }

// export interface RideResponse {
//   id: string;
//   offerId?: string;
//   driverId?: string;
//   passengerId?: string;
//   startPoint?: string;
//   endPoint?: string;
//   price?: number;
//   state: RideState;
//   rideId?: string;
//   createdAt?: string;
//   distance?: number;
//   startLat?: number;
//   startLon?: number;
//   endLat?: number;
//   endLon?: number;
//   vehicle?: { brand?: string; modelName?: string; };
//   partnerPhoto?: string;
// }

// export interface FareResponse {
//   estimatedPrice?: number;
//   prix_moyen?: number;
//   price?: number;
//   distance?: number;
//   duration?: number;
// }

// export interface Wallet {
//   id?: string;
//   balance: number;
//   currency?: string;
// }

// export interface CreateOfferRequest {
//   startPoint: string;
//   endPoint: string;
//   price: number;
//   startLat?: number;
//   startLon?: number;
//   endLat?: number;
//   endLon?: number;
//   passengerPhone?: string;
//   departureTime?: string;
// }

// export interface RideTrackingResponse {
//   latitude: number;
//   longitude: number;
//   timestamp?: string;
// }

// export interface DriverTrajectory {
//   id: string;
//   points: Array<{ lat: number; lon: number }>;
//   createdAt: string;
// }

// export interface Location {
//   name: string;
//   lat: number;
//   lon: number;
// }