import api from "./axiosInstance";

export async function getMsStatus() {
  try {
    const { data } = await api.get("/ms/status");
    return data; // { connected: boolean, email?: string, ... }
  } catch {
    return { connected: false };
  }
}
