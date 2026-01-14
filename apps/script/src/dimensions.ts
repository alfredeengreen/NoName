// Custom Dimensions API
// Supports user-scoped (localStorage), session-scoped, and event-scoped dimensions

interface CustomDimensions {
  [key: string]: string | number | boolean | null;
}

// User-scoped dimensions (persistent across sessions, stored in localStorage)
export function setUserDimension(name: string, value: string | number | boolean | null) {
  try {
    const dims = getUserDimensions();
    if (value === null || value === undefined) {
      delete dims[name];
    } else {
      dims[name] = value;
    }
    localStorage.setItem('_aa_user_dims', JSON.stringify(dims));
  } catch (e) {
    // localStorage not available or quota exceeded
    console.warn('Failed to set user dimension', e);
  }
}

export function getUserDimensions(): CustomDimensions {
  try {
    const dimsStr = localStorage.getItem('_aa_user_dims');
    if (dimsStr) {
      return JSON.parse(dimsStr);
    }
  } catch {
    // Invalid data
  }
  return {};
}

export function clearUserDimension(name: string) {
  setUserDimension(name, null);
}

// Session-scoped dimensions (stored in session, cleared on new session)
let sessionDimensions: CustomDimensions = {};

export function setSessionDimension(name: string, value: string | number | boolean | null) {
  if (value === null || value === undefined) {
    delete sessionDimensions[name];
  } else {
    sessionDimensions[name] = value;
  }
}

export function getSessionDimensions(): CustomDimensions {
  return { ...sessionDimensions };
}

export function clearSessionDimension(name: string) {
  delete sessionDimensions[name];
}

export function resetSessionDimensions() {
  sessionDimensions = {};
}

// Event-scoped dimensions (passed per event, not stored)
// These are handled by the caller when sending events

// Experiment variant reading (from localStorage or cookie)
export function getExperimentVariant(storageType: 'localStorage' | 'cookie', storageKey: string): string | null {
  try {
    if (storageType === 'localStorage') {
      return localStorage.getItem(storageKey);
    } else if (storageType === 'cookie') {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === storageKey) {
          return decodeURIComponent(value);
        }
      }
    }
  } catch (e) {
    // Storage not available
  }
  return null;
}

// Global API exposed to window.aa
export const dimensions = {
  setUser: setUserDimension,
  getUser: getUserDimensions,
  clearUser: clearUserDimension,
  setSession: setSessionDimension,
  getSession: getSessionDimensions,
  clearSession: clearSessionDimension,
  getExperimentVariant: getExperimentVariant,
};

