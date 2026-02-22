// TODO: Replace with real authentication (Firebase, Auth0, Supabase, etc.)
import { api } from './api';

export const authService = {
  async login(email, password) {
    // TODO: POST /api/auth/login
    return { email, name: email.split('@')[0], token: 'mock-token' };
  },

  async signup(email, password, name) {
    // TODO: POST /api/auth/signup
    return { email, name, token: 'mock-token' };
  },

  async resetPassword(email) {
    // TODO: POST /api/auth/reset-password
    return { success: true };
  },
};
