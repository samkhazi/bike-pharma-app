import 'dart:async';

import '../models/models.dart';
import 'repository.dart';

/// Test numbers for the demo app (Sam, 2026-09-27). Any other number signs in
/// as a new customer.
const demoCustomerPhone = '+918951860708';
const demoMechanicPhone = '+919008948080';

/// Signs in as a Bike Pharma team member (verify mechanics; later inventory and billing).
const demoTeamPhone = '+919999999999';

/// Signs in as the owner: everything the team has, plus team members and mechanic discounts.
const demoOwnerPhone = '+918888888888';

/// One signed-in number's data, so switching numbers switches accounts.
class _DemoAccount {
  UserProfile? profile;
  final List<Vehicle> vehicles = [];
  final Map<String, int> cart = {};
  final List<ShopOrder> orders = [];
  final List<ServiceBooking> bookings = [];
}

/// Offline repository with sample data, used for demos and when Firebase is
/// not configured yet (`--dart-define=DEMO=true`). OTP is always 123456.
class DemoRepository implements Repository {
  String? _uid;
  String? _phone;
  String? _pendingPhone;
  final _accounts = <String, _DemoAccount>{};
  int _seq = 1;

  _DemoAccount get _me => _accounts.putIfAbsent(_uid ?? 'demo-user', _DemoAccount.new);
  UserProfile? get _profile => _me.profile;
  set _profile(UserProfile? p) => _me.profile = p;
  List<Vehicle> get _vehicles => _me.vehicles;
  Map<String, int> get _cart => _me.cart;
  List<ShopOrder> get _orders => _me.orders;
  List<ServiceBooking> get _bookings => _me.bookings;

  @override
  String? get currentPhone => _phone;

  Future<T> _delay<T>(T v) => Future.delayed(const Duration(milliseconds: 250), () => v);

  @override
  String? get currentUid => _uid;

  @override
  Future<void> sendOtp(String phone) {
    _pendingPhone = phone;
    return _delay(null);
  }

  @override
  Future<String> verifyOtp(String code) async {
    await _delay(null);
    if (code != '123456') throw Exception('Wrong OTP. Demo OTP is 123456');
    _phone = _pendingPhone;
    final digits = _phone?.replaceAll(RegExp(r'\D'), '') ?? '';
    return _uid = digits.isEmpty ? 'demo-user' : 'demo-$digits';
  }

  @override
  Future<void> signOut() async {
    _uid = null;
    _phone = null;
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
    _profile = UserProfile(uid: _uid ?? 'demo-user', name: p?.name ?? '', phone: p?.phone ?? '', activeVehicleId: vehicleId);
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
      _delay(_catalogue.where((p) => category == null || p.category == category).toList());

  @override
  Future<Product?> product(String id) => _delay(_catalogue.where((p) => p.id == id).firstOrNull);

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
    // Like the server: only a verified mechanic's own discount, never a customer's.
    final discount = await myMechanicDiscount();
    final lines = items.entries.map((e) {
      final p = demoProducts.firstWhere((p) => p.id == e.key);
      return OrderItem(productId: p.id, name: p.name, price: mechanicPrice(p.price, discount), qty: e.value);
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
  Future<Mechanic?> mechanic(String id) {
    if (id == demoMechanic.id) return _delay(demoMechanic);
    // Mechanics the team verified in this demo get a public profile too.
    final a = _applications.values.where((a) => a.isApproved && a.mechanicId == id).firstOrNull;
    if (a == null) return _delay(null);
    final geo = parseLatLng(a.mapsLink);
    return _delay(Mechanic(
      id: id,
      name: a.name,
      garageName: a.garageName,
      address: a.address,
      phone: a.phone,
      openHours: a.openHours,
      photos: a.photos,
      specialistBrands: a.specialistBrands,
      vehicleTypes: a.vehicleTypes,
      services: a.services,
      experienceYears: a.experienceYears,
      spareBuyerSince: DateTime.now().year,
      lat: geo?.lat ?? 0,
      lng: geo?.lng ?? 0,
      verified: true,
      uid: a.uid,
    ));
  }

  // Team list by mobile number, like team/{phone} in Firestore.
  final _team = <String, TeamMember>{
    demoOwnerPhone: const TeamMember(phone: demoOwnerPhone, name: 'Owner (demo)', role: StaffRole.owner),
    demoTeamPhone: const TeamMember(phone: demoTeamPhone, name: 'Team member (demo)', role: StaffRole.staff),
  };

  StaffRole? get _staffRole => _uid == null ? null : _team[_phone]?.role;
  bool get _isTeam => _staffRole != null;
  bool get _isOwner => _staffRole == StaffRole.owner;

  void _requireTeam() {
    if (!_isTeam) throw Exception('Sirf Bike Pharma team ye kar sakti hai');
  }

  void _requireOwner() {
    if (!_isOwner) throw Exception('Sirf owner ye kar sakta hai');
  }

  @override
  Future<StaffRole?> staffRole() => _delay(_staffRole);

  @override
  Future<List<TeamMember>> teamMembers() async {
    _requireTeam();
    final list = _team.values.toList()..sort((a, b) => a.role == b.role ? a.name.compareTo(b.name) : (a.role == StaffRole.owner ? -1 : 1));
    return _delay(list);
  }

  @override
  Future<void> saveTeamMember(TeamMember m) async {
    _requireOwner();
    if (!RegExp(r'^\+91[6-9]\d{9}$').hasMatch(m.phone)) throw Exception('Sahi 10 digit number daalo');
    if (m.phone == _phone && m.role != StaffRole.owner) throw Exception('Apna owner access khud nahi hata sakte');
    _team[m.phone] = m;
    await _delay(null);
  }

  @override
  Future<void> removeTeamMember(String phone) async {
    _requireOwner();
    if (phone == _phone) throw Exception('Apna number khud nahi hata sakte');
    _team.remove(phone);
    await _delay(null);
  }

  // Discount percent per verified mechanic id, set by the owner.
  final _discounts = <String, int>{demoMechanic.id: 10};

  List<(String id, String garage, String name, String? uid)> get _verifiedMechanics => [
        (demoMechanic.id, demoMechanic.garageName, demoMechanic.name, null),
        for (final a in _applications.values)
          if (a.isApproved && a.mechanicId != null) (a.mechanicId!, a.garageName, a.name, a.uid),
      ];

  @override
  Future<List<MechanicDiscount>> mechanicDiscounts() async {
    _requireOwner();
    return _delay([
      for (final m in _verifiedMechanics)
        MechanicDiscount(mechanicId: m.$1, garageName: m.$2, name: m.$3, uid: m.$4, percent: _discounts[m.$1] ?? 0),
    ]);
  }

  @override
  Future<void> setMechanicDiscount(MechanicDiscount d) async {
    _requireOwner();
    if (d.percent < 0 || d.percent > maxMechanicDiscount) throw Exception('Discount 0 se $maxMechanicDiscount% ke beech rakho');
    _discounts[d.mechanicId] = d.percent;
    await _delay(null);
  }

  @override
  Future<int> myMechanicDiscount() {
    final a = _applications[_uid ?? 'demo-user'];
    final id = a != null && a.isApproved ? a.mechanicId : null;
    return _delay(id == null ? 0 : (_discounts[id] ?? 0));
  }

  // Mechanic signups, keyed by the mechanic's uid. Only the team (and owner)
  // can list and verify them, like the real backend.
  // One sample signup waits for verification.
  final _applications = <String, MechanicApplication>{'m-imran': demoPendingApplication};
  int _nextMechanic = 416;

  @override
  Future<MechanicApplication?> myMechanicApplication() => _delay(_applications[_uid ?? 'demo-user']);

  @override
  Future<void> submitMechanicApplication(MechanicApplication a) async {
    final uid = _uid ?? 'demo-user';
    final existing = _applications[uid];
    if (existing != null && existing.isApproved) throw Exception('Aap already verified ho');
    _applications[uid] = MechanicApplication.fromMap(uid, a.toMap(), createdAt: existing?.createdAt ?? DateTime.now());
    await _delay(null);
  }

  @override
  Future<List<MechanicApplication>> pendingMechanicApplications() async {
    _requireTeam();
    return _delay(_applications.values.where((a) => a.isPending).toList());
  }

  @override
  Future<String?> reviewMechanicApplication(String uid,
      {required bool approve, String? reason, double? lat, double? lng}) async {
    _requireTeam();
    final a = _applications[uid];
    if (a == null || !a.isPending) throw Exception('Ye signup already check ho chuka hai');
    final id = approve ? 'BPM-${(_nextMechanic++).toString().padLeft(4, '0')}' : null;
    final updated = approve ? a.copyWith(status: 'approved', mechanicId: id) : a.copyWith(status: 'rejected', reason: reason ?? '');
    _applications[uid] = updated;
    return _delay(id);
  }

  // Stock received from distributors is kept next to the const sample catalogue.
  final _received = <String, int>{};
  final _learnedCodes = <String, List<String>>{};
  final _invoices = <String, PurchaseInvoice>{};

  List<Product> get _catalogue => [
        for (final p in demoProducts)
          Product(
            id: p.id,
            name: p.name,
            category: p.category,
            subCategory: p.subCategory,
            brand: p.brand,
            price: p.price,
            mrp: p.mrp,
            stock: p.stock + (_received[p.id] ?? 0),
            images: p.images,
            fits: p.fits,
            fitsAll: p.fitsAll,
            rating: p.rating,
            description: p.description,
            barcodes: [...p.barcodes, ...?_learnedCodes[p.id]],
          ),
      ];

  @override
  Future<List<PurchaseInvoice>> purchaseInvoices() => _delay(_invoices.values.toList().reversed.toList());

  @override
  Future<PurchaseInvoice> createPurchaseInvoice({
    required String distributor,
    required String invoiceNo,
    required List<PurchaseLine> lines,
  }) async {
    final id = purchaseInvoiceId(distributor, invoiceNo);
    if (_invoices.containsKey(id)) throw Exception('Ye invoice pehle se entered hai');
    final inv = PurchaseInvoice(
      id: id,
      distributor: distributor.trim(),
      invoiceNo: invoiceNo.trim(),
      lines: lines,
      createdAt: DateTime.now(),
    );
    _invoices[id] = inv;
    return _delay(inv);
  }

  @override
  Future<void> receivePurchaseInvoice(PurchaseInvoice invoice) async {
    if (_invoices[invoice.id]?.received ?? false) throw Exception('Ye invoice pehle hi inventory me add ho chuka hai');
    for (final l in invoice.lines) {
      if (l.received > 0) _received[l.productId] = (_received[l.productId] ?? 0) + l.received;
      final code = l.barcode;
      if (code != null) (_learnedCodes[l.productId] ??= []).add(code);
    }
    _invoices[invoice.id] = invoice.copyWith(received: true);
    await _delay(null);
  }

  @override
  Future<List<WarrantyItem>> warranties() => _delay(demoWarranties(DateTime.now()));
}

final demoPendingApplication = MechanicApplication(
  uid: 'm-imran',
  name: 'Imran Sayyed',
  garageName: 'Speed Point Garage',
  phone: '+919800000415',
  address: 'Service road, near toll naka',
  mapsLink: 'https://maps.google.com/?q=18.5310,73.8740',
  openHours: '9 AM to 10 PM',
  specialistBrands: const ['Bajaj', 'KTM', 'TVS'],
  vehicleTypes: const ['Commuter bikes', 'Sports bikes'],
  services: const ['Engine overhaul', 'Fuel injection', 'Electrical wiring'],
  experienceYears: 7,
  createdAt: DateTime(2026, 9, 27, 11, 20),
);

/// Sample bills dated relative to [now] so the demo always shows one active,
/// one ending soon and one expired part.
List<WarrantyItem> demoWarranties(DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  DateTime ago(int days) => today.subtract(Duration(days: days));
  const bike = 'Honda Shine 125 · BS6';
  return [
    WarrantyItem(id: 'w1', billNo: 'BP-25302', productName: 'Full Face Helmet', brand: 'Steelbird', months: 12, purchasedAt: ago(40), vehicle: bike),
    WarrantyItem(id: 'w2', billNo: 'BP-24117', productName: 'Battery 12V 5Ah', brand: 'Exide Xplore', serial: 'EXB5-7Q2291', months: 24, purchasedAt: ago(214), vehicle: bike),
    WarrantyItem(id: 'w3', billNo: 'BP-24117', productName: 'Self Starter Relay', brand: 'Minda', serial: 'MR-55120', months: 8, purchasedAt: ago(225), vehicle: bike),
    WarrantyItem(id: 'w4', billNo: 'BP-24117', productName: 'Headlight Bulb 35/35W', brand: 'Philips', months: 6, purchasedAt: ago(214), vehicle: bike),
  ];
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
