# Local XAMPP Setup

This setup runs Aptly as a Node.js/Next.js application on `http://localhost:3000`.
XAMPP is used only for MySQL/MariaDB and phpMyAdmin.

## 1. Start XAMPP

1. Open XAMPP Control Panel.
2. Start **MySQL**.
3. Apache is optional for Aptly, but phpMyAdmin normally uses Apache.
4. Open phpMyAdmin at `http://localhost/phpmyadmin`.

## 2. Create Database

Create a database named:

```sql
aptly_local
```

Use `utf8mb4` / `utf8mb4_unicode_ci`.

## 3. Configure Environment

Copy `.env.local.example` to `.env.local`.

Required local values:

```env
APP_ENV=development
NODE_ENV=development
APP_URL=http://localhost:3000
CANDIDATE_APP_URL=http://localhost:3000
APP_TIMEZONE=Asia/Colombo
DATABASE_URL=mysql://root:@127.0.0.1:3306/aptly_local
DIRECT_DATABASE_URL=mysql://root:@127.0.0.1:3306/aptly_local
EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=<gmail-address>
SMTP_PASSWORD=<gmail-app-password>
SMTP_FROM_EMAIL=<gmail-address>
SMTP_FROM_NAME=Aptly
SMTP_REPLY_TO_EMAIL=<gmail-address>
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=./storage
EVALUATION_PROVIDER=openai
OPENAI_API_KEY=<openai-api-key>
OPENAI_MODEL=gpt-5-mini
OPENAI_API_URL=https://api.openai.com/v1
EVALUATION_PROVIDER_TIMEOUT_MS=30000
TRANSCRIPTION_PROVIDER=development
```

Generate local secret-reference values:

```powershell
npm run local:generate-secrets
```

Do not commit `.env.local`.

## 4. Install, Migrate, Seed

```powershell
npm install
npm run prisma:generate
npm run db:local:migrate
$env:LOCAL_DEMO_COMPANY_ADMIN_EMAIL="admin@example.test"
$env:LOCAL_DEMO_COMPANY_ADMIN_PASSWORD="<strong-password>"
$env:LOCAL_DEMO_HR_EMAIL="hr@example.test"
$env:LOCAL_DEMO_HR_PASSWORD="<strong-password>"
npm run db:local:seed
```

The seed prints the Company Workspace ID. On login choose **Company** and enter that Workspace ID.

## 5. Start Aptly

Option A:

```powershell
.\scripts\start-local.ps1
```

Option B:

```powershell
npm run dev
npm run worker:local
```

Run the web app and worker in separate terminals.

## 6. Smoke Checks

```powershell
npm run local:storage-smoke
$env:LOCAL_SMTP_TEST_RECIPIENT="your-email@example.com"
npm run local:smtp-smoke
npm run local:openai-smoke
npm run local:full-flow-status
```

The full-flow status command prints `PASSED`, `BLOCKED`, or `FAILED` for each step. It does not print passwords, API keys, invitation tokens, candidate URLs, transcripts, or email bodies.

## 7. Stop Aptly

```powershell
.\scripts\stop-local.ps1
```

This stops only Aptly local Node processes. It does not stop or modify XAMPP.
