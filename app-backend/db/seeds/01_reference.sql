-- Reference data the app needs to run: one workshop, its people, bays, the service catalogue and offers.
-- Safe to re-run. Replace the placeholder phone numbers, address and camera URLs with the real ones before go-live,
-- or let the ERP own these rows through the integration API (PUT /integration/v1/staff|bays|services|offers).

INSERT INTO workshops (id, code, name, address, city, phone, whatsapp, roadside_phone) VALUES
  ('00000000-0000-4000-8000-000000000001', 'DVG-01', 'Bike Surgeon Davangere', 'Workshop address to be confirmed', 'Davangere',
   '+919845011223', '+919845011223', '+918047182200')
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff (id, workshop_id, code, name, role, phone) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'ADV-AMIT',  'Amit Patil', 'advisor',  '+919845011223'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'MEC-RAHUL', 'Rahul M.',   'mechanic', NULL),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'RID-ARJUN', 'Arjun K.',   'rider',    '+919845011224')
ON CONFLICT (id) DO NOTHING;

-- Bay 03 points at the sample clip served by the frontend dev server so the camera proxy can be tried locally.
INSERT INTO bays (id, workshop_id, code, name, camera_stream_url) VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'BAY-01', 'Bay 01', NULL),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'BAY-02', 'Bay 02', NULL),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'BAY-03', 'Bay 03', 'http://localhost:5173/bay-cam.mp4'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'BAY-04', 'Bay 04', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_catalog (id, name, detail, category, price, sort_order) VALUES
  ('general', 'General service',      '24-point inspection and tune-up', 'Service', 1499, 10),
  ('oil',     'Engine oil change',    'Oil, filter and disposal',        'Service',  799, 20),
  ('brake',   'Brake inspection',     'Pads, fluid and calibration',     'Repair',   399, 30),
  ('chain',   'Chain clean and lube', 'Clean, tension and lubrication',  'Care',     199, 40),
  ('wash',    'Foam wash',            'Foam wash and polish',            'Care',     149, 50),
  ('puc',     'PUC check',            'Emission test and certificate',   'Care',     100, 60)
ON CONFLICT (id) DO NOTHING;

INSERT INTO offers (id, title, short_label, detail, discount_amount, first_booking_only, requires_service_id, requires_other_service, valid_until) VALUES
  ('first',   '₹150 off your first service',  'off your first service',    'For new customers, on any booking',       150, true,  NULL,    false, '2027-03-31'),
  ('wash',    'Free foam wash',               'foam wash with any service', 'With any other service',                  149, false, 'wash',  true,  '2027-03-31'),
  ('monsoon', '₹100 off a brake inspection',  'off a brake inspection',     'Get the brakes checked before the rains', 100, false, 'brake', false, '2027-03-31')
ON CONFLICT (id) DO NOTHING;
