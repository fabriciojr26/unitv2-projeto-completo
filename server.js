// server.js
// Este único arquivo irá:
// 1. Rodar nosso servidor de API para o Facebook.
// 2. Servir os arquivos do seu site (da pasta 'public').

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

// --- CONFIGURAÇÃO DO SERVIDOR DE API ---

// Middleware para entender o formato JSON enviado pelo navegador
app.use(express.json({ type: ['application/json', 'text/plain'] }));

// Endpoint que receberá os eventos do seu site (/api/capi)
app.post('/api/capi', async (req, res) => {
  const accessToken = process.env.FB_ACCESS_TOKEN;
  const pixelId = process.env.FB_PIXEL_ID || "222356937447578";
  const testCode = process.env.FB_TEST_EVENT_CODE || null;

  if (!accessToken) {
    console.error("ERRO: FB_ACCESS_TOKEN não está configurado no servidor.");
    return res.status(500).json({ error: "Configuração do servidor incompleta." });
  }

  const payload = req.body;
  if (!payload.event_id) {
    return res.status(400).json({ error: "O 'event_id' é obrigatório para deduplicação." });
  }
  
  const now = Date.now();
  const headers = req.headers || {};
  // 'x-forwarded-for' é importante para o Render nos dar o IP real do usuário
  const user_ip = headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  
  const body = {
    data: [{
      event_name: payload.event_name,
      event_time: Math.floor(now / 1000),
      action_source: "website",
      event_id: payload.event_id,
      event_source_url: payload.event_source_url,
      user_data: {
        client_ip_address: user_ip,
        client_user_agent: headers['user-agent'],
        fbp: payload.fbp || null,
        fbc: payload.fbc || (payload.fbclid ? `fb.1.${Math.floor(now/1000)}.${payload.fbclid}` : null)
      },
      custom_data: {
        plan: payload.plan,
        action: payload.action
      }
    }],
    access_token: accessToken,
  };

  if (testCode) {
    body.test_event_code = testCode;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const responseText = await response.text();
    console.log("Evento enviado para a CAPI. Resposta do Facebook:", response.status);
    res.status(response.status).send(responseText);
  } catch (err) {
    console.error("Erro ao contatar a API do Facebook:", err);
    res.status(500).json({ error: 'Erro de comunicação com o servidor do Meta.' });
  }
});

// --- SERVINDO O SEU SITE (FRONT-END) ---

// Informa ao Express que a pasta 'public' contém os arquivos do site
app.use(express.static(path.join(__dirname, 'public')));

// Se alguém acessar qualquer rota que não seja a '/api/capi', o servidor entregará o seu site.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- INICIANDO O SERVIDOR ---
// O Render.com nos dará a porta através de process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor completo rodando na porta ${PORT}`);
});

