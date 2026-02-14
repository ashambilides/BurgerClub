# BotMC - Burger of the Month Club Setup

## Quick Start (5 steps)

### 1. Create a Supabase project (free)
- Go to [supabase.com](https://supabase.com) and sign up
- Click "New Project", pick a name and password
- Wait for it to spin up (~2 min)

### 2. Run the database setup
- In Supabase dashboard, go to **SQL Editor** (left sidebar)
- Click **New Query**
- Paste the entire contents of `supabase-setup.sql` and click **Run**

### 3. Create the photo storage bucket
- Go to **Storage** in the left sidebar
- Click **New Bucket**
- Name: `photos`
- Toggle **Public bucket** ON
- Click **Create bucket**

### 4. Get your Supabase keys
- Go to **Settings** > **API** (left sidebar)
- Copy the **Project URL** and **anon/public key**
- Open `config.js` and replace:
  - `YOUR_SUPABASE_URL` with the Project URL
  - `YOUR_SUPABASE_ANON_KEY` with the anon key

### 5. Deploy to GitHub Pages (free)
- Create a new GitHub repo (e.g., `BotMC`)
- Push all files to the repo
- Go to repo **Settings** > **Pages**
- Source: "Deploy from a branch", Branch: `main`, Folder: `/ (root)`
- Your site will be live at `https://yourusername.github.io/BotMC/`

```bash
git init
git add .
git commit -m "Initial BotMC site"
git remote add origin https://github.com/YOURUSERNAME/BotMC.git
git branch -M main
git push -u origin main
```

## Adding a burger hero image
- Add a `burger.jpg` file to the root directory (the hero image on the homepage)
- Or change the image path in `index.html`

## How it works

### Data flow
- **Rankings table**: Pulled live from your Google Sheet via API
- **Gallery photos**: Stored in Supabase Storage, metadata in `gallery` table
- **Ratings**: Submitted via the built-in form, stored in `ratings` table
- **Form control**: Admin opens/closes form per burger via `form_config` table
- **Map pins**: Geocoded from restaurant names using built-in coordinate lookup

### Admin panel
- Click "Admin" in the nav bar
- Default password: `password` (SHA-256 hash in config.js)
- Change it immediately in the Settings tab after first login

### Workflow for a new burger visit
1. Admin opens the admin panel and adds the new burger
2. Admin goes to "Form Control" tab, selects the burger, clicks "Open Form"
3. Members visit the site, go to "Rate" section, submit their ratings + optional photo
4. Admin closes the form when done
5. Admin updates the Google Sheet with final averaged scores
6. Rankings table on the site auto-updates

## Files
- `index.html` - Main page structure
- `style.css` - All styling
- `app.js` - Application logic
- `config.js` - Configuration (API keys, Supabase credentials)
- `supabase-setup.sql` - Database schema (run once)
- `burger.jpg` - Hero image (add your own)

## Costs
Everything is free:
- GitHub Pages: Free hosting
- Google Sheets API: Free (with API key)
- Supabase: Free tier (500MB db, 1GB storage, 50K rows)
- Leaflet/OpenStreetMap: Free and open source
