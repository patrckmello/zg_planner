import axios from "axios";

const api = axios.create({
  baseURL: "http://10.1.243.120:5555/api",
  timeout: 10000,
});

/* ----------------- Helpers de sessão ----------------- */
function handleAuthError() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

function handleForbiddenError() {
  console.warn("Redirecionando devido a acesso negado");
  if (window.location.pathname.includes("/admin/")) {
    window.location.href = "/dashboard";
  }
}

/* ----------------- Rotas administrativas ----------------- */
function isAdminRoute(url) {
  if (!url) return false;
  const adminRoutes = [
    "/admin/backups",
    "/admin/audit-logs",
    "/admin/system-stats",
    "/admin/create-backup",
    "/admin/delete-backup",
    "/admin/download-backup",
    "/admin/export-audit-logs",
    "/admin/tasks/purge-old",
    "/admin/tasks",
  ];
  const excludedRoutes = ["/users/me", "/users/profile"];
  if (excludedRoutes.includes(url)) return false;
  if (url.startsWith("/admin")) return true;
  return adminRoutes.some((route) => url === route || url.startsWith(route + "/"));
}

/* ----------------- Controle de Refresh/Concorrência ----------------- */
let isRefreshing = false;
let refreshPromise = null;
const refreshSubscribers = [];

function onRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers.length = 0;
}
function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

function decodeJwtExp(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
function isTokenExpiringSoon(token, thresholdMs = 60 * 1000) {
  const expMs = decodeJwtExp(token);
  if (!expMs) return false;
  return Date.now() + thresholdMs >= expMs;
}

/* ----------------- Interceptor de Request ----------------- */
api.interceptors.request.use(
  async (config) => {
    // 1) Checagem de admin (como no teu código)
    if (isAdminRoute(config.url)) {
      config.headers["X-Admin-Request"] = "true";
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (!user.is_admin) {
            return Promise.reject(
              new Error("Acesso negado: permissões de administrador necessárias")
            );
          }
        } catch {
          return Promise.reject(new Error("Erro de autenticação"));
        }
      }
    }

    // 2) Refresh proativo se access está para expirar (<60s)
    const access = localStorage.getItem("access_token");
    const refresh = localStorage.getItem("refresh_token");

    // Não sobrescreva Authorization se já vier definido explicitamente (ex.: chamada de refresh)
    const hasAuthHeader = !!config.headers?.Authorization;

    try {
      if (access && refresh && !isRefreshing && isTokenExpiringSoon(access)) {
        isRefreshing = true;

        refreshPromise = api
          .post(
            "/refresh",
            null,
            {
              // Força usar o refresh_token neste header
              headers: { Authorization: `Bearer ${refresh}` },
            }
          )
          .then((res) => {
            const { access_token, refresh_token } = res.data || {};
            if (access_token) localStorage.setItem("access_token", access_token);
            if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
            return access_token;
          })
          .catch((err) => {
            handleAuthError();
            throw err;
          })
          .finally(() => {
            isRefreshing = false;
            onRefreshed(localStorage.getItem("access_token"));
            refreshPromise = null;
          });

        await refreshPromise;
      }
    } catch {
      // já tratamos no catch acima
    }

    // 3) Injeta o access_token (possivelmente atualizado)
    const finalAccess = localStorage.getItem("access_token") || access;
    if (finalAccess && !hasAuthHeader) {
      config.headers.Authorization = `Bearer ${finalAccess}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ----------------- Interceptor de Response (401 -> refresh + retry) ----------------- */
api.interceptors.response.use(
  (response) => {
    // log opcional para rotas admin
    if (isAdminRoute(response.config.url)) {
      console.log(
        `Admin OK: ${response.config.method?.toUpperCase()} ${response.config.url}`
      );
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";

    if (status === 401 && !original?._retry && !url?.endsWith("/refresh")) {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        handleAuthError();
        return Promise.reject(error);
      }

      original._retry = true;

      // Se já tem refresh em andamento, aguarda e reexecuta
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((newToken) => {
            if (!newToken) {
              handleAuthError();
              return reject(error);
            }
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          });
        });
      }

      // Inicia refresh agora
      isRefreshing = true;
      try {
        const res = await api.post("/refresh", null, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });

        const { access_token, refresh_token } = res.data || {};
        if (access_token) localStorage.setItem("access_token", access_token);
        if (refresh_token) localStorage.setItem("refresh_token", refresh_token);

        isRefreshing = false;
        onRefreshed(access_token);

        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch (refreshErr) {
        isRefreshing = false;
        onRefreshed(null);
        handleAuthError();
        return Promise.reject(refreshErr);
      }
    }

    // Tratativas extras (mantidas do teu código)
    if (error.response) {
      const { status, data } = error.response;
      const url = error.config?.url || "";
      console.error(`Erro ${status} na requisição para ${url}:`, data);

      switch (status) {
        case 403:
          if (isAdminRoute(url)) handleForbiddenError();
          break;
        case 404:
          console.warn(`Recurso não encontrado: ${url}`);
          break;
        case 500:
          console.error("Erro interno do servidor");
          break;
        default:
          break;
      }
    } else if (error.request) {
      console.error("Erro de rede - sem resposta do servidor:", error.request);
    } else {
      console.error("Erro na configuração da requisição:", error.message);
    }

    return Promise.reject(error);
  }
);

/* ----------------- Utilitários exportados (iguais aos teus) ----------------- */
export async function requestWithRetry(requestFn, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (error.response && [401, 403].includes(error.response.status)) {
        throw error;
      }
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export async function checkServerHealth() {
  try {
    await api.get("/health");
    return true;
  } catch (error) {
    console.error("Servidor não está acessível:", error);
    return false;
  }
}

export default api;
