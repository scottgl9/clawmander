# Skill: Budget Management

Manage budget categories and transactions. Creating a transaction automatically updates the category's spent amount.

**Base URL**: `http://localhost:3001`
**Auth**: Write endpoints require `Authorization: Bearer <AUTH_TOKEN>`

---

## Budget Categories

Categories represent spending buckets for a given month (format: `YYYY-MM`).

### Create Category

```
POST /api/budget/categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Groceries",
  "budget": 600,
  "spent": 0,
  "month": "2026-03"
}
```

### Read Categories

```
GET /api/budget/categories?month=2026-03     # List for a month
GET /api/budget/categories/:id               # Single category
```

### Update Category

```
PATCH /api/budget/categories/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "budget": 650, "spent": 87.50 }
```

### Delete Category

```
DELETE /api/budget/categories/:id
Authorization: Bearer <token>
```

---

## Transactions

### Create Transaction

Creating a transaction automatically adds to the category's `spent` amount.

```
POST /api/budget/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "categoryId": "category-uuid",
  "amount": 87.43,
  "description": "Weekly groceries",
  "date": "2026-03-11T14:30:00Z",
  "merchant": "Whole Foods",
  "metadata": { "transactionId": "bank-txn-12345" }
}
```

### Read Transactions

```
GET /api/budget/transactions?categoryId=uuid&startDate=2026-03-01&endDate=2026-03-31
GET /api/budget/transactions/:id
```

### Update Transaction

Updating `amount` or `categoryId` automatically adjusts category spent amounts.

```
PATCH /api/budget/transactions/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "amount": 95.00, "description": "Updated description" }
```

### Delete Transaction

Deleting automatically deducts from the category's spent amount.

```
DELETE /api/budget/transactions/:id
Authorization: Bearer <token>
```

---

## Summary & Trends

```
GET /api/budget/summary?month=2026-03        # Budget overview with category breakdown
GET /api/budget/trends?months=6              # Monthly spending over time
GET /api/budget/upcoming-bills               # Upcoming bills
```

Summary response:
```json
{
  "month": "2026-03",
  "monthName": "March 2026",
  "totalBudget": 4000,
  "totalSpent": 2847.50,
  "remaining": 1152.50,
  "categories": [
    { "id": "uuid", "name": "Housing", "budget": 1200, "spent": 1200, "remaining": 0, "percentage": 100 }
  ]
}
```

---

## Example: Sync a Bank Transaction

```bash
BASE=http://localhost:3001
TOKEN=changeme

# 1. Create (or find) a category for the month
curl -X POST $BASE/api/budget/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Groceries","budget":600,"spent":0,"month":"2026-03"}'

# 2. Add the transaction (use categoryId from above)
curl -X POST $BASE/api/budget/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "<category-uuid>",
    "amount": 87.43,
    "description": "Weekly groceries",
    "date": "2026-03-11T14:30:00Z",
    "merchant": "Whole Foods"
  }'

# 3. Check the summary
curl "$BASE/api/budget/summary?month=2026-03"
```
