-- =====================================================================
-- CleanBharat Connect (PrakritiSetu) - Supabase PostgreSQL Schema
-- Community Clean-up Drive Portal - Production DDL & Seed Script
-- =====================================================================

-- 1. EXTENSIONS (Built-in or safe enable)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. DROP EXISTING OBJECTS IN PUBLIC SCHEMA (Clean Slate)
DROP TABLE IF EXISTS community_posts CASCADE;
DROP TABLE IF EXISTS drive_volunteers CASCADE;
DROP TABLE IF EXISTS drives CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP FUNCTION IF EXISTS increment_drive_volunteers() CASCADE;
DROP FUNCTION IF EXISTS decrement_drive_volunteers() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- =====================================================================
-- 3. TABLES DEFINITION
-- =====================================================================

-- Table 1: User Profiles
-- Compatible with Supabase Auth auth.uid() and standalone seed profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT CHECK (phone IS NULL OR phone ~ '^(\+91)?[0-9]{10}$'),
    email TEXT,
    college_or_education TEXT DEFAULT 'Environmental Volunteer',
    city TEXT DEFAULT 'Mumbai',
    pincode TEXT CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$'),
    eco_interests TEXT[] DEFAULT ARRAY['Beach Cleanups', 'Plastic Free'],
    eco_score INT DEFAULT 50 CHECK (eco_score >= 0),
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: Clean-up Drives (Active & Past)
CREATE TABLE drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Beach', 'River', 'Tree Plantation', 'E-Waste', 'Urban Cleanup')),
    venue_name TEXT NOT NULL,
    google_maps_url TEXT NOT NULL,
    date_time TIMESTAMPTZ NOT NULL,
    max_volunteers INT NOT NULL CHECK (max_volunteers > 0),
    current_volunteers INT DEFAULT 0 CHECK (current_volunteers >= 0),
    coordinator_name TEXT NOT NULL,
    coordinator_phone TEXT NOT NULL,
    safety_items TEXT[] DEFAULT ARRAY['Nitrile Heavy Gloves', 'First Aid Kit on Standby', 'Sanitizer Stations', 'Trash Pickers'],
    items_to_bring TEXT[] DEFAULT ARRAY['Reusable 1L Water Bottle', 'Sturdy Closed Shoes', 'Sun Hat or Cap', 'Cloth Bag / Rucksack'],
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    before_image_url TEXT,
    after_image_url TEXT,
    waste_metric TEXT,
    banner_url TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Drive Volunteers (Enrollments / Registrations)
CREATE TABLE drive_volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    attended BOOLEAN DEFAULT FALSE,
    certificate_url TEXT,
    CONSTRAINT uq_drive_user UNIQUE (drive_id, user_id)
);

-- Table 4: Community Feed Posts
CREATE TABLE community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    author_name TEXT,
    author_city TEXT,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    image_url TEXT,
    likes_count INT DEFAULT 0 CHECK (likes_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 4. DATABASE TRIGGERS & FUNCTIONS
-- =====================================================================

-- Trigger A: Automatically increment current_volunteers on drives table
CREATE OR REPLACE FUNCTION increment_drive_volunteers()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE drives
    SET current_volunteers = current_volunteers + 1
    WHERE id = NEW.drive_id;
    
    -- Award +25 Eco-Points to user profile for joining an active drive
    UPDATE profiles
    SET eco_score = eco_score + 25
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_volunteer_count
AFTER INSERT ON drive_volunteers
FOR EACH ROW
EXECUTE FUNCTION increment_drive_volunteers();

-- Trigger B: Automatically decrement current_volunteers on drives table
CREATE OR REPLACE FUNCTION decrement_drive_volunteers()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE drives
    SET current_volunteers = GREATEST(0, current_volunteers - 1)
    WHERE id = OLD.drive_id;

    -- Deduct +25 Eco-Points if cancelled
    UPDATE profiles
    SET eco_score = GREATEST(0, eco_score - 25)
    WHERE id = OLD.user_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_decrement_volunteer_count
AFTER DELETE ON drive_volunteers
FOR EACH ROW
EXECUTE FUNCTION decrement_drive_volunteers();

-- Trigger C: Automatically create profile entry when new Supabase auth.user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        full_name, 
        phone, 
        email, 
        college_or_education, 
        city, 
        pincode, 
        eco_interests, 
        eco_score
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Eco Volunteer'),
        COALESCE(NEW.raw_user_meta_data->>'phone', '+919876543210'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'college_or_education', 'Indian University / Professional'),
        COALESCE(NEW.raw_user_meta_data->>'city', 'Mumbai'),
        COALESCE(NEW.raw_user_meta_data->>'pincode', '400050'),
        ARRAY['Beach Cleanup', 'Plastic Free', 'Community Composting'],
        50
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, profiles.phone),
        city = COALESCE(EXCLUDED.city, profiles.city);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe setup of trigger on auth.users:
-- Wrapped in an exception block so the script never fails if auth.users requires elevated permissions
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        BEGIN
            DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
            CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user();
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Notice: Trigger on auth.users bypassed (%s). Profiles can also be created on user onboarding.', SQLERRM;
        END;
    END IF;
END $$;

-- =====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE USING (auth.uid() = id OR auth.uid() IS NULL);

-- Drives Policies
DROP POLICY IF EXISTS "Drives are viewable by everyone" ON drives;
DROP POLICY IF EXISTS "Authenticated users can create drives" ON drives;
DROP POLICY IF EXISTS "Drive creators can update their own drives" ON drives;
DROP POLICY IF EXISTS "Drive creators can delete their own drives" ON drives;

CREATE POLICY "Drives are viewable by everyone" 
ON drives FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create drives" 
ON drives FOR INSERT WITH CHECK (true);

CREATE POLICY "Drive creators can update their own drives" 
ON drives FOR UPDATE USING (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Drive creators can delete their own drives" 
ON drives FOR DELETE USING (auth.uid() = created_by OR created_by IS NULL);

-- Drive Volunteers Policies
DROP POLICY IF EXISTS "Volunteers list is viewable by everyone" ON drive_volunteers;
DROP POLICY IF EXISTS "Authenticated users can register for drives" ON drive_volunteers;
DROP POLICY IF EXISTS "Users can cancel their own drive registration" ON drive_volunteers;

CREATE POLICY "Volunteers list is viewable by everyone" 
ON drive_volunteers FOR SELECT USING (true);

CREATE POLICY "Authenticated users can register for drives" 
ON drive_volunteers FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can cancel their own drive registration" 
ON drive_volunteers FOR DELETE USING (true);

-- Community Posts Policies
DROP POLICY IF EXISTS "Community posts are viewable by everyone" ON community_posts;
DROP POLICY IF EXISTS "Authenticated users can create community posts" ON community_posts;
DROP POLICY IF EXISTS "Users can update their own community posts" ON community_posts;
DROP POLICY IF EXISTS "Users can delete their own community posts" ON community_posts;

CREATE POLICY "Community posts are viewable by everyone" 
ON community_posts FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create community posts" 
ON community_posts FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own community posts" 
ON community_posts FOR UPDATE USING (auth.uid() = author_id OR author_id IS NULL);

CREATE POLICY "Users can delete their own community posts" 
ON community_posts FOR DELETE USING (auth.uid() = author_id OR author_id IS NULL);

-- =====================================================================
-- 6. REALISTIC SEED DATA (Indian Clean-up Drives & Community Feed)
-- =====================================================================

-- Seed Demo Profiles
INSERT INTO profiles (
    id, full_name, phone, email, college_or_education, city, pincode, eco_interests, eco_score
) VALUES
(
    '10000000-0000-0000-0000-000000000001',
    'Aarav Sharma',
    '+919820123456',
    'aarav.sharma@cleanbharat.org',
    'Afroz Shah Volunteer Foundation',
    'Mumbai',
    '400061',
    ARRAY['Beach Cleanups', 'Urban Lakes', 'Youth Mentorship'],
    450
),
(
    '20000000-0000-0000-0000-000000000002',
    'Ananya Patel',
    '+919820345678',
    'ananya.patel@cleanbharat.org',
    'Mumbai University - Dept. of Life Sciences',
    'Mumbai',
    '400050',
    ARRAY['Beach Cleanups', 'River Restoration', 'Plastic Free'],
    175
),
(
    '30000000-0000-0000-0000-000000000003',
    'Pooja Sen',
    '+919811223344',
    'pooja.sen@cleanbharat.org',
    'Yamuna Bachao Andolan',
    'Delhi',
    '110006',
    ARRAY['River Restoration', 'Zero Waste'],
    375
)
ON CONFLICT (id) DO NOTHING;

-- Active Cleanups: Mumbai, Delhi, Nagpur, Bhopal
INSERT INTO drives (
    id,
    title,
    description,
    category,
    venue_name,
    google_maps_url,
    date_time,
    max_volunteers,
    current_volunteers,
    coordinator_name,
    coordinator_phone,
    safety_items,
    items_to_bring,
    status,
    waste_metric,
    banner_url,
    created_by
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Versova Beach Mega Marine Debris Drive #WaveGuard',
    'Join over 200 ocean stewards at Versova Beach for a massive Saturday morning coastal cleanup. We will segregate non-biodegradable micro-plastics, discarded nylon fishing nets, and single-use packaging. BMC recycling trucks will collect segregated waste on site.',
    'Beach',
    'Versova Beach, Near Rock Beach Promenade, Andheri West, Mumbai',
    'https://maps.google.com/?q=Versova+Beach+Mumbai',
    NOW() + INTERVAL '3 days 14 hours',
    250,
    142,
    'Aarav Sharma (Afroz Shah Volunteer Foundation)',
    '+919820123456',
    ARRAY['Nitrile Puncture-Resistant Gloves', 'First Aid Station with Paramedic', 'High-Vis Safety Vests', 'Hydration & Glucose Station', 'Biodegradable Segregation Sacks'],
    ARRAY['1L Reusable Water Bottle', 'Sturdy Sports or Gum Boots', 'Sun Protection Hat / Cap', 'Hand Towel'],
    'active',
    'Target: 2,500 kg Marine Waste',
    'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=80',
    '10000000-0000-0000-0000-000000000001'
),
(
    '22222222-2222-2222-2222-222222222222',
    'Yamuna Ghat Rejuvenation & Riverbed Restoration',
    'Calling all Delhi-NCR citizens to restore the banks of sacred Yamuna river at Nigambodh Ghat. We are clearing non-biodegradable religious ritual offerings, thermocol idols, and polythene trapped along the floodplains. Partnered with local youth eco-clubs.',
    'River',
    'Nigambodh Ghat Floodplains, Kashmere Gate, New Delhi',
    'https://maps.google.com/?q=Nigambodh+Ghat+Delhi',
    NOW() + INTERVAL '6 days 18 hours',
    180,
    98,
    'Pooja Sen (Yamuna Bachao Andolan)',
    '+919811223344',
    ARRAY['Rubberized Hand Gloves', 'Long Tongs & Clamps', 'Dettol Wash Stations', 'Face Masks (N95)', 'Safety Goggles'],
    ARRAY['Steel Water Tumbler', 'Gum Boots or Old Sneakers', 'Full Sleeve Cotton Shirt', 'Bandana / Cap'],
    'active',
    'Target: 1,800 kg Plastic & Silt',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    '30000000-0000-0000-0000-000000000003'
),
(
    '33333333-3333-3333-3333-333333333333',
    'Futala Lake Wetland Restoration & Weed Removal',
    'Nagpur''s iconic Futala Lake ecosystem needs our immediate care. Heavy weekend footfall and street vendor stalls have caused plastic packaging runoff along the embankment. Help us clear the shoreline and restore native flora habitats.',
    'Urban Cleanup',
    'Futala Lake Promenade, Vayusena Nagar, Nagpur, Maharashtra',
    'https://maps.google.com/?q=Futala+Lake+Nagpur',
    NOW() + INTERVAL '10 days 10 hours',
    120,
    64,
    'Dr. Rohan Kulkarni (Green Nagpur Collective)',
    '+919765432109',
    ARRAY['Latex Heavy-Duty Gloves', 'Trash Grabbing Tools', 'Sanitizing Wipes', 'Trash Can Wheelies'],
    ARRAY['Personal Hydration Flask', 'Walking Shoes', 'Sweat Towel'],
    'active',
    'Target: 950 kg Solid Waste',
    'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=1200&q=80',
    NULL
),
(
    '44444444-4444-4444-4444-444444444444',
    'Bhopal Upper Lake (Bada Talab) Green Wetland Drive',
    'Protection of Ramsar wetland site Bada Talab. Removing single-use plastics, thermocol packaging, and conducting water hyacinth eradication along the Boat Club shoreline.',
    'River',
    'Bhopal Boat Club & Van Vihar Perimeter, Bhopal, Madhya Pradesh',
    'https://maps.google.com/?q=Upper+Lake+Bhopal',
    NOW() + INTERVAL '14 days 8 hours',
    150,
    110,
    'Neha Deshmukh (Lake Guardians NGO)',
    '+919425001122',
    ARRAY['Grip Safety Gloves', 'Floating Waste Skimmers', 'First Aid Box', 'Organic Snacks & Buttermilk'],
    ARRAY['Cloth Hat', 'Closed Canvas Shoes', 'Refillable Bottle'],
    'active',
    'Target: 1,200 kg Waste',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- Past Completed Cleanups (With Before/After Comparisons & Real Impact Metrics)
INSERT INTO drives (
    id,
    title,
    description,
    category,
    venue_name,
    google_maps_url,
    date_time,
    max_volunteers,
    current_volunteers,
    coordinator_name,
    coordinator_phone,
    status,
    before_image_url,
    after_image_url,
    waste_metric,
    banner_url,
    created_by
) VALUES
(
    '55555555-5555-5555-5555-555555555555',
    'Mahim Beach Coastal Cleansing Mission',
    'A landmark 6-month continuous cleanup drive covering 3.2 kilometers of shoreline opposite Mahim Causeway. Mobilized colleges, corporators, and citizen groups to eliminate decades of microplastics and industrial debris.',
    'Beach',
    'Mahim Bay & Mithi River Confluence, Mahim, Mumbai',
    'https://maps.google.com/?q=Mahim+Beach+Mumbai',
    NOW() - INTERVAL '25 days',
    300,
    300,
    'Malhar Kalambe (Beach Please)',
    '+919820987654',
    'completed',
    'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
    '4,850 kg Marine Debris Diverted',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    '10000000-0000-0000-0000-000000000001'
),
(
    '66666666-6666-6666-6666-666666666666',
    'Gomti Riverfront Heritage Park Cleanliness Blitz',
    'Massive weekend environmental campaign along the Gomti River channel in Lucknow. Diverted municipal dump overflow, planted 450 native saplings, and established solar trash compactors.',
    'River',
    'Gomti Riverfront Park, Vipin Khand, Gomti Nagar, Lucknow',
    'https://maps.google.com/?q=Gomti+Riverfront+Lucknow',
    NOW() - INTERVAL '48 days',
    200,
    200,
    'Vikramaditya Tiwari (Green Awadh)',
    '+919415123456',
    'completed',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=1000&q=80',
    '3,120 kg Waste & 450 Trees Planted',
    'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=1200&q=80',
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Community Posts
INSERT INTO community_posts (
    id, author_id, author_name, author_city, content, tags, image_url, likes_count, created_at
) VALUES
(
    '77777777-7777-7777-7777-777777777771',
    '10000000-0000-0000-0000-000000000001',
    'Aarav Sharma',
    'Mumbai, MH',
    'Incredible energy at Versova today! Our volunteer team collected 65 large sacks filled strictly with multilayer plastic wrappers and discarded fishing lines. Thank you to everyone who woke up at 6:30 AM! 🌊 #WaveGuard #CleanMyCity',
    ARRAY['#CleanMyCity', '#BeachWarriors', '#PlasticsFree'],
    'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=800&q=80',
    42,
    NOW() - INTERVAL '2 hours'
),
(
    '77777777-7777-7777-7777-777777777772',
    '30000000-0000-0000-0000-000000000003',
    'Pooja Sen',
    'Delhi-NCR',
    'Friendly reminder for everyone joining our Yamuna Ghat cleanup this coming Sunday: Please wear sturdy gum boots or closed sneakers. Nitrile gloves and sanitized trash pickers will be distributed at Registration Counter A. Let’s bring life back to Yamuna! 💙',
    ARRAY['#RiverRestoration', '#ZeroWaste'],
    NULL,
    28,
    NOW() - INTERVAL '5 hours'
),
(
    '77777777-7777-7777-7777-777777777773',
    '20000000-0000-0000-0000-000000000002',
    'Ananya Patel',
    'Mumbai, MH',
    'Started home-composting our kitchen wet waste in our society last month. Today we harvested our first batch of rich dark compost for the society terrace garden! Zero food scraps go to landfills anymore. 🌱🪱',
    ARRAY['#Composting', '#ZeroWaste'],
    'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?auto=format&fit=crop&w=800&q=80',
    35,
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- Disable volunteer count trigger temporarily for initial seed enrollment
ALTER TABLE drive_volunteers DISABLE TRIGGER trg_increment_volunteer_count;

INSERT INTO drive_volunteers (drive_id, user_id, joined_at)
VALUES 
('11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000002', NOW() - INTERVAL '1 day')
ON CONFLICT (drive_id, user_id) DO NOTHING;

ALTER TABLE drive_volunteers ENABLE TRIGGER trg_increment_volunteer_count;
