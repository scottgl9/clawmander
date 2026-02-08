const FileStore = require('../storage/FileStore');
const { createBudgetCategory } = require('../models/BudgetCategory');
const { createTransaction } = require('../models/Transaction');

class BudgetService {
  constructor(sseManager) {
    this.categoriesStore = new FileStore('budget-categories.json');
    this.transactionsStore = new FileStore('budget-transactions.json');
    this.sse = sseManager;
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

    return {
      month: currentMonth,
      monthName: new Date(currentMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        budget: c.budget,
        spent: c.spent,
        remaining: c.budget - c.spent,
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

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const categories = this.getAllCategories(monthKey);

      const totalBudget = categories.reduce((sum, c) => sum + c.budget, 0);
      const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

      result.push({
        month: date.toLocaleString('default', { month: 'short' }),
        monthFull: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
        monthKey,
        budget: totalBudget,
        spent: totalSpent,
      });
    }

    return result;
  }
}

module.exports = BudgetService;
