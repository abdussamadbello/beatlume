const API_BASE = process.env.API_URL || 'http://localhost:8000';

export async function seedTestData() {
  const signupResp = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E User',
      email: `e2e-${Date.now()}@example.com`,
      password: 'pass1234',
    }),
  });
  const signupData = await signupResp.json();
  const token = signupData.access_token;

  const storyResp = await fetch(`${API_BASE}/api/stories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'E2E Test Story',
      genres: ['Literary'],
    }),
  });
  const story = await storyResp.json();

  return { token, storyId: story.id };
}

export type TestContext = Awaited<ReturnType<typeof seedTestData>>;
