export interface BackendUser {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: BackendUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ActivityLogPayload {
  userId: string;
  activity: string;
  confidence: number;
  timestamp: number;
}

export interface ActivityLogItem {
  id: string;
  userId: string;
  activity: string;
  confidence: number;
  timestamp: number;
  createdAt: string;
}

export interface ActivityHistoryResponse {
  items: ActivityLogItem[];
  total: number;
}

export interface ActivityDeleteHistoryResponse {
  deletedCount: number;
}

export interface ActivityDeleteHistoryRange {
  startTimestamp?: number;
  endTimestamp?: number;
}

export interface ActivityStatItem {
  activity: string;
  count: number;
  totalTimeMs: number;
}

export interface ActivityStatsResponse {
  userId: string;
  totalLogs: number;
  activities: ActivityStatItem[];
}

export type AuthSession = AuthTokenResponse;
