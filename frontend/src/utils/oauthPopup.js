import api from "../services/axiosInstance";

export function openMsPopup({ onSuccess, onError, pollMs = 600 } = {}) {
  let popup, timer;

  function cleanup() {
    window.removeEventListener("message", onMsg);
    if (timer) clearInterval(timer);
    try { if (popup && !popup.closed) popup.close(); } catch {}
  }

  function onMsg(ev) {
    const d = ev?.data || {};
    if (d?.source !== "zg_planner" || d?.provider !== "microsoft") return;
    cleanup();
    if (d.status === "ok") onSuccess?.(d);
    else onError?.(new Error("Falha ao conectar Microsoft"));
  }

  window.addEventListener("message", onMsg);

  return api.get("/ms/connect_url")
    .then(({ data }) => {
      popup = window.open(
        data.url,
        "ms_oauth_popup",
        "width=560,height=700,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
      );
      if (!popup) {
        cleanup();
        throw new Error("Popup bloqueado pelo navegador");
      }
      timer = setInterval(() => {
        if (!popup || popup.closed) {
          cleanup();
          onError?.(new Error("Popup fechado sem concluir"));
        }
      }, pollMs);
    })
    .catch((e) => {
      cleanup();
      onError?.(e);
    });
}
