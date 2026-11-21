import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Expense } from '../src/models/Expense.js';
import { Budget } from '../src/models/Budget.js';

const TEST_DB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker_test';

let server;
let baseUrl;

const api = async (path, { method = 'GET', token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  return { status: res.status, body: json };
};

describe('Expense Tracker Backend API', () => {
  let tokenA;
  let tokenB;
  let userBExpenseId;
  let userBBudgetId;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await mongoose.connect(TEST_DB_URI);
    await Promise.all([User.deleteMany({}), Expense.deleteMany({}), Budget.deleteMany({})]);

    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    await Promise.all([User.deleteMany({}), Expense.deleteMany({}), Budget.deleteMany({})]);
    await mongoose.disconnect();
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /api/health returns connected status', async () => {
    const res = await api('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.dbState, 'connected');
  });

  describe('Authentication', () => {
    it('registers User A and omits passwordHash', async () => {
      const res = await api('/auth/register', {
        method: 'POST',
        body: { name: 'Alice Rahman', email: 'alice@example.com', password: 'Password123' },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.email, 'alice@example.com');
      assert.equal(res.body.data.user.passwordHash, undefined);
      tokenA = res.body.data.token;
    });

    it('rejects duplicate email with 409', async () => {
      const res = await api('/auth/register', {
        method: 'POST',
        body: { name: 'Alice Duplicate', email: 'alice@example.com', password: 'Password123' },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
    });

    it('rejects invalid credentials with 401', async () => {
      const res = await api('/auth/login', {
        method: 'POST',
        body: { email: 'alice@example.com', password: 'WrongPassword1' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('logs in User A and fetches /auth/me', async () => {
      const loginRes = await api('/auth/login', {
        method: 'POST',
        body: { email: 'alice@example.com', password: 'Password123' },
      });
      assert.equal(loginRes.status, 200);
      tokenA = loginRes.body.data.token;

      const meRes = await api('/auth/me', { token: tokenA });
      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.data.user.name, 'Alice Rahman');
    });

    it('blocks protected endpoints without token', async () => {
      const res = await api('/expenses');
      assert.equal(res.status, 401);
    });

    it('registers User B for isolation testing', async () => {
      const res = await api('/auth/register', {
        method: 'POST',
        body: { name: 'Bob Karim', email: 'bob@example.com', password: 'Password123' },
      });
      assert.equal(res.status, 201);
      tokenB = res.body.data.token;
    });

    it('logs out successfully', async () => {
      const res = await api('/auth/logout', { method: 'POST', token: tokenA });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  describe('Expense CRUD, Validation & Authorization', () => {
    let expenseId;

    it('rejects invalid amount and missing fields with 400', async () => {
      const zeroRes = await api('/expenses', {
        method: 'POST',
        token: tokenA,
        body: {
          title: 'Bad Expense',
          amount: 0,
          category: 'Food',
          paymentMethod: 'Cash',
          expenseDate: '2026-11-18',
        },
      });
      assert.equal(zeroRes.status, 400);

      const missingRes = await api('/expenses', {
        method: 'POST',
        token: tokenA,
        body: { amount: 250 },
      });
      assert.equal(missingRes.status, 400);
    });

    it('creates, reads, updates, and deletes an expense', async () => {
      const createRes = await api('/expenses', {
        method: 'POST',
        token: tokenA,
        body: {
          title: 'Office Lunch',
          amount: 350.5,
          category: 'Food',
          paymentMethod: 'Mobile Banking',
          expenseDate: '2026-11-18',
          note: 'Biryani with team',
        },
      });
      assert.equal(createRes.status, 201);
      expenseId = createRes.body.data._id;

      const getRes = await api(`/expenses/${expenseId}`, { token: tokenA });
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.data.amount, 350.5);

      const patchRes = await api(`/expenses/${expenseId}`, {
        method: 'PATCH',
        token: tokenA,
        body: { amount: 400, title: 'Team Lunch Updated' },
      });
      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.amount, 400);
      assert.equal(patchRes.body.data.title, 'Team Lunch Updated');

      const delRes = await api(`/expenses/${expenseId}`, {
        method: 'DELETE',
        token: tokenA,
      });
      assert.equal(delRes.status, 200);
    });

    it('isolates User B expenses from User A', async () => {
      const bCreate = await api('/expenses', {
        method: 'POST',
        token: tokenB,
        body: {
          title: 'Bob Private Expense',
          amount: 999,
          category: 'Shopping',
          paymentMethod: 'Card',
          expenseDate: '2026-11-18',
        },
      });
      assert.equal(bCreate.status, 201);
      userBExpenseId = bCreate.body.data._id;

      const aRead = await api(`/expenses/${userBExpenseId}`, { token: tokenA });
      assert.equal(aRead.status, 404);

      const aUpdate = await api(`/expenses/${userBExpenseId}`, {
        method: 'PATCH',
        token: tokenA,
        body: { title: 'Hacked' },
      });
      assert.equal(aUpdate.status, 404);

      const aDelete = await api(`/expenses/${userBExpenseId}`, {
        method: 'DELETE',
        token: tokenA,
      });
      assert.equal(aDelete.status, 404);
    });
  });

  describe('Analytics Calculations (Daily / Mon-Sun Weekly / Monthly / Category)', () => {
    // Anchor date: Wednesday 2026-11-18
    // Week (Mon -> Sun): 2026-11-16 to 2026-11-22
    // Month: 2026-11-01 to 2026-11-30
    before(async () => {
      const seedExpenses = [
        // Today (Wed 2026-11-18): 500 + 300 = 800
        {
          title: 'Groceries',
          amount: 500,
          category: 'Food',
          paymentMethod: 'Cash',
          expenseDate: '2026-11-18',
        },
        {
          title: 'Uber Ride',
          amount: 300,
          category: 'Transport',
          paymentMethod: 'Mobile Banking',
          expenseDate: '2026-11-18',
        },
        // Same week (Mon 2026-11-16): +1200 -> Week total = 2000
        {
          title: 'Internet Bill',
          amount: 1200,
          category: 'Bills',
          paymentMethod: 'Bank',
          expenseDate: '2026-11-16',
        },
        // Earlier in same month, previous week (Sun 2026-11-15): +10500 -> Month total = 12500
        {
          title: 'Course Fee',
          amount: 10500,
          category: 'Education',
          paymentMethod: 'Card',
          expenseDate: '2026-11-15',
        },
        // Previous month (2026-10-20): 4000 (excluded from Nov month total, included in all-time tx count)
        {
          title: 'October Medicine',
          amount: 4000,
          category: 'Health',
          paymentMethod: 'Cash',
          expenseDate: '2026-10-20',
        },
      ];

      for (const exp of seedExpenses) {
        const res = await api('/expenses', { method: 'POST', token: tokenA, body: exp });
        assert.equal(res.status, 201);
      }
    });

    it('computes exact daily, Mon-Sun weekly, monthly totals and highest category', async () => {
      const res = await api('/analytics/summary?date=2026-11-18', { token: tokenA });
      assert.equal(res.status, 200);

      const d = res.body.data;
      assert.equal(d.todayTotal, 800);
      assert.equal(d.weekTotal, 2000);
      assert.equal(d.monthTotal, 12500);
      assert.equal(d.monthTransactions, 4);
      assert.equal(d.totalTransactions, 5);
      assert.equal(d.highestCategory.category, 'Education');
      assert.equal(d.highestCategory.total, 10500);
      assert.equal(d.highestCategory.percentage, 84);
      assert.equal(d.ranges.weekStart, '2026-11-16');
      assert.equal(d.ranges.weekEnd, '2026-11-22');
    });

    it('computes category breakdown percentages accurately', async () => {
      const res = await api('/analytics/category?period=monthly&date=2026-11-18', {
        token: tokenA,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.totalAmount, 12500);
      assert.equal(res.body.data.categories.length, 4);
      assert.equal(res.body.data.categories[0].category, 'Education');
      assert.equal(res.body.data.categories[0].percentage, 84);
    });

    it('computes spending trend chronologically', async () => {
      const res = await api('/analytics/trend?period=weekly&date=2026-11-18', { token: tokenA });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.totalAmount, 2000);
      assert.deepEqual(
        res.body.data.points.map((p) => [p.label, p.total]),
        [
          ['2026-11-16', 1200],
          ['2026-11-18', 800],
        ]
      );
    });

    it('filters expenses by category, paymentMethod, date, and pagination', async () => {
      const res = await api('/expenses?category=Food&date=2026-11-18&page=1&limit=5', {
        token: tokenA,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.items.length, 1);
      assert.equal(res.body.data.items[0].title, 'Groceries');
      assert.equal(res.body.data.pagination.totalItems, 1);
    });
  });

  describe('Monthly Budget & Edge Cases', () => {
    let budgetId;

    it('returns no-budget state when none is configured', async () => {
      const res = await api('/budgets/current?month=11&year=2026', { token: tokenA });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.hasBudget, false);
      assert.equal(res.body.data.spent, 12500);
      assert.equal(res.body.data.status, 'none');
    });

    it('creates budget = 20,000 BDT with spent = 12,500 BDT -> remaining 7,500 & 62.5%', async () => {
      const res = await api('/budgets', {
        method: 'POST',
        token: tokenA,
        body: { month: 11, year: 2026, amount: 20000 },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.amount, 20000);
      assert.equal(res.body.data.spent, 12500);
      assert.equal(res.body.data.remaining, 7500);
      assert.equal(res.body.data.usagePercentage, 62.5);
      assert.equal(res.body.data.status, 'on_track');
      budgetId = res.body.data.budget._id;
    });

    it('prevents duplicate budget for same user/month/year with 409', async () => {
      const res = await api('/budgets', {
        method: 'POST',
        token: tokenA,
        body: { month: 11, year: 2026, amount: 25000 },
      });
      assert.equal(res.status, 409);
    });

    it('handles equal budget (100%), exceeded budget (>100%), and zero budget (0)', async () => {
      const equalRes = await api(`/budgets/${budgetId}`, {
        method: 'PATCH',
        token: tokenA,
        body: { amount: 12500 },
      });
      assert.equal(equalRes.status, 200);
      assert.equal(equalRes.body.data.remaining, 0);
      assert.equal(equalRes.body.data.usagePercentage, 100);
      assert.equal(equalRes.body.data.status, 'warning');

      const exceededRes = await api(`/budgets/${budgetId}`, {
        method: 'PATCH',
        token: tokenA,
        body: { amount: 10000 },
      });
      assert.equal(exceededRes.status, 200);
      assert.equal(exceededRes.body.data.remaining, -2500);
      assert.equal(exceededRes.body.data.usagePercentage, 125);
      assert.equal(exceededRes.body.data.status, 'exceeded');

      const zeroRes = await api(`/budgets/${budgetId}`, {
        method: 'PATCH',
        token: tokenA,
        body: { amount: 0 },
      });
      assert.equal(zeroRes.status, 200);
      assert.equal(zeroRes.body.data.remaining, -12500);
      assert.equal(zeroRes.body.data.usagePercentage, 100);
      assert.equal(zeroRes.body.data.status, 'exceeded');
    });

    it('isolates User B budget from User A and deletes budget cleanly', async () => {
      const bBudget = await api('/budgets', {
        method: 'POST',
        token: tokenB,
        body: { month: 11, year: 2026, amount: 15000 },
      });
      assert.equal(bBudget.status, 201);
      userBBudgetId = bBudget.body.data.budget._id;

      const aPatchB = await api(`/budgets/${userBBudgetId}`, {
        method: 'PATCH',
        token: tokenA,
        body: { amount: 1 },
      });
      assert.equal(aPatchB.status, 404);

      const delA = await api(`/budgets/${budgetId}`, { method: 'DELETE', token: tokenA });
      assert.equal(delA.status, 200);
    });
  });
});
