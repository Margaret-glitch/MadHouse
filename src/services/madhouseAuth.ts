/**
 * MadHouse Authentication Service
 * Worker Endpoints powered by madhouse-db
 */

export const BASE_AUTH = 'https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/auth';

export interface MadHouseUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  provider?: string;
  [key: string]: any;
}

export interface AuthResponse {
  success?: boolean;
  message?: string;
  user?: MadHouseUser;
  error?: string;
}

/**
 * Register a new MadHouse account
 * POST https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/auth/register
 */
export async function registerMadHouse(
  email: string,
  password: string,
  name?: string
): Promise<MadHouseUser> {
  const regRes = await fetch(`${BASE_AUTH}/register`, {
    method: 'POST',
    credentials: 'include', // CRITICAL for receiving session cookie
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password: password.trim(),
      name: name?.trim() || email.split('@')[0]
    })
  });

  const regData: AuthResponse = await regRes.json().catch(() => ({}));

  if (!regRes.ok || !regData.user) {
    const errorMsg = regData.error || regData.message || `Registration failed (${regRes.status})`;
    throw new Error(errorMsg);
  }

  // Cache user info locally for offline fallback
  try {
    localStorage.setItem('madhouse_user', JSON.stringify(regData.user));
    localStorage.setItem('popcorn_user_account', regData.user.email);
  } catch {}

  return regData.user;
}

/**
 * Login to MadHouse account
 * POST https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/auth/login
 */
export async function loginMadHouse(
  email: string,
  password: string
): Promise<MadHouseUser> {
  const loginRes = await fetch(`${BASE_AUTH}/login`, {
    method: 'POST',
    credentials: 'include', // Saves the HttpOnly session cookie in the browser
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password: password.trim()
    })
  });

  const loginData: AuthResponse = await loginRes.json().catch(() => ({}));

  if (!loginRes.ok || !loginData.user) {
    const errorMsg = loginData.error || loginData.message || `Invalid credentials (${loginRes.status})`;
    throw new Error(errorMsg);
  }

  try {
    localStorage.setItem('madhouse_user', JSON.stringify(loginData.user));
    localStorage.setItem('popcorn_user_account', loginData.user.email);
  } catch {}

  return loginData.user;
}

/**
 * Logout current session
 * POST https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/auth/logout
 */
export async function logoutMadHouse(): Promise<void> {
  try {
    await fetch(`${BASE_AUTH}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    console.warn('Logout request warning:', err);
  } finally {
    try {
      localStorage.removeItem('madhouse_user');
      localStorage.removeItem('popcorn_user_account');
    } catch {}
  }
}

/**
 * Check active session on startup / page load
 * GET https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/auth/me
 */
export async function checkAuthSession(): Promise<MadHouseUser | null> {
  try {
    const res = await fetch(`${BASE_AUTH}/me`, {
      method: 'GET',
      credentials: 'include' // MUST be 'include' to pass cookies across origins
    });

    if (res.ok) {
      const data: AuthResponse = await res.json();
      if (data && data.user) {
        try {
          localStorage.setItem('madhouse_user', JSON.stringify(data.user));
          localStorage.setItem('popcorn_user_account', data.user.email);
        } catch {}
        return data.user;
      }
    }

    // No active session or session expired
    try {
      localStorage.removeItem('madhouse_user');
      localStorage.removeItem('popcorn_user_account');
      localStorage.removeItem('madhouse_active_sub');
    } catch {}
    return null;
  } catch (err) {
    console.error('Auth check failed:', err);
    try {
      localStorage.removeItem('madhouse_user');
      localStorage.removeItem('popcorn_user_account');
      localStorage.removeItem('madhouse_active_sub');
    } catch {}
    return null;
  }
}
