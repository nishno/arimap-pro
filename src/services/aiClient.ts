import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
/** AI calls must use an authenticated server endpoint; no browser API keys. */
export const aiClient = {
  models: {
    async generateContent(parameters: GenerateContentParameters): Promise<GenerateContentResponse> {
      const local=Boolean((window as any).__AGRIMAP_LOCAL__);
      const endpoint = local?'/api/local/ai':import.meta.env.VITE_AI_ENDPOINT||'/api/ai';
      if (!endpoint) throw new Error('AI is not connected yet. Configure the authenticated AI service to enable this feature.');
      if (!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('AI endpoint must be on the same origin.');
      const { auth } = await import('../firebase');
      const user = auth?.currentUser;
      if (!user&&!local) throw new Error('Sign in to use AI features.');
      const token = local?'':await user!.getIdToken();
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token?{Authorization: `Bearer ${token}`}:{}) }, body: JSON.stringify(parameters) });
      if (!response.ok) {const error=await response.json().catch(()=>({}));throw new Error(error.error||`Gemini service unavailable (${response.status}). Configure the authenticated Gemini backend.`);}
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('AI service is unavailable.');
      return response.json();
    }
  }
};
