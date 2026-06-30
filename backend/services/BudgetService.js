const FileStore = require('../storage/FileStore');
const { createBudgetCategory } = require('../models/BudgetCategory');
const { createTransaction } = require('../models/Transaction');
const { createSubscription } = require('../models/Subscription');
const fs = require('fs');
const { dataPath } = require('../storage/dataDir');

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const parseMonthKey = (monthKey) => {
  if (typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  return new Date(year, monthIndex, 1);
};

class BudgetService {
  constructor(sseManager) {
    this.categoriesStore = new FileStore('budget-categories.json');
    this.transactionsStore = new FileStore('budget-transactions.json');
    this.statusStore = new FileStore('budget-status.json');
    this.balancesStore = new FileStore('budget-balances.json');
    this.subscriptionsStore = new FileStore('budget-subscriptions.json');
    this.billsStore = new FileStore('bills.json');
    this.networthStore = new FileStore('budget-networth.json');
    this.sse = sseManager;
    this.incomeFilePath = dataPath('monthly-income.json');
  }

  // ── Net worth (liquid cash position) trend ────────────────────────────────
  getNetworth(limit = 12) {
    const rows = this.networthStore.read()
      .slice()
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));
    return typeof limit === 'number' && limit > 0 ? rows.slice(-limit) : rows;
  }

  // Upsert one month's net-worth snapshot (latest snapshot for the month wins).
  recordNetworth(snapshot = {}) {
    const month = snapshot.month || new Date().toISOString().slice(0, 7);
    const round2 = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);
    const rows = this.networthStore.read();
    const payload = {
      month,
      date: snapshot.date || new Date().toISOString().slice(0, 10),
      checking: round2(Number(snapshot.checking) || 0),
      savings: round2(Number(snapshot.savings) || 0),
      cardDebt: round2(Number(snapshot.cardDebt) || 0),
      netWorth: round2(
        snapshot.netWorth != null
          ? Number(snapshot.netWorth)
          : (Number(snapshot.checking) || 0) + (Number(snapshot.savings) || 0) - (Number(snapshot.cardDebt) || 0),
      ),
      reconstructed: !!snapshot.reconstructed,
      updatedAt: new Date().toISOString(),
    };
    const idx = rows.findIndex((r) => r.month === month);
    if (idx >= 0) rows[idx] = payload; else rows.push(payload);
    this.networthStore.write(rows);
    this.sse.broadcast('budget.networth_updated', { month, netWorth: payload.netWorth });
    return payload;
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────
  getSubscriptions(month) {
    const all = this.subscriptionsStore.read();
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const forMonth = all.filter((s) => s.month === currentMonth);
    // Fall back to the latest available month if the requested one is empty.
    if (forMonth.length === 0 && all.length > 0) {
      const latest = all.reduce((max, s) => (s.month > max ? s.month : max), '');
      return all.filter((s) => s.month === latest);
    }
    return forMonth;
  }

  getSubscriptionSummary(month) {
    const subs = this.getSubscriptions(month).filter((s) => s.isSubscription);
    const active = subs.filter((s) => !(s.flags && s.flags.lapsed) && s.status !== 'cancel' && s.status !== 'ignore');
    const round2 = (n) => Math.round(n * 100) / 100;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = active
      .filter((s) => {
        if (!s.predictedNextCharge) return false;
        const d = new Date(s.predictedNextCharge);
        return d >= now && d <= in30;
      })
      .sort((a, b) => new Date(a.predictedNextCharge) - new Date(b.predictedNextCharge));
    return {
      count: subs.length,
      activeCount: active.length,
      lapsedCount: subs.filter((s) => s.flags && s.flags.lapsed).length,
      totalMonthly: round2(active.reduce((sum, s) => sum + (s.monthlyEquivalent || 0), 0)),
      totalAnnual: round2(active.reduce((sum, s) => sum + (s.annualizedCost || 0), 0)),
      flagged: active.filter((s) => s.flags && (s.flags.priceIncrease || s.flags.new || s.flags.duplicateService)).length,
      upcoming: upcoming.map((s) => ({
        merchant: s.merchant,
        amount: s.monthlyEquivalent,
        date: s.predictedNextCharge,
      })),
    };
  }

  // Bulk-replace the detected subscriptions for a month (posted by the agent).
  replaceSubscriptions(month, items = []) {
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const all = this.subscriptionsStore.read().filter((s) => s.month !== currentMonth);
    const created = (items || []).map((item) => createSubscription({ ...item, month: currentMonth }));
    this.subscriptionsStore.write([...all, ...created]);
    this.sse.broadcast('budget.subscriptions_updated', { month: currentMonth, count: created.length });
    return created;
  }

  // Monthly active-subscription cost for the trends view (STRICT month match —
  // no fall-back, so months without a snapshot read as 0 rather than borrowing
  // another month's figure).
  getSubscriptionMonthlyCost(month) {
    if (!month) return 0;
    const subs = this.subscriptionsStore.read().filter(
      (s) => s.month === month && s.isSubscription
        && !(s.flags && s.flags.lapsed) && s.status !== 'cancel' && s.status !== 'ignore',
    );
    return Math.round(subs.reduce((sum, s) => sum + (s.monthlyEquivalent || 0), 0) * 100) / 100;
  }

  // ── Bills (auto-derived; replaces hand-maintained bills.json) ──────────────
  replaceBills(items = []) {
    const rows = (items || []).map((b) => ({
      id: b.id || (b.name ? `${b.name}-${b.dueDate}` : undefined),
      name: b.name || '',
      amount: typeof b.amount === 'number' ? b.amount : Number(b.amount) || 0,
      dueDate: b.dueDate || null,
      recurring: b.recurring !== false,
      category: b.category || 'Other',
      priority: b.priority || 'normal',
      description: b.description || '',
      source: b.source || 'budget-agent',
    }));
    this.billsStore.write(rows);
    this.sse.broadcast('budget.bills_updated', { count: rows.length });
    return rows;
  }

  // Get monthly income from cache file
  getMonthlyIncome(monthKey) {
    try {
      if (fs.existsSync(this.incomeFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.incomeFilePath, 'utf8'));
        const monthData = data.find(m => m.month === monthKey);
        return monthData ? Math.round(monthData.income * 100) / 100 : 8302; // Fallback to average
      }
    } catch (err) {
      console.error('Error reading monthly income:', err);
    }
    return 8302; // Fallback to average
  }

  // Categories
  getAllCategories(month) {
    const categories = this.categoriesStore.read();
    if (month) {
      return categories.filter(c => c.month === month);
    }
    // Return current month by default
    const currentMonth = new Date().toISOString().slice(0, 7);
    return categories.filter(c => c.month === currentMonth);
  }

  getCategoryById(id) {
    return this.categoriesStore.findById(id);
  }

  getStatus(month) {
    const statuses = this.statusStore.read();
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    return statuses.find((s) => s.month === currentMonth) || statuses.find((s) => s.month === undefined) || null;
  }

  upsertStatus(updates) {
    const currentMonth = updates.month || new Date().toISOString().slice(0, 7);
    const statuses = this.statusStore.read();
    const idx = statuses.findIndex((s) => s.month === currentMonth);
    const payload = {
      ...((idx >= 0 && statuses[idx]) || {}),
      ...updates,
      month: currentMonth,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      statuses[idx] = payload;
    } else {
      statuses.push(payload);
    }

    this.statusStore.write(statuses);
    return payload;
  }

  getBalances(month) {
    const balances = this.balancesStore.read();
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    return balances.find((b) => b.month === currentMonth) || balances.find((b) => b.month === undefined) || null;
  }

  upsertBalances(month, updates) {
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const rows = this.balancesStore.read();
    const idx = rows.findIndex((b) => b.month === currentMonth);
    const payload = {
      ...((idx >= 0 && rows[idx]) || {}),
      ...updates,
      month: currentMonth,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      rows[idx] = payload;
    } else {
      rows.push(payload);
    }
    this.balancesStore.write(rows);
    return payload;
  }

  createCategory(data) {
    const category = createBudgetCategory(data);
    this.categoriesStore.insert(category);
    this.sse.broadcast('budget.category_created', category);
    return category;
  }

  updateCategory(id, updates) {
    const category = this.categoriesStore.update(id, updates);
    if (category) {
      this.sse.broadcast('budget.category_updated', category);
    }
    return category;
  }

  deleteCategory(id) {
    const removed = this.categoriesStore.remove(id);
    if (removed) {
      this.sse.broadcast('budget.category_deleted', { categoryId: id });
    }
    return removed;
  }

  getSummary(month) {
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const categories = this.getAllCategories(currentMonth);
    const status = this.getStatus(currentMonth);

    const kindOf = (cat) => {
      if (!cat || !cat.name) return 'variable';
      return (cat.metadata && cat.metadata.budgetKind) || (
        cat.name === 'Fixed Expenses' ? 'fixed' :
        (cat.name === 'Transfer-Internal' || cat.name === 'Transfer-External') ? 'transfer' :
        cat.name === 'Financial' ? 'financial' :
        cat.name === 'Income' ? 'income' : 'variable'
      );
    };

    const fixed = categories.filter((cat) => kindOf(cat) === 'fixed');
    const variable = categories.filter((cat) => kindOf(cat) === 'variable');
    const transfer = categories.filter((cat) => kindOf(cat) === 'transfer');
    const financial = categories.filter((cat) => kindOf(cat) === 'financial');
    const incomeCats = categories.filter((cat) => kindOf(cat) === 'income');

    const sumByKind = (list, key) => list.reduce((sum, c) => sum + toNumber(c[key]), 0);
    const fixedBudget = sumByKind(fixed, 'budget');
    const fixedSpent = sumByKind(fixed, 'spent');
    const variableBudget = sumByKind(variable, 'budget');
    const variableSpent = sumByKind(variable, 'spent');
    const totalBudget = fixedBudget + variableBudget;
    const totalSpent = fixedSpent + variableSpent;
    const remaining = totalBudget - totalSpent;

    // Helper to round to 2 decimal places
    const round2 = (num) => Math.round(num * 100) / 100;

    // Get actual monthly income from cache
    const monthlyIncome = this.getMonthlyIncome(currentMonth);
    const statusTotals = (status && status.totals) || {};
    const projectedNetEOM = statusTotals.projectedNetEOM !== undefined && statusTotals.projectedNetEOM !== null
      ? round2(toNumber(statusTotals.projectedNetEOM))
      : null;
    const netCashFlow = round2(monthlyIncome - totalSpent);
    const isPositive = netCashFlow > 0;

    // Parse month correctly (avoid timezone issues)
    const [yearNum, monthNum] = currentMonth.split('-');
    const monthDate = new Date(parseInt(yearNum), parseInt(monthNum) - 1, 1);
    
    const variableStatus = statusTotals.variablePaceRatio !== undefined ? statusTotals.variablePaceRatio : null;

    return {
      month: currentMonth,
      monthName: monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalBudget: round2(totalBudget),
      totalSpent: round2(totalSpent),
      remaining: round2(remaining),
      fixedBudget: round2(fixedBudget),
      variableBudget: round2(variableBudget),
      fixedSpent: round2(fixedSpent),
      variableSpent: round2(variableSpent),
      variableRemaining: round2(statusTotals.variableRemaining !== undefined ? toNumber(statusTotals.variableRemaining) : (variableBudget - variableSpent)),
      variablePaceRatio: variableStatus,
      projectedNetEom: projectedNetEOM,
      income: round2(monthlyIncome),
      netCashFlow: netCashFlow,
      isPositive: isPositive,
      savingsRate: monthlyIncome > 0 ? round2((netCashFlow / monthlyIncome) * 100) : 0,
      sourceStatus: status ? (status.sourceStatus || {}) : {},
      dataFreshness: {
        sourceGeneratedAt: status ? status.sourceGeneratedAt : null,
        syncedAt: status ? status.syncedAt : null,
        uncategorizedCount: status && status.uncategorizedCount !== undefined ? status.uncategorizedCount : 0,
        source: status ? status.source : 'budget-agent',
      },
      alerts: status ? status.alerts || [] : [],
      balances: this.getBalances(currentMonth),
      budgetsByKind: {
        fixed: round2(fixedBudget),
        variable: round2(variableBudget),
        transfer: round2(sumByKind(transfer, 'budget')),
        financial: round2(sumByKind(financial, 'budget')),
        income: round2(sumByKind(incomeCats, 'budget')),
      },
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        budget: round2(c.budget),
        spent: round2(c.spent),
        budgetKind: kindOf(c),
        paceRatio: c.metadata && c.metadata.paceRatio !== undefined ? c.metadata.paceRatio : null,
        projectedEom: c.metadata && c.metadata.projectedEom !== undefined ? c.metadata.projectedEom : null,
        pctOfTarget: c.metadata && c.metadata.pctOfTarget !== undefined ? c.metadata.pctOfTarget : null,
        overBudget: c.metadata && typeof c.metadata.overBudget === 'boolean' ? c.metadata.overBudget : null,
        remaining: round2(c.budget - c.spent),
        percentage: c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0,
        note: c.metadata && c.metadata.note ? c.metadata.note : '',
      })),
    };
  }

  // Transactions
  getAllTransactions(categoryId, startDate, endDate) {
    let transactions = this.transactionsStore.read();

    if (categoryId) {
      transactions = transactions.filter(t => t.categoryId === categoryId);
    }

    if (startDate) {
      transactions = transactions.filter(t => t.date >= startDate);
    }

    if (endDate) {
      transactions = transactions.filter(t => t.date <= endDate);
    }

    return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getTransactionById(id) {
    return this.transactionsStore.findById(id);
  }

  createTransaction(data) {
    const transaction = createTransaction(data);
    this.transactionsStore.insert(transaction);

    // Update category spent amount
    if (transaction.categoryId) {
      const category = this.getCategoryById(transaction.categoryId);
      if (category) {
        this.updateCategory(transaction.categoryId, {
          spent: category.spent + transaction.amount,
        });
      }
    }

    this.sse.broadcast('budget.transaction_created', transaction);
    return transaction;
  }

  updateTransaction(id, updates) {
    const oldTransaction = this.getTransactionById(id);
    if (!oldTransaction) return null;

    const transaction = this.transactionsStore.update(id, updates);

    // Update category spent amounts if amount or category changed
    if (updates.amount !== undefined || updates.categoryId !== undefined) {
      // Remove old amount from old category
      if (oldTransaction.categoryId) {
        const oldCategory = this.getCategoryById(oldTransaction.categoryId);
        if (oldCategory) {
          this.updateCategory(oldTransaction.categoryId, {
            spent: oldCategory.spent - oldTransaction.amount,
          });
        }
      }

      // Add new amount to new category
      const newCategoryId = updates.categoryId || oldTransaction.categoryId;
      const newAmount = updates.amount !== undefined ? updates.amount : oldTransaction.amount;
      if (newCategoryId) {
        const newCategory = this.getCategoryById(newCategoryId);
        if (newCategory) {
          this.updateCategory(newCategoryId, {
            spent: newCategory.spent + newAmount,
          });
        }
      }
    }

    if (transaction) {
      this.sse.broadcast('budget.transaction_updated', transaction);
    }
    return transaction;
  }

  deleteTransaction(id) {
    const transaction = this.getTransactionById(id);
    if (!transaction) return false;

    // Update category spent amount
    if (transaction.categoryId) {
      const category = this.getCategoryById(transaction.categoryId);
      if (category) {
        this.updateCategory(transaction.categoryId, {
          spent: category.spent - transaction.amount,
        });
      }
    }

    const removed = this.transactionsStore.remove(id);
    if (removed) {
      this.sse.broadcast('budget.transaction_deleted', { transactionId: id });
    }
    return removed;
  }

  getTrends(months = 6, endMonth) {
    const result = [];
    const anchorDate = parseMonthKey(endMonth) || new Date();

    // Helper to round to 2 decimal places
    const round2 = (num) => Math.round(num * 100) / 100;

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const summary = this.getSummary(monthKey);
      const status = this.getStatus(monthKey);
      const totalBudget = summary.totalBudget;
      const totalSpent = summary.totalSpent;

      // Get actual monthly income from cache
      const monthlyIncome = summary.income;
      const netCashFlow = round2(monthlyIncome - totalSpent);
      const isPositive = netCashFlow > 0;
      const projectedNetEOM = summary.projectedNetEom;
      const statusMonth = monthKey;
      const isProjected = statusMonth === new Date().toISOString().slice(0, 7) && projectedNetEOM !== null;

      result.push({
        month: date.toLocaleString('default', { month: 'short' }),
        monthFull: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
        monthKey,
        budget: round2(totalBudget),
        spent: round2(totalSpent),
        income: round2(monthlyIncome),
        netCashFlow: netCashFlow,
        isPositive: isPositive,
        savingsRate: monthlyIncome > 0 ? round2((netCashFlow / monthlyIncome) * 100) : 0,
        isProjected,
        projectedNetEom: projectedNetEOM,
        subscriptionCost: this.getSubscriptionMonthlyCost(monthKey),
        sourceStatus: status ? status.sourceStatus || {} : {},
      });
    }

    return result;
  }
}

module.exports = BudgetService;
