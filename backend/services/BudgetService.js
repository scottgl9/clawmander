const FileStore = require('../storage/FileStore');
const { createBudgetCategory } = require('../models/BudgetCategory');
const { createTransaction } = require('../models/Transaction');
const fs = require('fs');
const path = require('path');

class BudgetService {
  constructor(sseManager) {
    this.categoriesStore = new FileStore('budget-categories.json');
    this.transactionsStore = new FileStore('budget-transactions.json');
    this.sse = sseManager;
    this.incomeFilePath = path.join(__dirname, '../storage/data/monthly-income.json');
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

    const totalBudget = categories.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

    // Helper to round to 2 decimal places
    const round2 = (num) => Math.round(num * 100) / 100;

    // Get actual monthly income from cache
    const monthlyIncome = this.getMonthlyIncome(currentMonth);
    const netCashFlow = round2(monthlyIncome - totalSpent);
    const isPositive = netCashFlow > 0;

    // Parse month correctly (avoid timezone issues)
    const [yearNum, monthNum] = currentMonth.split('-');
    const monthDate = new Date(parseInt(yearNum), parseInt(monthNum) - 1, 1);
    
    return {
      month: currentMonth,
      monthName: monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalBudget: round2(totalBudget),
      totalSpent: round2(totalSpent),
      remaining: round2(totalBudget - totalSpent),
      income: round2(monthlyIncome),
      netCashFlow: netCashFlow,
      isPositive: isPositive,
      savingsRate: monthlyIncome > 0 ? round2((netCashFlow / monthlyIncome) * 100) : 0,
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        budget: round2(c.budget),
        spent: round2(c.spent),
        remaining: round2(c.budget - c.spent),
        percentage: c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0,
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

  getTrends(months = 6) {
    const result = [];
    const now = new Date();

    // Helper to round to 2 decimal places
    const round2 = (num) => Math.round(num * 100) / 100;

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const categories = this.getAllCategories(monthKey);

      const totalBudget = categories.reduce((sum, c) => sum + c.budget, 0);
      const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
      
      // Get actual monthly income from cache
      const monthlyIncome = this.getMonthlyIncome(monthKey);
      const netCashFlow = round2(monthlyIncome - totalSpent);
      const isPositive = netCashFlow > 0;

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
      });
    }

    return result;
  }
}

module.exports = BudgetService;
