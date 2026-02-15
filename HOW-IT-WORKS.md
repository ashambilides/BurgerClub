# How Your Burger Club Website Works

## The Big Picture

Your website is built from **3 main pieces** that work together:

1. **Your Desktop Folder** (C:\Users\angel\OneDrive\Desktop\BotMC) - The code files
2. **GitHub** - Stores the code and hosts the website
3. **Supabase** - Stores your data (burgers, ratings, photos)

---

## Part 1: Your Desktop Folder

This folder contains the **code files** that make your website work:

```
BotMC/
├── index.html          ← The structure/layout of the page
├── style.css           ← The colors, fonts, spacing (how it looks)
├── app.js              ← The logic (what happens when you click buttons)
├── config.js           ← Secret credentials (API keys to talk to Supabase)
└── ...other files
```

### What each file does:

**index.html** - The skeleton
- Defines what appears on the page (buttons, text boxes, titles, etc.)
- Like an architectural blueprint for a house
- When you view the website, your browser reads this file and displays it

**style.css** - The decorator
- Controls colors, fonts, spacing, how things are arranged
- Like paint, flooring, and furniture in that house blueprint
- Makes the page look pretty instead of boring

**app.js** - The brain
- Contains all the logic: what happens when you click "Add Burger", "Upload Photo", etc.
- Talks to Supabase to get and save data
- Sorts the table, filters ratings, updates the map, etc.
- ~1500 lines of instructions for the browser to follow

**config.js** - The credentials
- Contains your Supabase URL and API key
- Like having your house address and a key to unlock it
- Tells your website where to find and access your database

---

## Part 2: GitHub (Hosts Your Website)

GitHub is where your code lives publicly. It has **two jobs**:

### Job 1: Version Control (like "Save" for code)
- Every time we make changes and `git commit`, it saves a snapshot
- You can see the history of every change ever made
- If something breaks, you can revert to an older version
- GitHub tracks: what changed, when, who changed it

### Job 2: Hosts Your Website (GitHub Pages)
- GitHub automatically takes your HTML, CSS, and JavaScript files
- And hosts them as a live website at: **https://ashambilides.github.io/BurgerClub/**
- When someone visits that URL, GitHub sends them the files from your repository
- The website is served from GitHub's servers (free!)

**How updates work:**
1. You (or me via Claude) edit files on your Desktop
2. Run `git push` to upload the changes to GitHub
3. GitHub automatically updates the live website
4. Anyone can now see the new version

---

## Part 3: Supabase (Your Database)

Supabase is a database service that **stores all your data**:

```
Supabase Database Tables:
├── results         ← Your 24 burgers (ranking, rating, restaurant, location, etc.)
├── ratings         ← Each person's vote on each burger
├── gallery         ← Photo metadata (links to images, captions)
├── suggestions     ← Club improvement suggestions from users
├── restaurant_requests ← Burger spots people want to try
└── form_config     ← Whether the rating form is open/closed
```

Supabase also has a **storage bucket** called "photos" that holds the actual image files you upload.

**Why not just store it in a file on GitHub?**
- GitHub is for code, not data
- If 100 people fill out the rating form, you'd have 100 new database rows
- GitHub would get huge and slow
- Supabase is designed specifically for real-time data storage

---

## How They All Work Together

### When you visit https://ashambilides.github.io/BurgerClub/:

1. **GitHub** sends your browser the HTML, CSS, and JavaScript files
2. Your **browser** runs the JavaScript code (app.js)
3. app.js uses your **Supabase credentials** (from config.js) to connect to the database
4. The JavaScript fetches data from **Supabase**: "Give me all 24 burgers"
5. Supabase sends back the burger list (as JSON data)
6. JavaScript displays it on the page: rankings table, map pins, gallery, etc.

### When someone submits a rating:

1. **Browser** collects their answers (name, scores, photo)
2. **app.js** takes that data and sends it to **Supabase**
3. **Supabase** stores it in the `ratings` table
4. **Supabase** stores the photo in the `photos` bucket
5. **Your browser** refreshes the table to show the new average rating
6. **Everyone's browser** sees the updated ranking (because it all reads from the same database)

### When you add a new burger in Admin:

1. **You** fill in restaurant, description, price, address
2. **Browser** (app.js) searches the map for that address (uses OpenStreetMap/Nominatim)
3. **You** click "Add Burger"
4. **app.js** sends the burger data to **Supabase**
5. **Supabase** stores it in the `results` table with the coordinates
6. **app.js** refreshes the page to show: updated table, new map pin, new dropdown option
7. **Next time someone visits** the site, they see your new burger (because it's in Supabase)

---

## The Data Flow: Real-World Example

**Scenario:** Someone rates Nowon's burger

```
User's Computer                Browser (App.js)              Supabase
       ↓                              ↓                          ↓
    Fills form           Collects data from form
       ↓                              ↓
  Clicks Submit          Sends: { burger, name,      Stores in
       ↓                   toppings: 8, bun: 7, ... }  ratings table
       ↓                              ↓                          ↓
       ↓                   Requests new average      Calculates
       ↓                              ↓                          ↓
       ↓                   Refreshes table on page   Returns new
       ↓                   to show 7.8 rating         rating: 7.8
       ↓                              ↓
   Sees updated                    Page updates
   ranking: 7.8            showing Nowon at #4
```

---

## Key Concepts Explained Simply

### REST API
- A way for your browser to ask Supabase questions: "Give me all burgers", "Save this rating"
- Like a restaurant: you order (request), the kitchen makes it (database processes), you get food (response)
- Happens over the internet using HTTP (just like visiting a website)

### Row Level Security (RLS)
- Rules that say: "Anyone can view burgers, but only certain people can add ratings"
- Prevents hackers from messing with the database
- Your API keys prove you're authorized

### JavaScript / app.js
- Code that runs in the **user's browser** (not on a server)
- Listens for button clicks, form submissions
- Fetches data from Supabase
- Updates the page dynamically (no page reload needed most times)

### GitHub Pages
- Free website hosting by GitHub
- Takes your HTML/CSS/JS files and serves them publicly
- Every time you push code, it automatically updates the live site

---

## Why This Setup?

| Component | Why? |
|-----------|------|
| **GitHub Pages** | Free hosting, easy to update, keeps code safe in version control |
| **Supabase** | Free database, handles real-time updates, secure storage, automatic backups |
| **JavaScript** | Runs in browser = super fast, responsive, no server needed for the website |
| **Desktop Folder** | Edit files locally, version control, easy collaboration |

---

## The Cost

- **GitHub:** FREE (unlimited storage, unlimited websites)
- **Supabase:** FREE tier (up to 50,000 rows, 1GB storage) - you're well under this
- **Domain:** FREE (ashambilides.github.io is your free domain)
- **Total:** $0

---

## Summary

```
You Edit Files        →  Git Push to         →  GitHub updates    →  Website changes
on Desktop               GitHub                 live website         for everyone
     ↓                                              ↓
     └──────────────────────────────────→  Supabase stores data ←─ App.js fetches data
                                              (stays same)         when page loads
```

Your website is a perfect example of how to build a free, powerful web app:
- **Free hosting** (GitHub)
- **Free database** (Supabase)
- **Zero server costs** (runs in the browser)
- **Version control** (Git/GitHub)
- **Easy to update** (just push new code)

Pretty amazing, right? 🍔
