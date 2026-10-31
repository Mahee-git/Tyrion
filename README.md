# Tyrion — Personal Finance Tracker

Tyrion is a responsive personal finance tracker built with React, TypeScript, Vite, Recharts and Supabase. The interface uses a liquid-glass inspired dashboard and supports multiple currencies and time zones for display.

## Included

- Overview dashboard with account balances, income, expenses, savings, investments and net worth.
- Separate Expense, Income, Transactions, Investment, Savings Goals, Accounts & Wallets, Reports, Journal & Blog, Admin Dashboard and Settings pages.
- Transaction form that asks for the transaction type first and then reveals the relevant fields.
- Opening balances, accounts and wallets, automatic balance recalculation, and transfers between accounts.
- Custom savings goals with allocations and withdrawals.
- Stock portfolio with first buy from Add Stock, further buy/sell trades, manual market price updates, fees, FIFO cost basis, realised/unrealised P/L, holding duration and dividends.
- Other investments with initial fees, contributions, withdrawals/redemptions, fee tracking, valuation updates, dividends/distributions and activity history.
- Daily/weekly/monthly financial charts and a print-to-PDF report.
- Supabase email/password authentication and private per-user cloud finance data.
- Public Journal & Blog with direct cover-image upload to Supabase Storage. Only the account explicitly promoted to `admin` in Supabase can create, edit, publish or delete posts or upload covers. Ordinary users can read published posts only.
- Light/dark themes, larger text and pointer-responsive liquid-glass highlights.

## Important security model

- GitHub Pages hosts the static frontend. Supabase provides authentication and the database.
- The Supabase publishable/anon key is designed to be included in browser apps. It is not an admin key. Row Level Security (RLS) protects private finance data.
- Never put a Supabase `service_role` or secret key in this project, GitHub Pages, or any `VITE_` variable.
- Every newly registered account has the `user` role. No one can promote themselves from the website. The owner must promote the intended admin account manually in the Supabase SQL Editor.
- With Supabase not configured, the app opens in local demo mode. The Admin Dashboard and blog-writing controls remain hidden; only the configured Supabase admin account can manage posts.

## Deploy from the GitHub website

You do not need to run the project on your Mac first. GitHub Actions will install dependencies, build the site and publish it.

### 1. Create a GitHub repository

1. Sign in at <https://github.com>.
2. Click **New repository**.
3. Name it `tyrion` (or another name you prefer).
4. For GitHub Free, make the repository **Public** to use GitHub Pages.
5. Create the repository with an empty README (do not initialise it with additional files because this project already has its own README).

GitHub Pages websites are public. Do not upload personal financial records, passwords, `.env` files, private keys or exports to the repository.

### 2. Upload the project files

1. Download and extract `tyrion-finance-tracker.zip` on your computer.
2. Open your new GitHub repository.
3. Choose **Add file → Upload files**.
4. Upload the *contents of the extracted folder*, not the ZIP file itself.
5. Keep the folder structure exactly as extracted. In particular, make sure these paths exist in the repository:
   - `src/`
   - `supabase/migrations/001_initial_schema.sql`
   - `.github/workflows/deploy.yml`
   - `package.json`
   - `vite.config.ts`
   - `index.html`
6. Commit the upload to the `main` branch.

The `.github` folder is hidden on some computers. Make sure `.github/workflows/deploy.yml` is included; GitHub uses it to publish the website.

### 3. Create the Supabase project and database

1. Open <https://supabase.com> and create a new project.
2. Choose a strong database password and keep it private.
3. When the project is ready, open **SQL Editor → New query**.
4. On GitHub, open `supabase/migrations/001_initial_schema.sql`, copy the entire file, paste it into the SQL Editor, and click **Run**.
5. In Supabase, open your project's **Connect** dialog or **Project Settings → API Keys** and copy:
   - Project URL
   - Publishable key (the legacy anon key can also be used)

Do not copy the `service_role` or secret key.

### 4. Add the Supabase values to GitHub Actions

1. Open the GitHub repository.
2. Go to **Settings → Secrets and variables → Actions**.
3. Click **New repository secret** and create these two secrets exactly:

   - Name: `VITE_SUPABASE_URL`  
     Value: your Supabase Project URL.
   - Name: `VITE_SUPABASE_PUBLISHABLE_KEY`  
     Value: your Supabase publishable key (or anon key).

4. Save both secrets.

These values are supplied to the Vite build by the GitHub Actions workflow. The publishable key is expected to be visible in a browser app; security comes from your database policies, not from hiding that key.

### 5. Enable GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab.
4. Select **Deploy Tyrion to GitHub Pages** and inspect the latest run. It should install packages, build `dist`, and deploy the artifact.
5. When it succeeds, go back to **Settings → Pages** and open the published site URL.

The workflow runs on pushes to `main`. If your repository uses a different default branch, edit `.github/workflows/deploy.yml` and replace `main` with that branch name.

Your project site URL will usually be:

`https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/`

The app uses relative Vite asset paths and hash-based navigation to work from a GitHub Pages project URL.

### 6. Configure Supabase Auth redirects

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to your GitHub Pages website URL, including the repository path and trailing slash, for example `https://YOUR-GITHUB-USERNAME.github.io/tyrion/`.
3. Add the same URL to **Redirect URLs**. You can also add the matching wildcard URL ending in `/**` if you plan to use other paths under the same project site.
4. Save the settings.

The app uses email/password authentication. If email confirmation is enabled for your Supabase project, confirm the message sent to the user's email before signing in.

### 7. Make your account the only admin

1. Open your deployed Tyrion website.
2. Create your account with the email address that you want to own the blog/admin area.
3. Confirm your email if Supabase asks you to.
4. In Supabase, open **SQL Editor → New query**.
5. Run this query, replacing the email with your exact sign-up email:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR-EMAIL@example.com';
```

6. Sign out of Tyrion and sign back in.

Only that profile will see **Admin Dashboard** and the **Write a post** controls. Other users stay as `user` and can only read published blog posts. Do not run this promotion query for any other email.

## Updating the website later

When you want to change Tyrion, upload the changed project files to the same GitHub repository and commit them to `main`. GitHub Actions will build and publish the new version automatically. You can write, edit, draft and publish blog posts from Tyrion's Admin Dashboard without changing code.

## Exporting reports as PDF

Open **Reports** and click **Export report PDF**. Your browser's print window opens. Choose **Save as PDF** as the destination. The print layout hides the sidebar and navigation so the report is cleaner.

## Currency and timezone

Settings lets each account choose its preferred display currency and timezone. Changing currency changes the display symbol/format only. It does not convert BDT balances into another currency or fetch exchange rates. All amounts are currently tracked as one base currency; keep BDT selected unless you are deliberately using the app with a different single currency.

## Financial logic

- Opening balances are starting cash, not income.
- Transfers move money between accounts and are not income or expenses.
- Expenses debit accounts; income credits accounts.
- Savings allocations are earmarks within your cash balance and do not create expenses or additional assets.
- Stock purchases debit gross cost plus fees; sales credit proceeds after fees. FIFO is used to calculate realised cost basis.
- Other-investment contributions debit the source account; withdrawals/redemptions and dividend income credit the selected account after fees. Valuation updates do not move cash.
- Dividends are tracked separately from normal income and can be included/excluded from the investment performance display.
- Net worth is calculated from account cash plus current stock value plus current other-investment value.

This is a personal tracking tool, not a bank connection or brokerage execution service. All account movements and market values are entered manually.

## Project structure

```text
src/
  App.tsx          Screens, forms and interactions
  finance.ts       Balance, FIFO, P/L and reporting calculations
  store.tsx        Local persistence, Supabase auth and cloud sync
  types.ts         Finance domain types
  styles.css       Responsive glassmorphism design
  main.tsx         React entry point
supabase/
  migrations/      Database schema, trigger and RLS policies
.github/
  workflows/       GitHub Pages deployment workflow
```
