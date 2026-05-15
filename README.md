# File Uploader

A small full-stack web app for organizing and storing personal files. Users sign up, get a root **home** folder, then create nested folders, upload files (stored in [Supabase Storage](https://supabase.com/docs/guides/storage)), and download or delete them. Sessions are stored in PostgreSQL via Prisma.

Built as part of [The Odin Project](https://www.theodinproject.com/) curriculum.

## Features

- **Accounts**: Sign up and log in with username and password (Passport local strategy, bcrypt hashing).
- **Folders**: Create, rename, and delete folders; navigate a tree starting from `home`.
- **Files**: Upload up to **5 MB** per file; download as attachment; delete removes both DB row and storage object.
- **Sessions**: Server-side sessions persisted with `@quixo3/prisma-session-store`.

## Tech stack

- **Runtime**: Node.js (ES modules)
- **Server**: Express 5
- **Views**: EJS templates + static CSS in `public/`
- **Database**: PostgreSQL + [Prisma](https://www.prisma.io/)
- **File storage**: Supabase Storage (bucket name must be `fileuploader`)

## Prerequisites

- Node.js 18+ recommended
- A PostgreSQL database
- A [Supabase](https://supabase.com/) project with a **public** storage bucket named exactly **`fileuploader`**, with policies that allow your server key to upload, download, and delete objects (see Supabase docs for bucket policies).

## Environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

| Variable        | Description |
|----------------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL for Prisma |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase API key with permission to use Storage (often the **service role** key on the server—keep it secret) |

The app loads `.env` automatically on startup (`dotenv`).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Prisma and the database**

   ```bash
   npx prisma migrate dev
   ```

   (Use `prisma db push` instead if you are not using migrations yet.)

3. **Run the server**

   ```bash
   npm start
   ```

   The app listens on **port 10000** on all interfaces (`0.0.0.0`). Open [http://localhost:10000/users/sign-up](http://localhost:10000/users/sign-up) to create an account, or [http://localhost:10000/users/login](http://localhost:10000/users/login) to sign in.

## Project layout

| Path | Role |
|------|------|
| `index.js` | Express app, session middleware, auth gate for main routes |
| `routes/userRoute.js` | Sign up, login, logout |
| `routes/indexRoute.js` | Home/folder UI, uploads, downloads, folder CRUD |
| `config/passport.js` | Local strategy and session serialization |
| `config/supabase.js` | Supabase client |
| `prisma/schema.prisma` | User, Folder, File, Session models |
| `views/` | EJS templates |
| `public/` | Stylesheets |

## Security notes for production

- Replace the hardcoded session `secret` in `index.js` with a long random value from an environment variable.
- Restrict CORS, HTTPS, and secure cookie flags as appropriate for your host.
- Never commit `.env` or expose your Supabase service role key in the browser.

## License

ISC (see `package.json`).
