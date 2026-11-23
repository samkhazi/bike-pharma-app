-- Demo customer matching the frontend's "Returning" sample customer. Development and staging only.
-- Log in with +91 98765 43210 and the OTP_DEV_CODE from .env.
-- Times are relative to "today" in India, so the live job is always in the bay when you seed.

CREATE OR REPLACE FUNCTION pg_temp.ist(day_offset integer, hhmm text) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date + day_offset + hhmm::time) AT TIME ZONE 'Asia/Kolkata'
$$;

INSERT INTO customers (id, phone, name, email, language, backup_contact_name, backup_contact_phone, referral_code) VALUES
  ('00000000-0000-4000-8000-000000001001', '+919876543210', 'Sanath Naik', 'demo@example.com', 'English', 'Lakshmi Naik', '+919448120457', 'SANATH200')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_addresses (id, customer_id, label, area, line, contact_name, contact_phone) VALUES
  ('00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001001', 'Home', 'PJ Extension',
   'Flat 302, Sai Residency, 4th Main, PJ Extension, Davangere 577002', 'Sanath Naik', '+919876543210'),
  ('00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000001001', 'Work', 'MCC B Block',
   '2nd floor, Shree Complex, MCC B Block, Davangere 577004', 'Sanath Naik', '+919876543210')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicles (id, customer_id, registration_number, make, model, body_type, colour_name, colour_hex, make_year, odometer_km, odometer_recorded_at, odometer_source) VALUES
  ('00000000-0000-4000-8000-000000001201', '00000000-0000-4000-8000-000000001001', 'KA01MY4500', 'Royal Enfield', 'Guerrilla 450', 'naked',   'Brava Blue',  '#2f5b8a', 2025,  6842, now(),                 'workshop'),
  ('00000000-0000-4000-8000-000000001202', '00000000-0000-4000-8000-000000001001', 'KA05JC1987', 'Royal Enfield', 'Classic 350',   'classic', 'Chrome Red',  '#6e2a2a', 2019, 21390, now() - interval '50 days', 'customer'),
  ('00000000-0000-4000-8000-000000001203', '00000000-0000-4000-8000-000000001001', 'KA03NK8821', 'Suzuki',        'Access 125',    'scooter', 'Pearl Green', '#45675b', 2022,  9240, now() - interval '90 days', 'workshop')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicle_documents (vehicle_id, kind, provider, policy_type, reading, valid_until) VALUES
  ('00000000-0000-4000-8000-000000001201', 'insurance', 'ICICI Lombard', 'Comprehensive', NULL, '2027-08-12'),
  ('00000000-0000-4000-8000-000000001201', 'puc',       NULL, NULL, 'CO 0.21%, HC 180 ppm', (now() + interval '24 days')::date),
  ('00000000-0000-4000-8000-000000001202', 'insurance', 'Tata AIG',      'Third party',   NULL, (now() + interval '12 days')::date),
  ('00000000-0000-4000-8000-000000001202', 'puc',       NULL, NULL, 'CO 0.34%, HC 240 ppm', '2027-02-04'),
  ('00000000-0000-4000-8000-000000001203', 'insurance', 'HDFC ERGO',     'Comprehensive', NULL, '2027-06-08'),
  ('00000000-0000-4000-8000-000000001203', 'puc',       NULL, NULL, 'CO 0.18%, HC 164 ppm', '2027-03-12')
ON CONFLICT (vehicle_id, kind) DO NOTHING;

INSERT INTO maintenance_items (vehicle_id, item, last_done_km, interval_km) VALUES
  ('00000000-0000-4000-8000-000000001201', 'Engine oil',  6842,  3000),
  ('00000000-0000-4000-8000-000000001201', 'Chain',       6842,  1000),
  ('00000000-0000-4000-8000-000000001201', 'Brake pads',  6842, 15000),
  ('00000000-0000-4000-8000-000000001202', 'Engine oil', 20950,  2500),
  ('00000000-0000-4000-8000-000000001202', 'Chain',      20390,   800),
  ('00000000-0000-4000-8000-000000001202', 'Brake pads', 18200, 12000),
  ('00000000-0000-4000-8000-000000001203', 'Engine oil',  9240,  3000),
  ('00000000-0000-4000-8000-000000001203', 'Drive belt',  6310,  8000),
  ('00000000-0000-4000-8000-000000001203', 'Brake shoes',    0, 20000)
ON CONFLICT (vehicle_id, item) DO NOTHING;

INSERT INTO warranties (id, vehicle_id, title, brand, starts_on, ends_on, ends_at_km) VALUES
  ('00000000-0000-4000-8000-000000001401', '00000000-0000-4000-8000-000000001201', 'Bike warranty',    'Royal Enfield', '2025-10-20', (now() + interval '11 months')::date, NULL),
  ('00000000-0000-4000-8000-000000001402', '00000000-0000-4000-8000-000000001201', 'Battery',          'Exide Xplore',  '2025-01-18', '2027-01-18', NULL),
  ('00000000-0000-4000-8000-000000001403', '00000000-0000-4000-8000-000000001201', 'Front tyre',       'Ceat Zoom',     '2025-10-20', NULL, 18000),
  ('00000000-0000-4000-8000-000000001404', '00000000-0000-4000-8000-000000001201', 'Front brake pads', 'Genuine part',  '2026-04-14', (now() + interval '8 months')::date, NULL)
ON CONFLICT (id) DO NOTHING;

-- Live job: general service in Bay 03 with two parts waiting for approval.
INSERT INTO job_cards (id, number, workshop_id, customer_id, vehicle_id, status, mode, source, pickup_address_id, slot_start, slot_end, promised_ready_at,
                       bay_id, advisor_id, mechanic_id, rider_id, package_subtotal, discount_amount, estimate_amount, odometer_km_at_intake, created_at) VALUES
  ('00000000-0000-4000-8000-000000001301', 'BS-2026-000124', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000001001',
   '00000000-0000-4000-8000-000000001201', 'in_service', 'pickup', 'app', '00000000-0000-4000-8000-000000001101',
   pg_temp.ist(0, '14:00'), pg_temp.ist(0, '16:00'), pg_temp.ist(0, '19:30'),
   '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103',
   1499, 0, 1499, 6842, pg_temp.ist(-1, '18:20')),
  ('00000000-0000-4000-8000-000000001302', 'BS-2026-000125', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000001001',
   '00000000-0000-4000-8000-000000001202', 'booked', 'pickup', 'app', '00000000-0000-4000-8000-000000001101',
   pg_temp.ist(1, '11:00'), pg_temp.ist(1, '13:00'), NULL,
   NULL, '00000000-0000-4000-8000-000000000101', NULL, NULL,
   998, 0, 998, NULL, pg_temp.ist(0, '16:02')),
  ('00000000-0000-4000-8000-000000001303', 'BS-2026-000109', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000001001',
   '00000000-0000-4000-8000-000000001202', 'delivered', 'visit', 'app', NULL,
   pg_temp.ist(-93, '09:00'), pg_temp.ist(-93, '11:00'), pg_temp.ist(-93, '13:00'),
   '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', NULL,
   399, 0, 399, 21390, pg_temp.ist(-95, '10:00'))
ON CONFLICT (id) DO NOTHING;

UPDATE job_cards SET closed_at = pg_temp.ist(-93, '12:40'), delivered_at = pg_temp.ist(-93, '13:05')
WHERE id = '00000000-0000-4000-8000-000000001303' AND delivered_at IS NULL;

SELECT setval('job_card_number_seq', GREATEST(125, (SELECT last_value FROM job_card_number_seq)));

INSERT INTO job_card_services (job_card_id, service_id, name, price) VALUES
  ('00000000-0000-4000-8000-000000001301', 'general', 'General service',      1499),
  ('00000000-0000-4000-8000-000000001302', 'oil',     'Engine oil change',     799),
  ('00000000-0000-4000-8000-000000001302', 'chain',   'Chain clean and lube',  199),
  ('00000000-0000-4000-8000-000000001303', 'brake',   'Brake inspection',      399)
ON CONFLICT DO NOTHING;

INSERT INTO job_card_extras (id, job_card_id, part_name, note, amount, status, raised_by_staff_id, raised_by_label, created_at) VALUES
  ('00000000-0000-4000-8000-000000001501', '00000000-0000-4000-8000-000000001301', 'Front brake pads',
   'Below the thickness we recommend. A new set stops the bike shorter.', 650, 'pending', '00000000-0000-4000-8000-000000000101', 'Amit, Bay 03', pg_temp.ist(0, '18:47')),
  ('00000000-0000-4000-8000-000000001502', '00000000-0000-4000-8000-000000001301', 'Chain clean and tension',
   'Dry and a little loose. Doing it now avoids a full replacement.', 199, 'pending', '00000000-0000-4000-8000-000000000101', 'Amit, Bay 03', pg_temp.ist(0, '18:48'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO job_card_status_history (job_card_id, from_status, to_status, source, created_at)
SELECT * FROM (VALUES
  ('00000000-0000-4000-8000-000000001301'::uuid, NULL,             'booked',         'app',         pg_temp.ist(-1, '18:20')),
  ('00000000-0000-4000-8000-000000001301'::uuid, 'booked',         'rider_assigned', 'integration', pg_temp.ist(0, '13:30')),
  ('00000000-0000-4000-8000-000000001301'::uuid, 'rider_assigned', 'picked_up',      'integration', pg_temp.ist(0, '14:20')),
  ('00000000-0000-4000-8000-000000001301'::uuid, 'picked_up',      'at_workshop',    'integration', pg_temp.ist(0, '15:05')),
  ('00000000-0000-4000-8000-000000001301'::uuid, 'at_workshop',    'in_service',     'integration', pg_temp.ist(0, '18:40')),
  ('00000000-0000-4000-8000-000000001302'::uuid, NULL,             'booked',         'app',         pg_temp.ist(0, '16:02')),
  ('00000000-0000-4000-8000-000000001303'::uuid, NULL,             'booked',         'app',         pg_temp.ist(-95, '10:00')),
  ('00000000-0000-4000-8000-000000001303'::uuid, 'booked',         'at_workshop',    'integration', pg_temp.ist(-93, '09:10')),
  ('00000000-0000-4000-8000-000000001303'::uuid, 'at_workshop',    'in_service',     'integration', pg_temp.ist(-93, '09:40')),
  ('00000000-0000-4000-8000-000000001303'::uuid, 'in_service',     'job_closed',     'integration', pg_temp.ist(-93, '12:40')),
  ('00000000-0000-4000-8000-000000001303'::uuid, 'job_closed',     'delivered',      'integration', pg_temp.ist(-93, '13:05'))
) AS rows(job_card_id, from_status, to_status, source, created_at)
WHERE NOT EXISTS (SELECT 1 FROM job_card_status_history WHERE job_card_id IN (
  '00000000-0000-4000-8000-000000001301', '00000000-0000-4000-8000-000000001302', '00000000-0000-4000-8000-000000001303'));

-- Paid invoice for the delivered brake inspection: ₹150 from the wallet, the rest by UPI.
INSERT INTO invoices (id, number, job_card_id, customer_id, status, subtotal, discount_amount, extras_amount, taxable_amount, gst_rate, gst_amount, total, issued_at, paid_at) VALUES
  ('00000000-0000-4000-8000-000000001601', 'INV-2026-000109', '00000000-0000-4000-8000-000000001303', '00000000-0000-4000-8000-000000001001',
   'paid', 399, 0, 0, 399, 0.18, 72, 471, pg_temp.ist(-93, '12:40'), pg_temp.ist(-93, '13:05'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_lines (id, invoice_id, kind, label, unit_amount, amount, sort_order) VALUES
  ('00000000-0000-4000-8000-000000001611', '00000000-0000-4000-8000-000000001601', 'service', 'Brake inspection', 399, 399, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, invoice_id, customer_id, method, amount, status, provider, provider_reference, created_at, confirmed_at) VALUES
  ('00000000-0000-4000-8000-000000001701', '00000000-0000-4000-8000-000000001601', '00000000-0000-4000-8000-000000001001', 'wallet', 150, 'succeeded', 'wallet', NULL,           pg_temp.ist(-93, '13:00'), pg_temp.ist(-93, '13:00')),
  ('00000000-0000-4000-8000-000000001702', '00000000-0000-4000-8000-000000001601', '00000000-0000-4000-8000-000000001001', 'upi',    321, 'succeeded', 'manual', '523418907211', pg_temp.ist(-93, '13:05'), pg_temp.ist(-93, '13:05'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO wallet_transactions (id, customer_id, amount, kind, title, detail, job_card_id, payment_id, created_at) VALUES
  ('00000000-0000-4000-8000-000000001801', '00000000-0000-4000-8000-000000001001',   70, 'welcome',         'Welcome bonus',     'Added when you joined',          NULL, NULL, pg_temp.ist(-200, '10:00')),
  ('00000000-0000-4000-8000-000000001802', '00000000-0000-4000-8000-000000001001',  151, 'cashback',        'Service cashback',  'General service, Guerrilla 450', NULL, NULL, pg_temp.ist(-160, '17:00')),
  ('00000000-0000-4000-8000-000000001803', '00000000-0000-4000-8000-000000001001', -150, 'service_payment', 'Used on a service', 'Brake inspection, Classic 350',  '00000000-0000-4000-8000-000000001303', '00000000-0000-4000-8000-000000001701', pg_temp.ist(-93, '13:00')),
  ('00000000-0000-4000-8000-000000001804', '00000000-0000-4000-8000-000000001001',  149, 'refund',          'Refund',            'Cancelled wash, Access 125',     NULL, NULL, pg_temp.ist(-78, '12:00')),
  ('00000000-0000-4000-8000-000000001805', '00000000-0000-4000-8000-000000001001',  200, 'referral',        'Referral bonus',    'Arun joined with your code',     NULL, NULL, pg_temp.ist(-68, '12:00'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (id, customer_id, job_card_id, kind, title, body, target_screen, pushed_at, created_at) VALUES
  ('00000000-0000-4000-8000-000000001901', '00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001301', 'confirmation', 'General service booked',
   'Pickup today, 2–4 PM, from PJ Extension.', 'Track + live view', now(), pg_temp.ist(-1, '18:20')),
  ('00000000-0000-4000-8000-000000001902', '00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001302', 'confirmation', 'You’re booked',
   'Engine oil change and chain clean. Pickup tomorrow, 11 AM–1 PM.', 'Track + live view', now(), pg_temp.ist(0, '16:02')),
  ('00000000-0000-4000-8000-000000001903', '00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001301', 'update', 'Service has started',
   'Rahul is on the general service in Bay 03. The camera is live.', 'Track + live view', now(), pg_temp.ist(0, '18:40')),
  ('00000000-0000-4000-8000-000000001904', '00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001301', 'update', 'Two parts need your OK',
   'Amit sent them from Bay 03. Nothing extra is fitted until you say yes.', 'Part approval', now(), pg_temp.ist(0, '18:48'))
ON CONFLICT (id) DO NOTHING;
