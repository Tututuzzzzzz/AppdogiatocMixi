import axios, { AxiosError, isAxiosError } from 'axios';
import { Platform } from 'react-native';

import type {
  ActivityDeleteHistoryResponse,
  ActivityDeleteHistoryRange,
  ActivityHistoryResponse,
  ActivityLogItem,
  ActivityLogPayload,
  ActivityStatsResponse,
  AuthTokenResponse,
  BackendUser,
  LoginPayload,
  RegisterPayload,
} from '@/src/modules/backend/types';

type ErrorPayload = {
  detail?: string;
  message?: string;
  errors?: Array<{
    msg?: string;
    loc?: Array<string | number>;
  }>;
};

function readValidationMessage(payload?: ErrorPayload): string | null {
  const message = payload?.errors?.[0]?.msg?.trim();
  return message && message.length > 0 ? message : null;
}

function readResponseMessage(payload?: ErrorPayload): string | null {
  const detail = payload?.detail?.trim();
  if (detail) {
    return detail;
  }

  const validationMessage = readValidationMessage(payload);
  if (validationMessage) {
    return validationMessage;
  }

  const message = payload?.message?.trim();
  return message && message.length > 0 ? message : null;
}

function resolveBackendBaseUrl(): string {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
}

const backendBaseUrl = resolveBackendBaseUrl();

const backendClient = axios.create({
  baseURL: backendBaseUrl,
  timeout: 12000,
});

function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorPayload>;

    const responseMessage = readResponseMessage(axiosError.response?.data);
    if (responseMessage) {
      return responseMessage;
    }

    if (axiosError.message === 'Network Error') {
      return `Không thể kết nối backend tại ${backendBaseUrl}. Nếu đây là APK cài trên điện thoại thật, hãy đặt EXPO_PUBLIC_BACKEND_URL thành URL public (HTTPS) và build lại app.`;
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Không thể kết nối máy chủ.';
}

function buildAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function registerUser(payload: RegisterPayload): Promise<AuthTokenResponse> {
  try {
    const response = await backendClient.post<AuthTokenResponse>('/auth/register', {
      email: payload.email,
      password: payload.password,
      fullName: payload.fullName,
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function loginUser(payload: LoginPayload): Promise<AuthTokenResponse> {
  try {
    const response = await backendClient.post<AuthTokenResponse>('/auth/login', {
      email: payload.email,
      password: payload.password,
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function fetchCurrentUser(accessToken: string): Promise<BackendUser> {
  try {
    const response = await backendClient.get<BackendUser>('/users/me', {
      headers: buildAuthHeaders(accessToken),
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function postActivityLog(
  accessToken: string,
  payload: ActivityLogPayload
): Promise<ActivityLogItem> {
  try {
    const response = await backendClient.post<ActivityLogItem>('/activities', payload, {
      headers: buildAuthHeaders(accessToken),
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function fetchActivityHistory(
  accessToken: string,
  userId: string,
  limit = 100,
  skip = 0
): Promise<ActivityHistoryResponse> {
  try {
    const response = await backendClient.get<ActivityHistoryResponse>('/activities/history', {
      headers: buildAuthHeaders(accessToken),
      params: {
        userId,
        limit,
        skip,
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function deleteActivityHistory(
  accessToken: string,
  userId: string,
  range?: ActivityDeleteHistoryRange
): Promise<ActivityDeleteHistoryResponse> {
  try {
    const params: Record<string, number | string> = {
      userId,
    };

    if (typeof range?.startTimestamp === 'number') {
      params.startTimestamp = Math.max(0, Math.round(range.startTimestamp));
    }

    if (typeof range?.endTimestamp === 'number') {
      params.endTimestamp = Math.max(0, Math.round(range.endTimestamp));
    }

    const response = await backendClient.delete<ActivityDeleteHistoryResponse>('/activities/history', {
      headers: buildAuthHeaders(accessToken),
      params,
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function fetchActivityStats(
  accessToken: string,
  userId: string
): Promise<ActivityStatsResponse> {
  try {
    const response = await backendClient.get<ActivityStatsResponse>('/activities/stats', {
      headers: buildAuthHeaders(accessToken),
      params: {
        userId,
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function fetchBackendHealth(): Promise<string> {
  try {
    const response = await backendClient.get<{ message: string }>('/health');
    return response.data.message;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function fetchBackendRoot(): Promise<string> {
  try {
    const response = await backendClient.get<{ message: string }>('/');
    return response.data.message;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
