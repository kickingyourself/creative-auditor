// Test the new video pin: https://pin.it/2exO0BFwl
async function test() {
  const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  const r = await fetch('https://pin.it/2exO0BFwl', {
    method: 'HEAD', redirect: 'follow',
    headers: { 'User-Agent': BROWSER_UA }
  });
  const rawResolved = r.url;
  console.log('Raw redirect:', rawResolved);

  const m = rawResolved.match(/\/pin\/(\d+)/);
  const pinId = m?.[1];
  const canonical = pinId ? `https://www.pinterest.com/pin/${pinId}/` : rawResolved;
  console.log('Canonical:', canonical, '  pinId:', pinId);

  const r2 = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(canonical)}`, {
    headers: { 'User-Agent': BROWSER_UA }
  });
  const j2 = await r2.json().catch(() => null);
  console.log('oEmbed status:', r2.status);
  console.log('type:', j2?.type);
  console.log('title:', j2?.title);
  console.log('author:', j2?.author_name);
  console.log('thumbnail_url:', j2?.thumbnail_url ? j2.thumbnail_url.slice(0,80)+'...' : null);
  console.log('html snippet:', j2?.html ? j2.html.slice(0,200) : null);
  console.log('full keys:', Object.keys(j2 || {}));
}
test().catch(console.error);
