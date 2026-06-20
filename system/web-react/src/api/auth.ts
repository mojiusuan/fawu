import { api } from './client';
import type { LoginRequest, LoginResponse, UserInfo, UserCreateRequest } from '../types';

export const authApi = {
  login(data: LoginRequest) {
    return api.post<LoginResponse>('/api/auth/login', data);
  },
  getMe() {
    return api.get<UserInfo>('/api/auth/me');
  },
  getUsers() {
    return api.get<UserInfo[]>('/api/auth/users');
  },
  createUser(data: UserCreateRequest) {
    return api.post<UserInfo>('/api/auth/users', data);
  },
  updateUser(userId: string, data: Partial<UserCreateRequest>) {
    return api.put<UserInfo>(`/api/auth/users/${userId}`, data);
  },
  deleteUser(userId: string) {
    return api.delete<void>(`/api/auth/users/${userId}`);
  },
};
