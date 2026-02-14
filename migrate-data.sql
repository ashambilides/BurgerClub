-- ============================================
-- MIGRATE GOOGLE SHEETS DATA TO SUPABASE
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create the results table
CREATE TABLE results (
    id BIGSERIAL PRIMARY KEY,
    ranking INT,
    burger_rating NUMERIC,
    restaurant TEXT NOT NULL,
    description TEXT,
    price TEXT,
    location TEXT,
    date_of_visit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Results read" ON results FOR SELECT USING (true);
CREATE POLICY "Results insert" ON results FOR INSERT WITH CHECK (true);
CREATE POLICY "Results update" ON results FOR UPDATE USING (true);
CREATE POLICY "Results delete" ON results FOR DELETE USING (true);

-- 4. Insert all data from Google Sheets
INSERT INTO results (ranking, burger_rating, restaurant, description, price, location, date_of_visit) VALUES
(1, 8.55, 'Rolo''s', 'double cheeseburger, grilled onions, dijonnaise, pickled long hot. butchered and ground in-house. limited. get here before 6pm if you insist on having one.', '$20.00', '8-53 Onderdonk Ave, Ridgewood, NY 11385', '9/7/2025'),
(2, 8.42, 'Red Hook Tavern', 'Dry-Aged Red Hook Tavern Burger - American cheese, white onion, cottage fries', '$30.00', '329 Van Brunt St, Brooklyn, NY 11231', '6/8/2025'),
(3, 8.2, 'The Lions Bar & Grill', 'HAMBURGER dry aged blend… house ground daily. American cheese, grilled onion', '$19.00', '132 1st Ave., New York, NY 10009', '9/18/2024'),
(4, 8.16, 'Virginia''s', 'Virginia''s Burger, Cabot Cheddar, Onion Marmalade, Marrow Aoili', '$20.00', 'East 3rd St, New York, NY 10009', '7/23/2025'),
(5, 8.03, 'Raoul''s', 'RAOUL''S BURGER - au Poivre with St André cheese, cornichon and pommes frites', '$32.00', '180 Prince St, New York, NY 10012', '12/15/2024'),
(6, 7.95, 'Au Chavel', 'Double Cheeseburger with bacon and farm egg', '$36.47', '33 Cortlandt Alley, New York, NY 10013', '12/17/2025'),
(7, 7.94, 'Suprema Provisions', 'Suprema Burger - short rib, brisket, iberico jamon bacon jam, black garlic sauce, aged cheddar, roasted tomatoes, on a brioche bun', '$24.00', '305 Bleecker St, New York, NY 10014', '2/11/2026'),
(8, 7.9, 'Peter Luger', 'Luger-Burger, Over 1/2 lb., on a Bun with Cheese', '$23.80', '178 Broadway, Brooklyn, NY 11211', '8/17/2025'),
(9, 7.9, 'Cozy Royale', 'Cheeseburger - 6oz Meat Hook patty, american cheese, fancy sauce, pickles, onion. served with fries', '$22.00', '434 Humboldt St, Brooklyn, NY 11211', '1/4/2026'),
(10, 7.86, 'Minetta Tavern', 'BLACK LABEL BURGER - selection of prime dry-aged beef cuts, caramelized onions, pommes frites', '$38.00', '113 MacDougal St, New York, NY 10012', '1/25/2025'),
(11, 7.85, 'Cozy Royale', 'The Dry-Aged Cheeseburger - Two smashed dry-aged patties, raclette, arugula, bacon jam, calabrian aioli, pickled red onion, fries. LIMITED QUANTITY! only 10 dry-aged burgers per day.', '$22.00', '434 Humboldt St, Brooklyn, NY 11211', '1/4/2026'),
(12, 7.74, 'Hamburger America', 'THE CLASSIC SMASH BURGER - Double Patty, mustard, diced onion, dill pickle, cheese', '$11.50', '155 W Houston St, New York, NY 10012', '11/13/2024'),
(13, 7.56, 'Minetta Tavern', 'MINETTA BURGER - Cheddar, caramelized onions, pommes frites', '$31.00', '113 MacDougal St, New York, NY 10012', '1/25/2025'),
(14, 7.55, 'Gotham Burger', 'a nostalgic smash burger with grilled onions, melted american cheese, housemade pickles, jalapenos, club sauce, ketchup, mustard', '$12.00', '131 Essex Street, New York, NY 10002', '10/22/2025'),
(15, 7.42, 'Hamburger America', 'GEORGE MOTZ''S FRIED ONION BURGER- Double Patty', '$11.50', '155 W Houston St, New York, NY 10012', '11/13/2024'),
(16, 7.4, 'Nowon', 'LEGENDARY CHEESEBURGER smashed double, american cheese, kimchi special sauce, roasted kimchi, pickles, onion', '$21.00', '436 Jefferson St, Brooklyn, NY 11237', '10/16/2024'),
(17, 7.36, 'Smacking Burger', 'THE BIG SMACK Double Smashed Patty W/Caramelized Onions, Pickles, Shredduce & American cheese Topped With Our Signature SMACK Sauce On A Martins Sesame Bun.', '$10.99', '51-63 8th Ave, New York, NY 10014', '2/12/2025'),
(18, 7.28, 'Fairfax', 'THE BURGER (from BAR SARDINE) bbq mayo, cheddar, crispy potatoes, red onion', '$19.00', '234 West 4th Street, New York, NY 10014', '8/14/2024'),
(19, 7.05, 'Nowon', 'DRY AGED STEAK BURGER 8oz single stack, american cheese, kimchi special sauce, roasted kimchi, pickles, onion', '$27.00', '436 Jefferson St, Brooklyn, NY 11237', '10/16/2024'),
(20, 7.01, 'Petey''s Burger', 'Double Cheese', '$8.99', '46-46 Vernon Blvd, Long Island City, NY 11101', '4/13/2025'),
(21, 6.85, 'Burger by Day', 'BBD Smash Burger', '$9.50', '242 Grand Street, Manhattan, NY 10012', '5/14/2025'),
(22, 6.78, 'JG Melon', 'Bacon Cheeseburger', '$15.50', '1291 3rd Ave, New York, NY 10021', '3/29/2025'),
(23, 6.65, 'Corner Bistro', 'Bistro Burger - 1/2 lb.burger American cheese crisp bacon. Served with lettuce tomato onion and pickles.', '$16.75', '331 W 4th St, New York, NY 10014', '11/12/2025');
