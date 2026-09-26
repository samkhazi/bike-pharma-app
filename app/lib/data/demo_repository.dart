import 'dart:async';

import '../models/models.dart';
import 'repository.dart';

/// Offline repository with sample data, used for demos and when Firebase is
/// not configured yet (`--dart-define=DEMO=true`). OTP is always 123456.
class DemoRepository implements Repository {
  String? _uid;
  UserProfile? _profile;
  final List<Vehicle> _vehicles = [];
  final Map<String, int> _cart = {};
  final List<ShopOrder> _orders = [];
  final List<ServiceBooking> _bookings = [];
  int _seq = 1;

  Future<T> _delay<T>(T v) => Future.delayed(const Duration(milliseconds: 250), () => v);

  @override
  String? get currentUid => _uid;

  @override
  Future<void> sendOtp(String phone) => _delay(null);

  @override
  Future<String> verifyOtp(String code) async {
    await _delay(null);
    if (code != '123456') throw Exception('Wrong OTP. Demo OTP is 123456');
    return _uid = 'demo-user';
  }

  @override
  Future<void> signOut() async {
    _uid = null;
  }

  @override
  Future<UserProfile?> loadProfile() => _delay(_profile);

  @override
  Future<void> saveProfile({required String name, required String phone}) async {
    _profile = UserProfile(uid: _uid ?? 'demo-user', name: name, phone: phone, activeVehicleId: _profile?.activeVehicleId);
  }

  @override
  Future<List<Vehicle>> vehicles() => _delay(List.of(_vehicles));

  @override
  Future<Vehicle> saveVehicle(Vehicle v, {bool makeActive = true}) async {
    final saved = v.id.isEmpty ? v.copyWith(id: 'v${_seq++}') : v;
    _vehicles.removeWhere((x) => x.id == saved.id);
    _vehicles.add(saved);
    if (makeActive) await setActiveVehicle(saved.id);
    return saved;
  }

  @override
  Future<void> setActiveVehicle(String vehicleId) async {
    final p = _profile;
    _profile = UserProfile(uid: p?.uid ?? 'demo-user', name: p?.name ?? '', phone: p?.phone ?? '', activeVehicleId: vehicleId);
  }

  @override
  Future<Vehicle> lookupVehicle(String regNo) async {
    await Future.delayed(const Duration(milliseconds: 900));
    return Vehicle(
      id: '',
      regNo: normalizeRegNo(regNo),
      brand: 'Honda',
      model: 'Shine 125',
      year: 2022,
      colour: 'Black',
      emission: 'BS6',
      fuel: 'Petrol',
      chassisMasked: 'ME4JC65XXXXXX4521',
      source: 'vahan',
    );
  }

  @override
  Future<List<Offer>> offers() => _delay(demoOffers);

  @override
  Future<List<Product>> products({String? category}) =>
      _delay(demoProducts.where((p) => category == null || p.category == category).toList());

  @override
  Future<Product?> product(String id) => _delay(demoProducts.where((p) => p.id == id).firstOrNull);

  @override
  Future<Map<String, int>> cart() => _delay(Map.of(_cart));

  @override
  Future<void> setCartQty(String productId, int qty) async {
    if (qty <= 0) {
      _cart.remove(productId);
    } else {
      _cart[productId] = qty;
    }
  }

  @override
  Future<PlacedOrder> placeOrder({
    required Map<String, int> items,
    required Address address,
    required String paymentMethod,
  }) async {
    await _delay(null);
    final lines = items.entries.map((e) {
      final p = demoProducts.firstWhere((p) => p.id == e.key);
      return OrderItem(productId: p.id, name: p.name, price: p.price, qty: e.value);
    }).toList();
    final subtotal = lines.fold<int>(0, (s, l) => s + l.price * l.qty);
    final fee = subtotal >= 49900 ? 0 : 4900;
    final id = 'BP${1024 + _orders.length}';
    _orders.insert(
      0,
      ShopOrder(
        id: id,
        items: lines,
        subtotal: subtotal,
        deliveryFee: fee,
        total: subtotal + fee,
        status: 'placed',
        paymentMethod: paymentMethod,
        paid: paymentMethod != 'cod',
        createdAt: DateTime.now(),
      ),
    );
    for (final k in items.keys) {
      _cart.remove(k);
    }
    return PlacedOrder(orderId: id, total: subtotal + fee);
  }

  @override
  Future<void> verifyPayment({required String orderId, required String paymentId, required String signature}) =>
      _delay(null);

  @override
  Future<List<ShopOrder>> orders() => _delay([..._orders, ...demoPastOrders]);

  @override
  Future<ServiceBooking> bookService({
    required String vehicleId,
    required String serviceType,
    required String date,
    required String slot,
    required bool pickup,
  }) async {
    final b = ServiceBooking(
      id: 'S${_seq++}',
      vehicleId: vehicleId,
      serviceType: serviceType,
      date: date,
      slot: slot,
      pickup: pickup,
    );
    _bookings.insert(0, b);
    return _delay(b);
  }

  @override
  Future<List<ServiceBooking>> serviceBookings() => _delay(List.of(_bookings));

  @override
  Future<void> requestModify({required String vehicleId, required List<String> items, String? note}) => _delay(null);

  @override
  Future<Mechanic?> mechanic(String id) => _delay(id == demoMechanic.id ? demoMechanic : null);
}

const _shine = 'honda|shine 125';
const _splendor = 'hero|splendor plus';
const _pulsar = 'bajaj|pulsar 150';

const demoProducts = <Product>[
  Product(id: 'p1', name: 'Brake Pad Set', category: 'spares', subCategory: 'Brakes', brand: 'Bosch', price: 44900, mrp: 54900, stock: 24, fits: [_shine, _splendor], rating: 4.6, description: 'Front disc brake pads with strong grip and low noise.'),
  Product(id: 'p2', name: 'Engine Oil 10W-30 (1L)', category: 'spares', subCategory: 'Engine oil', brand: 'Castrol', price: 39900, mrp: 44000, stock: 60, fits: [_shine, _splendor, _pulsar], rating: 4.8),
  Product(id: 'p3', name: 'Air Filter', category: 'spares', subCategory: 'Filters', brand: 'Honda Genuine', price: 22900, mrp: 25000, stock: 15, fits: [_shine], rating: 4.5),
  Product(id: 'p4', name: 'Chain Sprocket Kit', category: 'spares', subCategory: 'Chain', brand: 'Rolon', price: 129900, mrp: 149900, stock: 8, fits: [_shine, _pulsar], rating: 4.4),
  Product(id: 'p5', name: 'Spark Plug', category: 'spares', subCategory: 'Engine', brand: 'NGK', price: 14900, mrp: 17500, stock: 40, fits: [_shine, _splendor, _pulsar], rating: 4.7),
  Product(id: 'p6', name: 'Clutch Plate Set', category: 'spares', subCategory: 'Clutch', brand: 'Honda Genuine', price: 89900, mrp: 99900, stock: 6, fits: [_shine], rating: 4.5),
  Product(id: 'p7', name: 'Headlight LED Bulb', category: 'spares', subCategory: 'Electrical', brand: 'Philips', price: 69900, mrp: 89900, stock: 12, fits: [_shine, _splendor], rating: 4.3),
  Product(id: 'a1', name: 'Full Face Helmet', category: 'accessories', subCategory: 'Helmets', brand: 'Steelbird', price: 189900, mrp: 229900, stock: 10, fitsAll: true, rating: 4.6),
  Product(id: 'a2', name: 'Riding Gloves', category: 'accessories', subCategory: 'Riding gear', brand: 'Rynox', price: 73900, mrp: 89900, stock: 18, fitsAll: true, rating: 4.4),
  Product(id: 'a3', name: 'Bike Cover (Waterproof)', category: 'accessories', subCategory: 'Covers', brand: 'Bike Pharma', price: 49900, mrp: 69900, stock: 30, fitsAll: true, rating: 4.2),
  Product(id: 'a4', name: 'Mobile Holder', category: 'accessories', subCategory: 'Gadgets', brand: 'Bike Pharma', price: 39900, mrp: 59900, stock: 25, fitsAll: true, rating: 4.1),
  Product(id: 'a5', name: 'Seat Cover', category: 'accessories', subCategory: 'Seat', brand: 'Bike Pharma', price: 59900, mrp: 79900, stock: 9, fits: [_shine, _splendor], rating: 4.3),
];

const demoOffers = <Offer>[
  Offer(id: 'o1', tag: 'BIKE SERVICE', title: 'Apni bike ki service ab app se book karo', subtitle: '', cta: 'BOOK NOW', target: 'service'),
  Offer(id: 'o2', tag: 'THIS WEEK', title: 'Genuine spare parts par 10% off', subtitle: 'Code: PHARMA10', cta: 'SHOP NOW', target: 'shop'),
  Offer(id: 'o3', tag: 'NEW ARRIVALS', title: 'Helmets aur riding gear 25% tak off', subtitle: '', cta: 'EXPLORE', target: 'accessories'),
];

final demoPastOrders = <ShopOrder>[
  ShopOrder(id: 'BP0987', items: const [OrderItem(productId: 'a1', name: 'Full Face Helmet', price: 189900, qty: 1)], subtotal: 189900, deliveryFee: 0, total: 189900, status: 'delivered', paymentMethod: 'cod', paid: true, createdAt: DateTime(2026, 9, 12)),
  ShopOrder(id: 'BP0912', items: const [OrderItem(productId: 'a2', name: 'Riding Gloves', price: 73900, qty: 1)], subtotal: 73900, deliveryFee: 0, total: 73900, status: 'delivered', paymentMethod: 'razorpay', paid: true, createdAt: DateTime(2026, 8, 18)),
];

const demoMechanic = Mechanic(
  id: 'BPM-0231',
  name: 'Ravi Kumar',
  garageName: 'Ravi Auto Garage',
  address: 'Shop 12, Main Road, near Bus Stand',
  phone: '+919800000000',
  openHours: 'Open 9 AM to 8 PM',
  specialistBrands: ['Honda', 'Hero', 'Bajaj', 'TVS', 'Royal Enfield'],
  vehicleTypes: ['Commuter bikes', 'Scooters', 'Sports bikes'],
  services: ['Engine overhaul', 'Electrical wiring', 'Brakes and clutch', 'General service', 'Modification'],
  rating: 4.8,
  experienceYears: 12,
  spareBuyerSince: 2021,
  lat: 18.5204,
  lng: 73.8567,
  verified: true,
);
