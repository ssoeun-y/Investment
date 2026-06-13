export async function POST(req) {
    try {
        const body = await req.json();
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('[AI route] Anthropic error:', data);
            return Response.json(
                { error: data.error?.message ?? 'Anthropic API 오류' },
                { status: res.status }
            );
        }

        return Response.json(data);
    } catch (e) {
        console.error('[AI route] 서버 오류:', e);
        return Response.json({ error: e.message }, { status: 500 });
    }
}
