const request = require('supertest');
const { app } = require('../server');
const { pool } = require('../db/init');

describe('Boards API', () => {
  let authToken;
  let testUserId;

  beforeAll(async () => {
    // Create test user and get token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'boardtestuser',
        email: 'boardtest@test.com',
        password: 'password123',
      });

    authToken = registerResponse.body.token;
    testUserId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM boards WHERE owner_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('POST /api/boards', () => {
    it('should create a new board', async () => {
      const response = await request(app)
        .post('/api/boards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Board',
          description: 'Test Description',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Board');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/boards')
        .send({
          title: 'Test Board',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/boards', () => {
    it('should get user boards', async () => {
      const response = await request(app)
        .get('/api/boards')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('boards');
      expect(response.body).toHaveProperty('pagination');
    });
  });
});
