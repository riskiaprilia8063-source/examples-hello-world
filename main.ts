const BASE_URL = "http://iptv-premium-ott.com:80/live/GHU63295/CFM90315/";
const USER_AGENT = "NOVAV2AiPlayer";

// قائمة قنواتك
const CHANNEL_MAP = {
  "bein14K": "402389", 
  "bein24K": "78379",
  "bein34K": "13606",
  "bein44K": "78381",
  "bein54K": "78382",
  "bein64K": "78383",
  "bein74K": "78384",
  "bein1FHD": "13608",
  "bein2FHD": "368731",
  "bein3FHD": "13606",
  "bein4FHD": "13675",
  "bein5FHD": "13673",
  "bein6FHD": "13587",
  "bein7FHD": "13602",
  "bein1HD": "13682",
  "bein2HD": "13680",
  "bein3HD": "13678",
  "bein4HD": "13676",
  "bein5HD": "13674",
  "bein6HD": "13672",
  "bein7HD": "13576",
  "bein1SD": "13614",
  "bein2SD": "13615",
  "bein3SD": "13616",
  "bein4SD": "13617",
  "bein5SD": "13618",
  "bein6SD": "13614",
  "bein7SD": "13641"
};

// دوال التشفير
function encodeToken(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeToken(str) {
  str = (str + '===').slice(0, str.length + (str.length % 4 ? 4 - str.length % 4 : 0));
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(str);
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  const fetchHeaders = new Headers();
  fetchHeaders.set('User-Agent', USER_AGENT);
  
  // دعم المشغلات (حل الشاشة السوداء)
  const range = request.headers.get('range');
  if (range) {
    fetchHeaders.set('Range', range);
  }

  // 1. مسار جلب ملف M3U8
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
        
        // التعديل الجذري: أي سطر لا يحتوي على # هو حتماً رابط فيديو!
        if (!line.startsWith('#')) {
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
  
  // 2. مسار تحميل الفيديو
  else if (path.startsWith('/stream_data')) {
    const token = url.searchParams.get('token');
    if (!token) return new Response("No Token provided", { status: 400 });

    try {
      const targetUrl = decodeToken(token);
      
      const response = await fetch(targetUrl, { 
          method: request.method, 
          headers: fetchHeaders 
      });

      // تمرير الهيدرز الأصلية للمشغل
      const responseHeaders = new Headers();
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      
      if (response.headers.has('Content-Type')) {
        responseHeaders.set('Content-Type', response.headers.get('Content-Type') || '');
      } else {
        responseHeaders.set('Content-Type', 'video/mp2t');
      }
      
      if (response.headers.has('Content-Length')) {
        responseHeaders.set('Content-Length', response.headers.get('Content-Length') || '');
      }
      if (response.headers.has('Content-Range')) {
        responseHeaders.set('Content-Range', response.headers.get('Content-Range') || '');
      }

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (err) {
      return new Response("Stream Error", { status: 500 });
    }
  }

  return new Response("System Online - Deno Edge Router", { status: 200 });
});
