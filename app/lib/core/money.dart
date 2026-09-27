import 'package:intl/intl.dart';

final _rupees = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

/// Prices are stored as integer paise (see docs/DATA_MODEL.md).
String rupees(int paise) => _rupees.format(paise / 100);

const freeDeliveryFrom = 49900; // ₹499
const deliveryFee = 4900; // ₹49

int deliveryFor(int subtotal) => subtotal == 0 || subtotal >= freeDeliveryFrom ? 0 : deliveryFee;
