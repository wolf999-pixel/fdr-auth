Backend skeleton for FDR QR Auth

Setup:
1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:

```bash
cd backend
npm install
```

3. Start dev server:

```bash
npm run dev
```

Notes:
- This is a skeleton. DB integration (Prisma/pg), proper controllers and security are TODO.
- Place QR private/public keys in path configured in `.env`.
 
 Database (Prisma) setup:

1. Ensure `DATABASE_URL` in `.env` is set and Postgres is reachable.
2. Generate Prisma client and run migrations:

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

If `npx prisma migrate` fails (no native extension), you can run `prisma db push` to apply schema without a migration.

Notes:
- Keep private keys outside the repo; use `.env` and a secret manager for production.
- After running migrations, start the server with `npm run dev`.
