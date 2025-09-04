// capi-hook.js
// Este script captura o clique no botão do WhatsApp,
// gera um ID único para o evento, dispara o Pixel do Facebook
// e envia os mesmos dados para o nosso servidor em /api/capi.

(function () {
  // Função para criar um ID de evento único (essencial para o Facebook não duplicar eventos)
  function uuidv4() {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Função para ler cookies (usado para pegar _fbp e _fbc do Facebook)
  function getCookie(name) {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  }

  // Função para enviar os dados para o nosso servidor
  function sendCapi(payload) {
    // A URL do nosso endpoint no server.js
    const url = "/api/capi"; 
    const body = JSON.stringify(payload);
    
    // Tenta usar a forma mais moderna e confiável (sendBeacon)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      // Usa o método antigo se o navegador não tiver sendBeacon
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  }

  // "Escuta" por cliques em qualquer lugar da página
  document.addEventListener(
    "click",
    function (e) {
      // Verifica se o clique foi em um botão de ação do WhatsApp
      const btn = e.target.closest("button[data-action][data-plan]");
      if (!btn) return; // Se não for, não faz nada

      const plan = btn.getAttribute("data-plan");
      const action = btn.getAttribute("data-action");
      const eventID = uuidv4(); // Gera o ID único para este clique

      // 1. Dispara o evento no Pixel do Facebook (se o fbq existir na página)
      try {
        if (window.fbq) {
          window.fbq("trackCustom", "WhatsAppClick", { eventID, plan, action });
        }
      } catch (err) {
        console.warn("fbq não foi encontrado. O evento do Pixel não foi disparado.");
      }

      // 2. Prepara os dados para enviar ao nosso servidor
      const payload = {
        event_name: "WhatsAppClick",
        event_id: eventID, // O mesmo ID do Pixel, para deduplicação
        plan,
        action,
        event_source_url: window.location.href, // URL da página onde o clique ocorreu
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        fbclid: new URLSearchParams(window.location.search).get('fbclid')
      };

      // 3. Envia os dados para o nosso servidor
      sendCapi(payload);
    },
    true // O 'true' garante que nosso código rode antes de qualquer outra ação
  );
})();
