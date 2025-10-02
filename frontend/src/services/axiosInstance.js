import axios from "axios";

const api = axios.create({
  baseURL: "http://10.1.243.120:5555/api", // Altere para produção conforme necessário
  timeout: 10000, // 10 segundos de timeout
});

// Intercepta todas as requisições e injeta o token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Adiciona headers adicionais para requisições administrativas
    if (isAdminRoute(config.url)) {
      config.headers["X-Admin-Request"] = "true";

      // Verifica se o usuário tem permissões de admin antes de fazer a requisição
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (!user.is_admin) {
            console.warn(
              "Tentativa de acesso a rota administrativa sem permissões"
            );
            return Promise.reject(
              new Error(
                "Acesso negado: permissões de administrador necessárias"
              )
            );
          }
        } catch (error) {
          console.error("Erro ao verificar permissões do usuário:", error);
          return Promise.reject(new Error("Erro de autenticação"));
        }
      }
    }

    return config;
  },
  (error) => {
    console.error("Erro na requisição:", error);
    return Promise.reject(error);
  }
);

// Intercepta todas as respostas
api.interceptors.response.use(
  (response) => {
    // Log de sucesso para rotas administrativas
    if (isAdminRoute(response.config.url)) {
      console.log(
        `Requisição administrativa bem-sucedida: ${response.config.method?.toUpperCase()} ${
          response.config.url
        }`
      );
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const url = error.config?.url || "";

      console.error(`Erro ${status} na requisição para ${url}:`, data);

      switch (status) {
        case 401:
          console.warn("Token expirado ou inválido");
          handleAuthError();
          break;

        case 403:
          console.warn("Acesso negado - permissões insuficientes");
          if (isAdminRoute(url)) {
            console.error(
              "Tentativa de acesso a rota administrativa sem permissões adequadas"
            );
            // Pode redirecionar para uma página de erro ou dashboard
            handleForbiddenError();
          }
          break;

        case 404:
          console.warn(`Recurso não encontrado: ${url}`);
          break;

        case 500:
          console.error("Erro interno do servidor");
          break;

        default:
          console.error(`Erro ${status}:`, data);
      }
    } else if (error.request) {
      console.error("Erro de rede - sem resposta do servidor:", error.request);
    } else {
      console.error("Erro na configuração da requisição:", error.message);
    }

    return Promise.reject(error);
  }
);

/**
 * Verifica se a URL é uma rota administrativa
 * @param {string} url - URL da requisição
 * @returns {boolean} True se for rota administrativa
 */
function isAdminRoute(url) {
  if (!url) return false;

  // rotas que SÃO admin
  const adminRoutes = [
    "/admin/backups",
    "/admin/audit-logs",
    "/admin/system-stats",
    "/admin/create-backup",
    "/admin/delete-backup",
    "/admin/download-backup",
    "/admin/export-audit-logs",
    "/admin/tasks/purge-old",
    "/admin/tasks", // cobre /admin/tasks/:id/purge
  ];

  // rotas que NÃO SÃO admin mesmo dentro de /users, /roles etc
  const excludedRoutes = ["/users/me", "/users/profile"];

  // Se a url tá na lista de exclusão, não é admin
  if (excludedRoutes.includes(url)) {
    console.log(`[isAdminRoute] '${url}' EXCLUÍDA das rotas admin`);
    return false;
  }

  // Checa se começa com /admin (tipo /admin/settings)
  if (url.startsWith("/admin")) return true;

  // Verifica se a url é ou começa com uma rota admin
  return adminRoutes.some(
    (route) => url === route || url.startsWith(route + "/")
  );
}

/**
 * Manipula erros de autenticação (401)
 */
function handleAuthError() {
  // Limpa dados de autenticação
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
  localStorage.removeItem("refresh_token");

  // Redireciona para login
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

/**
 * Manipula erros de permissão (403)
 */
function handleForbiddenError() {
  // Pode mostrar uma mensagem de erro ou redirecionar
  console.warn("Redirecionando devido a acesso negado");

  // Opção 1: Redirecionar para dashboard
  if (window.location.pathname.includes("/admin/")) {
    window.location.href = "/dashboard";
  }

  // Opção 2: Mostrar modal de erro (implementar conforme necessário)
  // showErrorModal('Acesso negado', 'Você não tem permissões para acessar este recurso.');
}

/**
 * Função auxiliar para fazer requisições com retry automático
 * @param {Function} requestFn - Função que faz a requisição
 * @param {number} maxRetries - Número máximo de tentativas
 * @returns {Promise} Resultado da requisição
 */
export async function requestWithRetry(requestFn, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      // Não faz retry para erros de autenticação/autorização
      if (error.response && [401, 403].includes(error.response.status)) {
        throw error;
      }

      // Aguarda um tempo antes de tentar novamente
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Função para verificar se o servidor está acessível
 * @returns {Promise<boolean>} True se o servidor estiver acessível
 */
export async function checkServerHealth() {
  try {
    await api.get("/health"); // Assumindo que existe um endpoint de health check
    return true;
  } catch (error) {
    console.error("Servidor não está acessível:", error);
    return false;
  }
}

export default api;
