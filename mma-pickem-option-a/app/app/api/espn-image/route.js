export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const profileUrl = searchParams.get('url');

  if (!profileUrl || !profileUrl.startsWith('https://www.espn.com/')) {
    return Response.json({ image: null }, { status: 400 });
  }

  try {
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return Response.json({ image: null }, { status: 200 });
    }

    const html = await response.text();

    const ogImageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );

    const twitterImageMatch = html.match(
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
    );

    const image = ogImageMatch?.[1] || twitterImageMatch?.[1] || null;

    return Response.json({ image });
  } catch {
    return Response.json({ image: null }, { status: 200 });
  }
}
