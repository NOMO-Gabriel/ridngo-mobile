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
  phone?: string;
  role: SimpleRole;
}

export interface UserResponse {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  telephone?: string;
  roles: UserRole[];
  profilePhotoUrl?: string;
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
  // attributes
  makeName?: string;
  modelName?: string;
  typeName?: string;
  sizeName?: string;
  fuelTypeName_?: string;
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

export interface Bid {
  id: string;
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
}

export interface OfferResponse {
  id: string;
  passengerId: string;
  startPoint: string;
  endPoint: string;
  price: number;
  state: OfferState;
  proposals?: Bid[];
  status?: string;
  distance?: number;
  createdAt?: string;
  passengerPhone?: string;
  departureTime?: string;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
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
  vehicle?: {
    brand?: string;
    modelName?: string;
  };
  partnerPhoto?: string;
}

export interface FareResponse {
  estimatedPrice?: number;
  price?: number;
  distance?: number;
  duration?: number;
}

export interface Wallet {
  id?: string;
  balance: number;
  currency?: string;
}

export interface CreateOfferRequest {
  startPoint: string;
  endPoint: string;
  price: number;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
  passengerPhone?: string;
  departureTime?: string;
}

export interface RideTrackingResponse {
  latitude: number;
  longitude: number;
  timestamp?: string;
}

export interface DriverTrajectory {
  id: string;
  points: Array<{ lat: number; lon: number }>;
  createdAt: string;
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
}
