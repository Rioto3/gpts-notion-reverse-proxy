addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

function buildHeadersWithNotionVersion(baseHeaders) {
  const headers = new Headers(baseHeaders);
  if (!headers.has('Notion-Version')) {
    headers.set('Notion-Version', '2022-06-28');
  }
  return headers;
}

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Notion-Version',
        },
      });
    }

    // Notion Pages APIへのPOSTリクエスト専用の処理
    if (request.method === 'POST' && url.pathname.endsWith('/v1/pages')) {
      let requestData;
      try {
        requestData = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // propertiesAndChildrenStringの処理
      if (requestData.propertiesAndChildrenString) {
        try {
          const parsedData = JSON.parse(requestData.propertiesAndChildrenString);
          
          const newRequestData = {
            ...requestData,
            properties: parsedData.properties,
            children: parsedData.children
          };

          // ヘッダーを Notion-Version 補完付きで再構築
          const headers = buildHeadersWithNotionVersion(request.headers);
          const newRequest = new Request(request.url.slice(url.origin.length + 1), {
            method: 'POST',
            headers,
            body: JSON.stringify(newRequestData)
          });
          
          return await fetch(newRequest);
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid propertiesAndChildrenString', details: e.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // 通常のリクエスト処理
    const headers = buildHeadersWithNotionVersion(request.headers);
    const targetUrl = request.url.slice(url.origin.length + 1);
    let response = await fetch(targetUrl, {
      method: request.method,
      headers,
      redirect: 'follow',
      body: request.body,
    });

    // CORS ヘッダー設定
    response = new Response(response.body, response);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Accept, Authorization, Content-Type, Notion-Version');
    
    return response;
  } catch (e) {
    return new Response(e.stack || e.toString(), { status: 500 });
  }
}
