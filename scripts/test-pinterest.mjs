// Test exactly what the updated route now does
async function test() {
  const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  // Step 1: Follow the redirect  
  const r = await fetch('https://pin.it/3dR7iCeVJ', {
    method: 'HEAD', redirect: 'follow',
    headers: { 'User-Agent': BROWSER_UA }
  });
  const rawResolved = r.url;
  console.log('Raw redirect target:', rawResolved);

  // Step 2: Extract pin ID → clean canonical (exactly what resolveToCanonical() does)
  const m = rawResolved.match(/\/pin\/(\d+)/);
  const canonical = m ? `https://www.pinterest.com/pin/${m[1]}/` : rawResolved;
  console.log('Cleaned canonical URL:', canonical);

  // Step 3: oEmbed with CLEANED canonical
  const r2 = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(canonical)}`, {
    headers: { 'User-Agent': BROWSER_UA }
  });
  const j2 = await r2.json().catch(() => null);
  console.log('oEmbed status:', r2.status);
  console.log('error field:', j2?.error);
  console.log('title:', j2?.title);
  console.log('author:', j2?.author_name);
  console.log('thumbnail:', j2?.thumbnail_url ? j2.thumbnail_url.slice(0, 80) + '...' : null);
}
test().catch(console.error);
