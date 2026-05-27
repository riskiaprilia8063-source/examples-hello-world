export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    const targetHost = "http://iptv-premium-ott.com:80";
    const workerHost = url.protocol + "//" + url.host;
    
    // بياناتك المخفية
    const secretUser = "GHU63295";
    const secretPass = "CFM90315";

    // إخفاء اليوزر في الرابط
    let internalPath = url.pathname;
    if (internalPath.startsWith('/live/') && !internalPath.includes(secretUser)) {
       internalPath = internalPath.replace('/live/', `/live/${secretUser}/${secretPass}/`);
    }

    const targetUrl = targetHost + internalPath + url.search;
    
    // تنظيف الترويسات وحقن حماية الـ IP والـ Smart TV
    const newHeaders = new Headers(request.headers);
    newHeaders.delete("Host");
    newHeaders.delete("Referer");
    newHeaders.delete("CF-Connecting-IP");
    
    const officialIP = "104.28.162.139"; 
    newHeaders.set("X-Forwarded-For", officialIP);
    newHeaders.set("X-Real-IP", officialIP);
    newHeaders.set("True-Client-IP", officialIP);
    newHeaders.set("User-Agent", "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/5.0 TV Safari/538.1");
    
    // هنا تركنا الـ Host ليتعامل معه fetch طبيعياً لمنع خطأ 1003
    // newHeaders.set("Host", "rxtx.ovh:18800"); 

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: newHeaders,
      redirect: "manual" // رجعنا للطريقة اليدوية المستقرة 100%
    });

    // 1. معالجة التوجيه (Token) مع إضافة منع الكاش الجذري لمنع التقطيع
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      let location = response.headers.get("Location");
      if (location) {
        // طمس أي IP لسيرفر التوزيع
        let newLocation = location.replace(/http:\/\/[^\/\n]+/, workerHost);
        if (newLocation.startsWith('/')) {
            newLocation = workerHost + newLocation;
        }
        return new Response(null, {
            status: response.status,
            headers: {
                "Location": newLocation,
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store, no-cache, must-revalidate", // إجبار المشغل على جلب توكن جديد
                "Pragma": "no-cache",
                "Expires": "0"
            }
        });
      }
    }

    // 2. معالجة قائمة التشغيل (m3u8) لمنع الكاش وتجديد البث
    if (url.pathname.endsWith(".m3u8") || (response.headers.get("Content-Type") || "").includes("mpegurl")) {
      let text = await response.text();
      text = text.replace(/http:\/\/[^\/\n]+/g, workerHost); 
      
      let modifiedResponse = new Response(text, response);
      modifiedResponse.headers.set("Access-Control-Allow-Origin", "*");
      modifiedResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      modifiedResponse.headers.set("Pragma", "no-cache");
      modifiedResponse.headers.set("Expires", "0");
      return modifiedResponse;
    }

    // 3. تمرير أجزاء الفيديو
    let finalResponse = new Response(response.body, response);
    finalResponse.headers.set("Access-Control-Allow-Origin", "*");
    return finalResponse;
  }
}
