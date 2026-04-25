import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach token from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally:
// - If a token WAS present → session expired → clear it and redirect to login
// - If no token was present → just an unauthenticated request (e.g. polling
//   notifications as a guest) → let the error propagate silently
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem("token");
      localStorage.removeItem("token");
      if (hadToken) {
        // Token existed but was rejected → expired / invalid → force re-login
        window.location.href = "/login";
      }
      // No token → silent fail; React Query will surface the error if needed
    }
    return Promise.reject(error);
  },
);

export default client;
