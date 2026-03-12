---
name: analyze-data
description: Analyze SQLite data and generate structured reports. Use when evaluating data quality, trends, or generating summaries from app.db.
argument-hint: "<table-or-topic>"
context: fork
agent: general-purpose
---

# Analyze Data

Query SQLite database, analyze results, and generate a structured report.

## Usage

```
/analyze-data items
/analyze-data "monthly trends"
```

## When to Use

- To understand data distribution, quality, or trends in the database
- To generate summary reports from existing data
- To validate data integrity before/after migrations
- To explore a table's structure and content

## Workflow

### 1. Identify Target

- Parse argument to determine table name or analysis topic
- Query `sqlite_master` to list available tables if ambiguous
- Confirm scope with user if topic maps to multiple tables

### 2. Schema Discovery

```sql
-- List tables
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Inspect table schema
PRAGMA table_info({table_name});

-- Count rows
SELECT COUNT(*) FROM {table_name};
```

### 3. Data Quality Check

For each target table:

| Check | Query Pattern |
|-------|--------------|
| NULL distribution | `SELECT column, COUNT(*) FILTER (WHERE column IS NULL) FROM ...` |
| Duplicate detection | `SELECT column, COUNT(*) HAVING COUNT(*) > 1` |
| Outlier detection | `SELECT * WHERE value > AVG(value) * 3` |
| FK integrity | `SELECT * FROM child LEFT JOIN parent WHERE parent.id IS NULL` |
| Date gaps | `SELECT date, LAG(date) OVER (ORDER BY date) FROM ...` |

### 4. Trend Analysis (if applicable)

- Group by time period (day/week/month) if date columns exist
- Calculate growth rates, moving averages
- Identify patterns: seasonal, trending, anomalous

### 5. Generate Report

Use output format below. Include actual data samples (limit 10 rows).

## Output Format

```markdown
## Data Analysis: {table_or_topic}

### Schema
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| ... | ... | ... | ... |

### Summary
- **Total rows**: {count}
- **Date range**: {min_date} → {max_date} (if applicable)
- **Key metrics**: {aggregated values}

### Data Quality
- [OK] No NULL values in required columns
- [WARN] {count} duplicate entries in {column}
- [ERROR] {count} orphaned FK references

### Trends (if applicable)
- {trend description with data}

### Sample Data
| col1 | col2 | ... |
|------|------|-----|
| ... | ... | ... |

### Recommendations
- {actionable suggestions based on findings}
```

## Safety Checks

- ALWAYS use parameterized queries for any user-provided values
- ALWAYS limit result sets (`LIMIT 100`) to prevent memory issues
- NEVER modify data — this is a read-only analysis skill
- NEVER expose sensitive data in reports (mask if necessary)

## Related Files

| File | Purpose |
|------|---------|
| `src/server/database/migrations.ts` | Schema definitions |
| `src/server/database/` | Repository implementations |
| `src/shared/types.ts` | TypeScript type definitions |
