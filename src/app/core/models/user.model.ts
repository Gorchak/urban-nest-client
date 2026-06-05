export interface Auth0Identity {
  provider: string;
  connection: string;
  user_id: string;
  isSocial?: boolean;
}

export interface UserDeliveryProfile {
  service?: string;
  areaRef?: string;
  region?: string;
  cityRef?: string;
  city?: string;
  warehouseRef?: string;
  warehouse?: string;
}

export interface UserProfileMetadata {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  phone?: string;
  residentialAddress?: string;
  avatarUrl?: string;
  delivery?: UserDeliveryProfile;
  [key: string]: unknown;
}

export interface UserAppMetadata {
  isAdmin?: boolean;
  isModerator?: boolean;
  [key: string]: unknown;
}

export interface Auth0User {
  userId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  nickname: string;
  picture: string;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
  loginsCount: number;
  identities: Auth0Identity[];
  userMetadata: UserProfileMetadata;
  appMetadata: UserAppMetadata;
}

export interface UsersListResponse {
  data: Auth0User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface UpdateAuth0UserDto {
  email?: string;
  name?: string;
  userMetadata?: UserProfileMetadata;
  appMetadata?: UserAppMetadata;
}
