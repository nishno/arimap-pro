import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai';
/** AI calls must use an authenticated server endpoint; no browser API keys. */
export const aiClient = {
  models: {
    async generateContent(parameters: GenerateContentParameters): Promise<GenerateContentResponse> {
      const endpoint = import.meta.env.VITE_AI_ENDPOINT;
      if (!endpoint) throw new Error('AI is not connected yet. Configure the authenticated AI service to enable this feature.');
      if (!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('AI endpoint must be on the same origin.');
      const { auth } = await import('../firebase');
      const user = auth?.currentUser;
      if (!user) throw new Error('Sign in to use AI features.');
      const token = await user.getIdToken();
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(parameters) });
      if (!response.ok) throw new Error(`AI service request failed (${response.status}). Please try again later.`);
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('AI service is unavailable.');
      return response.json();
    }
  }
};
