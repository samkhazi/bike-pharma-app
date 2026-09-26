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
  });

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
      );
}

class CartLine {
  final Product product;
  final int qty;
  const CartLine(this.product, this.qty);
  int get total => product.price * qty;
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
