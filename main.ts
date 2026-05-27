const BASE_URL = "http://er.otbnver.club:80/live/3456456456464653343/2425546343535/";
const USER_AGENT = "NOVAV2AiPlayer";

const CHANNEL_MAP = {
  "bein1k": "527418", 
  "bein2k": "235756",
  "bein3k": "162154",
  "bein4k": "367434"
};

// دوال تشفير وفك تشفير الروابط
function encodeToken(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeToken(str) {
  str = (str + '===').slice(0, str.length + (str.length % 4 ? 4 - str.length % 4 : 0));
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(str);
}

// تشغيل السيرفر على بيئة Deno
Deno.serve(async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // استخراج آي بي الزبون
  const clientIP = request.headers.get('x-forwarded-for') || '197.45.12.33';

  // تجهيز الترويسات التي ستذهب للمصدر (مع دعم Range لحل مشكلة الشاشة السوداء)
  const fetchHeaders = new Headers();
  fetchHeaders.set('User-Agent', USER_AGENT);
  fetchHeaders.set('X-Forwarded-For', clientIP);
  fetchHeaders.set('X-Real-IP', clientIP);

  const range = request.headers.get('range');
  if (range) {
    fetchHeaders.set('Range', range);
  }

  // 1. مسار جلب القناة (m3u8)
  if (path.startsWith('/viber_tv/')) {
    const alias = path.replace('/viber_tv/', '').replace('.m3u8', '');
    const channel_id = CHANNEL_MAP[alias];
    
    if (!channel_id) return new Response("Channel Not Found", { status: 404 });

    const sourceUrl = `${BASE_URL}${channel_id}.m3u8`;
    
    try {
      const response = await fetch(sourceUrl, { headers: fetchHeaders });
      if (!response.ok) return new Response("Source Down", { status: response.status });

      const m3u8Text = await response.text();
      const lines = m3u8Text.split('\n');
      let newM3u8 = '';

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        if (line.endsWith('.ts') || line.includes('.ts?')) {
          const segmentUrl = new URL(line, sourceUrl).toString();
          const token = encodeToken(segmentUrl);
          newM3u8 += `${url.origin}/stream_data?token=${token}\n`;
        } else {
          newM3u8 += line + '\n';
        }
      }

      return new Response(newM3u8, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (err) {
      return new Response("Connection Error", { status: 500 });
    }
  } 
  
  // 2. مسار تحميل أجزاء الفيديو (ts)
  else if (path.startsWith('/stream_data')) {
    const token = url.searchParams.get('token');
    if (!token) return new Response("No Token provided", { status: 400 });

    try {
      const targetUrl = decodeToken(token);
      
      const response = await fetch(targetUrl, { 
          method: request.method, 
          headers: fetchHeaders 
      });

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (err) {
      return new Response("Stream Error", { status: 500 });
    }
  }

  // رسالة ترحيبية للتأكد من عمل السيرفر عند فتح الرابط الأساسي
  return new Response("Deno Proxy is Active! Use /viber_tv/alias.m3u8 to test.", { status: 200 });
});
