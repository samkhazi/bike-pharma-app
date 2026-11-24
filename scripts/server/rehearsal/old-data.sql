-- Made-up rows for the CI rehearsal of scripts/server/setup.sh (never real customers).
INSERT INTO bay (id, name, url, status) VALUES
  (3, 'BAY 3', 'http://127.0.0.1:5080/live/streams/cam5.m3u8', 'free'),
  (5, 'BAY 5', 'http://127.0.0.1:5080/live/streams/cam7.m3u8', 'free');
INSERT INTO mechanic (id, name, address, phone, pic, status, wallet, auth) VALUES (7, 'manju test', '', '9811100190', '', 'BUSY', '0', 'x');
INSERT INTO service_adviser (id, name, email, phone, status, role, auth) VALUES (2, 'reception test', 'r@test', '9811100191', 'ACTIVE', 'reception', 'x');
INSERT INTO user (id, userphone, username, wallet) VALUES (801, '9876543210', 'test customer', '50');
INSERT INTO a_bikes (id, user_id, type, make, model, km, reg_no) VALUES (901, '801', 'bike', 'Royal Enfield', 'Classic 350', '12000', 'KA17EZ1234');
INSERT INTO job_card (id, user_id, phone, name, vehicle_number, make, model, last_service_date, service_type, service_package, estimated_cost, odo_reading,
    fuel_level, image1, image2, identifier, approval, created_at, slot_start, slot_end, delivery_time, status, stream_status, dd, mm, yy, mechanic_id, bay_id, completed_at)
  VALUES (4001, '801', '9876543210', 'Test Customer', 'KA17EZ1234', 'Royal Enfield', 'Classic 350', '', 'GENERAL SERVICING', '350cc', '650', '12000', '20', '', '', '',
    'APPROVED', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), '10:00:00', '11:00:00', '', 'ONGOING', 'ACTIVE',
    DATE_FORMAT(NOW(), '%d'), DATE_FORMAT(NOW(), '%m'), DATE_FORMAT(NOW(), '%Y'), '7', '3', NULL);
INSERT INTO job_labour_items (job_card_id, labour_name, labour_price, cc_type, is_custom) VALUES (4001, 'GENERAL SERVICING', 650, '350cc', 0);
