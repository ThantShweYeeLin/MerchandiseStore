// Backend + mock-AD base URLs for local dev/demo. In production these would
// come from a build-time env var (e.g. import.meta.env.VITE_API_BASE_URL)
// pointing at the real deployed API and real AD tenant instead.
export const API_BASE_URL = "http://localhost:3000";
export const MOCK_AD_BASE_URL = "http://localhost:4001";
