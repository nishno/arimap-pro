// Shared authenticated Gemini gateway. Secrets are read only on this server.
export function createAiService({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash', generate, now = Date.now } = {}) {
    const windows = new Map();
    let client;
    return async function generateForUser(userId, input) {
        if (!userId)
            throw Object.assign(Error('Sign in to use Gemini.'), { status: 401 });
        if (!input || !input.contents)
            throw Object.assign(Error('A prompt is required.'), { status: 400 });
        const stamp = now(), bucket = windows.get(userId) || { at: stamp, count: 0 };
        if (stamp - bucket.at > 60000) {
            bucket.at = stamp;
            bucket.count = 0;
        }
        if (++bucket.count > 20)
            throw Object.assign(Error('Too many AI requests. Try again in a minute.'), { status: 429 });
        windows.set(userId, bucket);
        if (windows.size > 10000)
            for (const [id, item] of windows)
                if (stamp - item.at > 60000)
                    windows.delete(id);
        if (!generate && !apiKey)
            throw Object.assign(Error('Gemini is not configured on this server. Set GEMINI_API_KEY in the server environment and restart.'), { status: 503 });
        const config = { ...input.config };
        delete config.tools;
        delete config.httpOptions;
        config.maxOutputTokens = Math.min(Number(config.maxOutputTokens) || 4096, 8192);
        try {
            if (!generate && !client) {
                const { GoogleGenAI } = await import('@google/genai');
                client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 45000 } });
            }
            const result = await (generate || ((params) => client.models.generateContent(params)))({ model, contents: input.contents, config });
            const text = result.text ?? result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
            if (!text)
                throw Error('No response content');
            return { text, candidates: result.candidates, modelVersion: result.modelVersion || model };
        }
        catch (error) {
            throw Object.assign(Error(error.status === 429 ? 'Gemini quota exceeded. Check the server billing/quota.' : 'Gemini request failed. Check server credentials, model availability and connection.'), { status: error.status === 429 ? 429 : 502 });
        }
    };
}
export async function readAiInput(req) { let size = 0; const chunks = []; if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))
    throw Object.assign(Error('Send application/json'), { status: 415 }); for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024)
        throw Object.assign(Error('AI request too large'), { status: 413 });
    chunks.push(chunk);
} try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
catch {
    throw Object.assign(Error('Invalid JSON'), { status: 400 });
} }
export async function verifyCloudUser(token) {
    if (!token)
        throw Object.assign(Error('Sign in to use Gemini.'), { status: 401 });
    try {
        const { getApps, initializeApp, applicationDefault } = await import('firebase-admin/app');
        const { getAuth } = await import('firebase-admin/auth');
        const app = getApps().find(app => app.name === 'agrimap-ai') || initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID }, 'agrimap-ai');
        const claims = await getAuth(app).verifyIdToken(token, true);
        return claims.uid;
    }
    catch {
        throw Object.assign(Error('Firebase token could not be verified. Check server Firebase credentials and sign in again.'), { status: 401 });
    }
}
