-- ─── 1. Avatar path columns ────────────────────────────────────────────────
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE contacts  ADD COLUMN IF NOT EXISTS avatar_path text;

-- ─── 2. Notification preferences (jsonb, default all ON via app logic) ─────
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS notification_preferences jsonb;

-- ─── 3. Regional materials — Decks & Patios (Oregon 97xxx) ─────────────────
-- Uses user_id = null (nullable FK). If your schema enforces NOT NULL on
-- user_id, run:  ALTER TABLE regional_materials ALTER COLUMN user_id DROP NOT NULL;
-- before these inserts.

INSERT INTO regional_materials (material_name, unit, unit_cost, zip_code, city, state, length_ft)
VALUES
  -- Deck boards
  ('5/4x6 Pressure Treated 12ft',       'each', 9.50,  '97201', 'Portland', 'OR', 12),
  ('5/4x6 Pressure Treated 16ft',       'each', 12.00, '97201', 'Portland', 'OR', 16),
  ('2x6 Pressure Treated 12ft',         'each', 8.50,  '97201', 'Portland', 'OR', 12),
  ('2x6 Pressure Treated 16ft',         'each', 11.00, '97201', 'Portland', 'OR', 16),
  ('TimberTech PVC Composite 12ft',     'each', 28.00, '97201', 'Portland', 'OR', 12),
  ('TimberTech PVC Composite 16ft',     'each', 36.00, '97201', 'Portland', 'OR', 16),
  ('TimberTech PVC Composite 20ft',     'each', 44.00, '97201', 'Portland', 'OR', 20),
  ('Trex Select Composite 12ft',        'each', 22.00, '97201', 'Portland', 'OR', 12),
  ('Trex Select Composite 16ft',        'each', 28.00, '97201', 'Portland', 'OR', 16),
  ('Trex Select Composite 20ft',        'each', 34.00, '97201', 'Portland', 'OR', 20),
  ('Fiberon Composite 12ft',            'each', 20.00, '97201', 'Portland', 'OR', 12),
  ('4x4 PT Post 8ft',                   'each', 14.00, '97201', 'Portland', 'OR', 8),
  ('6x6 PT Post 8ft',                   'each', 22.00, '97201', 'Portland', 'OR', 8),
  ('Deck Joist Hanger',                 'each',  1.40, '97201', 'Portland', 'OR', null),
  ('Post Base Adjustable',              'each',  8.50, '97201', 'Portland', 'OR', null),
  ('Post Cap',                          'each',  6.00, '97201', 'Portland', 'OR', null),
  ('Hidden Fastener Clips',             'bag',  28.00, '97201', 'Portland', 'OR', null),
  ('Deck Screws 350ct',                 'box',  18.00, '97201', 'Portland', 'OR', null),
  ('Carriage Bolt 1/2x6',              'each',  1.20, '97201', 'Portland', 'OR', null),
  ('Lag Screw 1/2x3',                  'each',  0.90, '97201', 'Portland', 'OR', null),
  ('Concrete Tube Form 8in',            'each',  6.50, '97201', 'Portland', 'OR', null),
  ('Deck Post Footing Bracket',         'each', 12.00, '97201', 'Portland', 'OR', null),
  -- Windows & Doors
  ('Exterior Door Prehung',             'each', 280.00,'97201', 'Portland', 'OR', null),
  ('Interior Door Prehung',             'each', 120.00,'97201', 'Portland', 'OR', null),
  ('Sliding Glass Door',                'each', 650.00,'97201', 'Portland', 'OR', null),
  ('Window Double Pane Single Hung',    'each', 180.00,'97201', 'Portland', 'OR', null),
  ('Window Double Pane Double Hung',    'each', 240.00,'97201', 'Portland', 'OR', null),
  ('Window Trim Kit',                   'each',  28.00,'97201', 'Portland', 'OR', null),
  ('Door Threshold',                    'each',  35.00,'97201', 'Portland', 'OR', null),
  ('Door Weatherstrip',                 'each',  14.00,'97201', 'Portland', 'OR', null),
  ('Deadbolt Lockset',                  'each',  45.00,'97201', 'Portland', 'OR', null),
  ('Door Handle Set',                   'each',  65.00,'97201', 'Portland', 'OR', null),
  ('Window Flashing Tape',              'roll',  28.00,'97201', 'Portland', 'OR', null),
  -- HVAC rough-in
  ('Flex Duct 6in',                     'per ft', 1.80,'97201', 'Portland', 'OR', null),
  ('Flex Duct 8in',                     'per ft', 2.40,'97201', 'Portland', 'OR', null),
  ('Sheet Metal Duct 6in',              'per ft', 4.50,'97201', 'Portland', 'OR', null),
  ('Register Box',                      'each',   8.00,'97201', 'Portland', 'OR', null),
  ('Return Air Grille',                 'each',  12.00,'97201', 'Portland', 'OR', null),
  ('Duct Tape',                         'roll',  12.00,'97201', 'Portland', 'OR', null),
  ('HVAC Filter 16x25',                 'each',  18.00,'97201', 'Portland', 'OR', null),
  ('Condensate Line 3/4in',             'per ft', 0.80,'97201', 'Portland', 'OR', null),
  -- Gutters & Drainage
  ('Aluminum Gutter 5in',               'per ft', 3.50,'97201', 'Portland', 'OR', null),
  ('Downspout 2x3',                     'per ft', 2.80,'97201', 'Portland', 'OR', null),
  ('Gutter End Cap',                    'each',   3.50,'97201', 'Portland', 'OR', null),
  ('Downspout Elbow',                   'each',   4.50,'97201', 'Portland', 'OR', null),
  ('Gutter Spike',                      'each',   0.80,'97201', 'Portland', 'OR', null),
  ('Gutter Guard',                      'per ft', 4.00,'97201', 'Portland', 'OR', null),
  ('French Drain Pipe',                 'per ft', 2.20,'97201', 'Portland', 'OR', null),
  ('Drain Rock',                        'bag',    6.50,'97201', 'Portland', 'OR', null),
  ('Landscape Fabric',                  'roll',  28.00,'97201', 'Portland', 'OR', null),
  -- Fencing
  ('Cedar Fence Picket 6ft',            'each',   4.50,'97201', 'Portland', 'OR', 6),
  ('Cedar Fence Picket 8ft',            'each',   5.80,'97201', 'Portland', 'OR', 8),
  ('4x4x8 PT Fence Post',               'each',  14.00,'97201', 'Portland', 'OR', 8),
  ('2x4x8 PT Rail',                     'each',   7.50,'97201', 'Portland', 'OR', 8),
  ('Fence Post Cap',                    'each',   3.50,'97201', 'Portland', 'OR', null),
  ('Fence Stain',                       'gallon', 38.00,'97201', 'Portland', 'OR', null),
  ('Chain Link Fencing',                'per ft',  8.50,'97201', 'Portland', 'OR', null),
  ('Concrete 80lb (fence posts)',       'bag',    7.50,'97201', 'Portland', 'OR', null)
ON CONFLICT DO NOTHING;
