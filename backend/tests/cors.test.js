const request = require('supertest');
const app = require('../app');

describe('CORS', () => {
  test('allows the production Vercel frontend through preflight', async () => {
    const origin = 'https://fsd-lumen-learn-lms.vercel.app';
    const res = await request(app).options('/api/courses')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });
});
