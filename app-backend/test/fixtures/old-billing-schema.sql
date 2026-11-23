-- Table layout of the old billing database (bikesurgeonoff), copied from its MySQL dump. No data.
CREATE TABLE `bay` (
  `id` int NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `url` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `bay`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `bay`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;
CREATE TABLE `mechanic` (
  `id` int NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pic` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `wallet` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `mechanic`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `mechanic`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;
CREATE TABLE `service_adviser` (
  `id` int NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'adviser',
  `auth` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `service_adviser`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `service_adviser`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;
CREATE TABLE `user` (
  `id` int NOT NULL,
  `userphone` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `useraddress` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(225) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userlandmark` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latuser` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `longuser` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addisset` int NOT NULL DEFAULT '0',
  `wallet` varchar(225) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '0',
  `auth` varchar(225) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp` varchar(225) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addl_phone` varchar(225) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `area_id` varchar(225) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_token` varchar(220) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `default_lid` varchar(220) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(220) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `userimage` varchar(220) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shop_name` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `shop_address` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `GST` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `referal_code` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `business_approval_status` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `bs_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `user`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5304;
CREATE TABLE `a_bikes` (
  `id` int NOT NULL,
  `user_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `make` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `km` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reg_no` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `a_bikes`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `a_bikes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3811;
CREATE TABLE `job_card` (
  `id` int NOT NULL,
  `user_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vehicle_number` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `make` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_service_date` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_type` text COLLATE utf8mb4_unicode_ci,
  `service_package` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estimated_cost` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `odo_reading` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `daily_km_avg` int DEFAULT NULL,
  `fuel_level` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issue_reported` text COLLATE utf8mb4_unicode_ci,
  `issue_text` text COLLATE utf8mb4_unicode_ci,
  `checkpoint_status` text COLLATE utf8mb4_unicode_ci,
  `general_service_checklist` text COLLATE utf8mb4_unicode_ci,
  `is_free_service_claim` tinyint(1) DEFAULT '0',
  `dents_scratches` text COLLATE utf8mb4_unicode_ci,
  `image1` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `image2` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `identifier` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `approval` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slot` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `slot_start` time DEFAULT NULL,
  `slot_end` time DEFAULT NULL,
  `delivery_time` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `stream_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `dd` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mm` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `yy` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mechanic_id` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bay_id` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parts_estimate` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_by_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mechanic_assigned_at` datetime DEFAULT NULL,
  `initiated_at` datetime DEFAULT NULL,
  `delay_minutes` int DEFAULT NULL,
  `fuel_label` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `job_card`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `job_card`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3949;
CREATE TABLE `job_labour_items` (
  `id` int NOT NULL,
  `job_card_id` int NOT NULL,
  `labour_name` varchar(500) NOT NULL,
  `labour_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `cc_type` varchar(50) DEFAULT '',
  `is_custom` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
ALTER TABLE `job_labour_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `job_card_id` (`job_card_id`),
  ADD KEY `idx_jc_id` (`job_card_id`);
ALTER TABLE `job_labour_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6883;
CREATE TABLE `service_invoice` (
  `id` int NOT NULL,
  `invoice_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_card_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `service_invoice`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `service_invoice`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3432;
CREATE TABLE `invoice` (
  `id` int NOT NULL,
  `invoice_no` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_phone` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_amount` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_before_discount` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_tax` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_status` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `created_by_email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_card_id` int DEFAULT NULL,
  `date` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `time` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dd` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mm` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `yy` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wallet_used` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `special_discount` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'cash, upi, card',
  `paid_date` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `split_cash` decimal(10,2) DEFAULT '0.00',
  `split_upi` decimal(10,2) DEFAULT '0.00',
  `customer_gstin` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coupon_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coupon_discount` decimal(10,2) DEFAULT '0.00',
  `is_locked` tinyint(1) DEFAULT '0',
  `advance_amount` decimal(10,2) DEFAULT '0.00',
  `advance_paid_at` datetime DEFAULT NULL,
  `advance_payment_method` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `balance_due` decimal(10,2) DEFAULT '0.00',
  `vehicle_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `advance_note` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `collected_by_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `collected_by_role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `collected_at` datetime DEFAULT NULL,
  `zoho_invoice_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `split_card` decimal(10,2) DEFAULT '0.00',
  `net_payable` decimal(10,2) DEFAULT NULL,
  `round_off` decimal(10,2) DEFAULT NULL,
  `dealer_id` int DEFAULT NULL,
  `credit_due_date` date DEFAULT NULL,
  `credit_cleared_at` datetime DEFAULT NULL,
  `credit_override_by` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `invoice`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_phone` (`customer_phone`),
  ADD KEY `idx_payment_method` (`payment_method`),
  ADD KEY `idx_id_desc` (`id` DESC);
ALTER TABLE `invoice`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5033;
CREATE TABLE `invoice_items` (
  `id` int NOT NULL,
  `product_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goods_price` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profit` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discount_percent` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_price` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cgst` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sgst` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `selling_price` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `added_by_id` int DEFAULT NULL,
  `added_by_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dd` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mm` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `yy` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `serial_no` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hsn` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_brand` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_invoice_id` (`invoice_id`);
ALTER TABLE `invoice_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23181;
CREATE TABLE `cms_products` (
  `id` int NOT NULL,
  `name` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `brand` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` text COLLATE utf8mb4_unicode_ci,
  `gross_selling_price` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `net_cost_price` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_rate` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gst_included` enum('yes','no') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'yes',
  `discount_to_user` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discount_to_wholeseller` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discount_to_mechanic` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stock` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stock_alert_on` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_no` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serial_no` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bar_code` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image1` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image2` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rack` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hsn` varchar(225) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `added_by_id` int DEFAULT NULL,
  `added_by_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `added_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `cms_products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_brand` (`brand`),
  ADD KEY `idx_name` (`name`(50)),
  ADD KEY `idx_serial` (`serial_no`(50));
ALTER TABLE `cms_products` ADD FULLTEXT KEY `ft_search` (`name`,`brand`,`model`,`serial_no`,`bar_code`);
ALTER TABLE `cms_products`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25595;
CREATE TABLE `a_service_bookings` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pickupType` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `longitude` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bike_details` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date_time` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduled_for` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attended_by` int DEFAULT NULL,
  `attended_by_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attended_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE `a_service_bookings`
  ADD PRIMARY KEY (`id`);
ALTER TABLE `a_service_bookings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=101;
