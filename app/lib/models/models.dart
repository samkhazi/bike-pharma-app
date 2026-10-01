/// Plain data classes that mirror docs/DATA_MODEL.md.
library;

String fitKeyOf(String brand, String model) => '${brand.trim()}|${model.trim()}'.toLowerCase();

class Vehicle {
  final String id;
  final String type; // bike | scooter
  final String? regNo;
  final String brand;
  final String model;
  final int year;
  final String? colour;
  final String emission; // BS4 | BS6
  final String? fuel;
  final String? chassisMasked;
  final String source; // vahan | manual

  const Vehicle({
    required this.id,
    this.type = 'bike',
    this.regNo,
    required this.brand,
    required this.model,
    required this.year,
    this.colour,
    this.emission = 'BS6',
    this.fuel,
    this.chassisMasked,
    this.source = 'manual',
  });

  String get fitKey => fitKeyOf(brand, model);
  String get title => '$brand $model';
  String get subtitle => [year.toString(), if (regNo != null) formatRegNo(regNo!)].join(' · ');

  Map<String, dynamic> toMap() => {
        'type': type,
        'regNo': regNo,
        'brand': brand,
        'model': model,
        'year': year,
        'colour': colour,
        'emission': emission,
        'fuel': fuel,
        'chassisMasked': chassisMasked,
        'source': source,
        'fitKey': fitKey,
      };

  factory Vehicle.fromMap(String id, Map<String, dynamic> m) => Vehicle(
        id: id,
        type: m['type'] ?? 'bike',
        regNo: m['regNo'],
        brand: m['brand'] ?? '',
        model: m['model'] ?? '',
        year: (m['year'] ?? 0) as int,
        colour: m['colour'],
        emission: m['emission'] ?? 'BS6',
        fuel: m['fuel'],
        chassisMasked: m['chassisMasked'],
        source: m['source'] ?? 'manual',
      );

  Vehicle copyWith({String? id}) => Vehicle.fromMap(id ?? this.id, toMap());
}

/// `MH12AB1234` -> `MH 12 AB 1234`
String formatRegNo(String raw) {
  final r = raw.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
  final m = RegExp(r'^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$').firstMatch(r);
  if (m == null) return r;
  return [m[1], m[2], m[3], m[4]].where((s) => s != null && s.isNotEmpty).join(' ');
}

String normalizeRegNo(String raw) => raw.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();

class Product {
  final String id;
  final String name;
  final String category; // spares | accessories
  final String subCategory;
  final String brand;
  final int price; // paise
  final int mrp; // paise
  final int stock;
  final List<String> images;
  final List<String> fits;
  final bool fitsAll;
  final double rating;
  final String? description;

  /// Barcodes / QR codes printed on this part's packs. Learned while receiving
  /// a distributor invoice, so the next scan matches it straight away.
  final List<String> barcodes;

  const Product({
    required this.id,
    required this.name,
    required this.category,
    required this.subCategory,
    required this.brand,
    required this.price,
    required this.mrp,
    required this.stock,
    this.images = const [],
    this.fits = const [],
    this.fitsAll = false,
    this.rating = 0,
    this.description,
    this.barcodes = const [],
  });

  Product withReceived(int qty, {String? barcode}) => Product(
        id: id,
        name: name,
        category: category,
        subCategory: subCategory,
        brand: brand,
        price: price,
        mrp: mrp,
        stock: stock + qty,
        images: images,
        fits: fits,
        fitsAll: fitsAll,
        rating: rating,
        description: description,
        barcodes: barcode == null || barcodes.contains(barcode) ? barcodes : [...barcodes, barcode],
      );

  bool fitsVehicle(Vehicle? v) => fitsAll || (v != null && fits.contains(v.fitKey));
  int get discountPercent => mrp <= price ? 0 : (((mrp - price) / mrp) * 100).round();

  factory Product.fromMap(String id, Map<String, dynamic> m) => Product(
        id: id,
        name: m['name'] ?? '',
        category: m['category'] ?? 'spares',
        subCategory: m['subCategory'] ?? '',
        brand: m['brand'] ?? '',
        price: (m['price'] ?? 0) as int,
        mrp: (m['mrp'] ?? m['price'] ?? 0) as int,
        stock: (m['stock'] ?? 0) as int,
        images: List<String>.from(m['images'] ?? const []),
        fits: List<String>.from(m['fits'] ?? const []),
        fitsAll: m['fitsAll'] ?? false,
        rating: ((m['rating'] ?? 0) as num).toDouble(),
        description: m['description'],
        barcodes: List<String>.from(m['barcodes'] ?? const []),
      );
}

class CartLine {
  final Product product;
  final int qty;

  /// What this buyer pays per piece: the shop price, or the mechanic price
  /// for a verified mechanic with a discount.
  final int unitPrice;
  CartLine(this.product, this.qty, [int? unitPrice]) : unitPrice = unitPrice ?? product.price;
  int get total => unitPrice * qty;
}

/// Who is signed in. One app, and the login number decides the profile:
/// customer (default), mechanic (signed up as a mechanic), team (Bike Pharma
/// staff: verify mechanics, later inventory and billing) or owner (everything,
/// plus team members and mechanic discounts).
enum UserRole { customer, mechanic, team, owner }

/// Staff roles on the team list (team/{phone}).
enum StaffRole { staff, owner }

class TeamMember {
  final String phone; // +91XXXXXXXXXX
  final String name;
  final StaffRole role;
  const TeamMember({required this.phone, required this.name, required this.role});

  Map<String, dynamic> toMap() => {'name': name, 'role': role.name};

  factory TeamMember.fromMap(String phone, Map<String, dynamic> m) => TeamMember(
        phone: phone,
        name: (m['name'] ?? '') as String,
        role: m['role'] == 'owner' ? StaffRole.owner : StaffRole.staff,
      );
}

/// Highest mechanic discount the owner can set, in percent.
const maxMechanicDiscount = 50;

/// Price after a mechanic's discount, rounded to the nearest rupee and never
/// above the list price (prices are paise). Integer maths so it matches
/// mechanicPrice() in backend/functions/src/lib/orders.ts exactly.
int mechanicPrice(int price, int percent) {
  if (percent <= 0) return price;
  final p = percent.clamp(0, maxMechanicDiscount);
  final rounded = ((price * (100 - p) + 5000) ~/ 10000) * 100;
  return rounded < price ? rounded : price;
}

/// A verified mechanic with the discount the owner set for them.
class MechanicDiscount {
  final String mechanicId, garageName, name;
  final String? uid;
  final int percent;
  const MechanicDiscount({
    required this.mechanicId,
    required this.garageName,
    required this.name,
    required this.percent,
    this.uid,
  });
}

class Address {
  final String name, phone, line1, city, pincode;
  final String? line2;
  const Address({
    required this.name,
    required this.phone,
    required this.line1,
    this.line2,
    required this.city,
    required this.pincode,
  });
  Map<String, dynamic> toMap() =>
      {'name': name, 'phone': phone, 'line1': line1, 'line2': line2, 'city': city, 'pincode': pincode};
}

class OrderItem {
  final String productId, name;
  final int price, qty;
  const OrderItem({required this.productId, required this.name, required this.price, required this.qty});
  factory OrderItem.fromMap(Map<String, dynamic> m) =>
      OrderItem(productId: m['productId'], name: m['name'], price: m['price'], qty: m['qty']);
}

class ShopOrder {
  final String id;
  final List<OrderItem> items;
  final int subtotal, deliveryFee, total;
  final String status;
  final String paymentMethod;
  final bool paid;
  final DateTime createdAt;
  const ShopOrder({
    required this.id,
    required this.items,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.status,
    required this.paymentMethod,
    required this.paid,
    required this.createdAt,
  });

  bool get isActive => !const ['delivered', 'cancelled'].contains(status);
  String get title =>
      items.isEmpty ? 'Order' : items.length == 1 ? items.first.name : '${items.first.name} + ${items.length - 1} more';
}

/// A mechanic's signup, checked by the shop before they get a BPM id.
class MechanicApplication {
  final String uid;
  final String name, garageName, phone, address;
  final String mapsLink, openHours;
  final List<String> specialistBrands, vehicleTypes, services, photos;
  final int experienceYears;
  final String status; // pending | approved | rejected
  final String? mechanicId; // set when approved
  final String? reason; // set when rejected
  final DateTime? createdAt;

  const MechanicApplication({
    required this.uid,
    required this.name,
    required this.garageName,
    required this.phone,
    required this.address,
    this.mapsLink = '',
    this.openHours = '',
    this.specialistBrands = const [],
    this.vehicleTypes = const [],
    this.services = const [],
    this.photos = const [],
    this.experienceYears = 0,
    this.status = 'pending',
    this.mechanicId,
    this.reason,
    this.createdAt,
  });

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  /// Fields the mechanic writes (status is always sent as pending).
  Map<String, dynamic> toMap() => {
        'name': name,
        'garageName': garageName,
        'phone': phone,
        'address': address,
        'mapsLink': mapsLink,
        'openHours': openHours,
        'specialistBrands': specialistBrands,
        'vehicleTypes': vehicleTypes,
        'services': services,
        'photos': photos,
        'experienceYears': experienceYears,
        'status': 'pending',
      };

  factory MechanicApplication.fromMap(String uid, Map<String, dynamic> m, {DateTime? createdAt}) =>
      MechanicApplication(
        uid: uid,
        name: m['name'] ?? '',
        garageName: m['garageName'] ?? '',
        phone: m['phone'] ?? '',
        address: m['address'] ?? '',
        mapsLink: m['mapsLink'] ?? '',
        openHours: m['openHours'] ?? '',
        specialistBrands: List<String>.from(m['specialistBrands'] ?? const []),
        vehicleTypes: List<String>.from(m['vehicleTypes'] ?? const []),
        services: List<String>.from(m['services'] ?? const []),
        photos: List<String>.from(m['photos'] ?? const []),
        experienceYears: (m['experienceYears'] as num?)?.toInt() ?? 0,
        status: m['status'] ?? 'pending',
        mechanicId: m['mechanicId'],
        reason: m['reason'],
        createdAt: createdAt,
      );

  MechanicApplication copyWith({String? status, String? mechanicId, String? reason}) => MechanicApplication(
        uid: uid,
        name: name,
        garageName: garageName,
        phone: phone,
        address: address,
        mapsLink: mapsLink,
        openHours: openHours,
        specialistBrands: specialistBrands,
        vehicleTypes: vehicleTypes,
        services: services,
        photos: photos,
        experienceYears: experienceYears,
        status: status ?? this.status,
        mechanicId: mechanicId ?? this.mechanicId,
        reason: reason ?? this.reason,
        createdAt: createdAt,
      );
}

/// Pulls "lat,lng" out of a Google Maps link or typed coordinates (same rule as the backend).
({double lat, double lng})? parseLatLng(String input) {
  final m = RegExp(r'(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)').firstMatch(input);
  if (m == null) return null;
  final lat = double.parse(m.group(1)!), lng = double.parse(m.group(2)!);
  if (lat.abs() > 90 || lng.abs() > 180) return null;
  return (lat: lat, lng: lng);
}

enum WarrantyStatus { active, endingSoon, expired }

/// One warranty-covered part, saved against the shop bill it was sold on.
class WarrantyItem {
  final String id;
  final String billNo;
  final String productName, brand;
  final String? serial;
  final String? vehicle; // e.g. "Honda Shine 125 · BS6"
  final DateTime purchasedAt;
  final int months;

  const WarrantyItem({
    required this.id,
    required this.billNo,
    required this.productName,
    required this.brand,
    required this.purchasedAt,
    required this.months,
    this.serial,
    this.vehicle,
  });

  DateTime get endsAt => DateTime(purchasedAt.year, purchasedAt.month + months, purchasedAt.day);

  int daysLeft([DateTime? now]) {
    final n = now ?? DateTime.now();
    return endsAt.difference(DateTime(n.year, n.month, n.day)).inDays;
  }

  WarrantyStatus status([DateTime? now]) {
    final d = daysLeft(now);
    if (d < 0) return WarrantyStatus.expired;
    if (d <= 30) return WarrantyStatus.endingSoon;
    return WarrantyStatus.active;
  }

  /// 0..1 share of the warranty period already used.
  double used([DateTime? now]) {
    final total = endsAt.difference(purchasedAt).inDays;
    if (total <= 0) return 1;
    return (1 - daysLeft(now) / total).clamp(0.0, 1.0);
  }
}

class ServiceBooking {
  final String id, vehicleId, serviceType, date, slot, status;
  final bool pickup;
  const ServiceBooking({
    required this.id,
    required this.vehicleId,
    required this.serviceType,
    required this.date,
    required this.slot,
    required this.pickup,
    this.status = 'booked',
  });
}

class Mechanic {
  final String id; // BPM-0231
  final String name, garageName, address, phone, openHours;
  final List<String> photos, specialistBrands, vehicleTypes, services;
  final double rating, lat, lng;
  final int experienceYears, spareBuyerSince;
  final bool verified;

  /// The mechanic's login, when they joined through the app signup.
  final String? uid;

  const Mechanic({
    required this.id,
    required this.name,
    required this.garageName,
    required this.address,
    required this.phone,
    required this.openHours,
    this.photos = const [],
    this.specialistBrands = const [],
    this.vehicleTypes = const [],
    this.services = const [],
    this.rating = 0,
    this.lat = 0,
    this.lng = 0,
    this.experienceYears = 0,
    this.spareBuyerSince = 0,
    this.verified = false,
    this.uid,
  });

  String get initials =>
      name.split(' ').where((p) => p.isNotEmpty).take(2).map((p) => p[0].toUpperCase()).join();

  factory Mechanic.fromMap(String id, Map<String, dynamic> m) {
    final geo = (m['geo'] as Map?) ?? const {};
    return Mechanic(
      id: id,
      name: m['name'] ?? '',
      garageName: m['garageName'] ?? '',
      address: m['address'] ?? '',
      phone: m['phone'] ?? '',
      openHours: m['openHours'] ?? '',
      photos: List<String>.from(m['photos'] ?? const []),
      specialistBrands: List<String>.from(m['specialistBrands'] ?? const []),
      vehicleTypes: List<String>.from(m['vehicleTypes'] ?? const []),
      services: List<String>.from(m['services'] ?? const []),
      rating: ((m['rating'] ?? 0) as num).toDouble(),
      lat: ((geo['lat'] ?? 0) as num).toDouble(),
      lng: ((geo['lng'] ?? 0) as num).toDouble(),
      experienceYears: (m['experienceYears'] ?? 0) as int,
      spareBuyerSince: (m['spareBuyerSince'] ?? 0) as int,
      verified: m['verified'] ?? false,
      uid: m['uid'] as String?,
    );
  }
}

/// Accepts `bikepharma://mechanic/BPM-0231`, a URL ending in the id, or the bare id.
String? parseMechanicId(String raw) {
  final m = RegExp(r'BPM-?(\d{4})', caseSensitive: false).firstMatch(raw.trim());
  return m == null ? null : 'BPM-${m[1]}';
}

class Offer {
  final String id, tag, title, subtitle, cta, target;
  const Offer({
    required this.id,
    required this.tag,
    required this.title,
    required this.subtitle,
    required this.cta,
    required this.target,
  });
  factory Offer.fromMap(String id, Map<String, dynamic> m) => Offer(
        id: id,
        tag: m['tag'] ?? '',
        title: m['title'] ?? '',
        subtitle: m['subtitle'] ?? '',
        cta: m['cta'] ?? '',
        target: m['target'] ?? 'shop',
      );
}

class UserProfile {
  final String uid, name, phone;
  final String? activeVehicleId;
  const UserProfile({required this.uid, required this.name, required this.phone, this.activeVehicleId});
}


/// One part on a distributor's invoice. [received] is how many the team has
/// scanned (or ticked) so far; only that count goes into stock.
class PurchaseLine {
  final String productId;
  final String name;
  final int qty; // as billed by the distributor
  final int received;

  /// Code scanned for this part during receiving, saved on the product.
  final String? barcode;

  const PurchaseLine({
    required this.productId,
    required this.name,
    required this.qty,
    this.received = 0,
    this.barcode,
  });

  bool get done => received >= qty;

  PurchaseLine copyWith({int? received, String? barcode}) => PurchaseLine(
        productId: productId,
        name: name,
        qty: qty,
        received: received ?? this.received,
        barcode: barcode ?? this.barcode,
      );

  Map<String, dynamic> toMap() => {
        'productId': productId,
        'name': name,
        'qty': qty,
        'received': received,
        'barcode': barcode,
      };

  factory PurchaseLine.fromMap(Map<String, dynamic> m) => PurchaseLine(
        productId: m['productId'] ?? '',
        name: m['name'] ?? '',
        qty: (m['qty'] ?? 0) as int,
        received: (m['received'] ?? 0) as int,
        barcode: m['barcode'],
      );
}

/// A distributor's bill for parts sent to the shop. Checked part by part while
/// unpacking; once [received] the scanned counts have been added to stock.
class PurchaseInvoice {
  final String id;
  final String distributor;
  final String invoiceNo;
  final List<PurchaseLine> lines;
  final bool received;
  final DateTime? createdAt;

  const PurchaseInvoice({
    required this.id,
    required this.distributor,
    required this.invoiceNo,
    required this.lines,
    this.received = false,
    this.createdAt,
  });

  int get totalQty => lines.fold(0, (a, l) => a + l.qty);
  int get totalReceived => lines.fold(0, (a, l) => a + (l.received > l.qty ? l.qty : l.received));
  int get missingQty => totalQty - totalReceived;

  PurchaseInvoice copyWith({List<PurchaseLine>? lines, bool? received}) => PurchaseInvoice(
        id: id,
        distributor: distributor,
        invoiceNo: invoiceNo,
        lines: lines ?? this.lines,
        received: received ?? this.received,
        createdAt: createdAt,
      );

  factory PurchaseInvoice.fromMap(String id, Map<String, dynamic> m, {DateTime? createdAt}) => PurchaseInvoice(
        id: id,
        distributor: m['distributor'] ?? '',
        invoiceNo: m['invoiceNo'] ?? '',
        lines: [for (final l in (m['lines'] as List? ?? const [])) PurchaseLine.fromMap(Map<String, dynamic>.from(l as Map))],
        received: m['received'] ?? false,
        createdAt: createdAt,
      );
}

/// Same distributor + invoice number always gives the same id, so one bill can
/// never be entered (and added to stock) twice.
String purchaseInvoiceId(String distributor, String invoiceNo) {
  String slug(String s) => s.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');
  return '${slug(distributor)}_${slug(invoiceNo)}';
}
