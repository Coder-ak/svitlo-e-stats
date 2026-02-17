const API_BASE_URL = import.meta.env.VITE_API_URL;
const API_PATH = import.meta.env.VITE_API_PATH;

if (!API_BASE_URL || !API_PATH) {
  throw new Error("VITE_API_URL and VITE_API_PATH are required.");
}

export const API_BASE = API_BASE_URL;
export const API_ROOT = `${API_BASE_URL}${API_PATH}`;
