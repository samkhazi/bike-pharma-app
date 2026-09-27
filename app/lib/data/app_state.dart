import 'package:flutter/foundation.dart';

import '../core/money.dart';
import '../models/models.dart';
import 'demo_repository.dart';
import 'repository.dart';

/// App-wide state shared by all screens: who is signed in, their bike, the
/// catalogue and the cart.
class AppState extends ChangeNotifier {
  final Repository repo;
  AppState(this.repo);

  String phone = '';

  /// Set on the login screen when a mechanic (not a customer) is signing in.
  bool signingInAsMechanic = false;

  /// Which profile is open. The login number decides it: the team list
  /// (backend) gives team/owner, a mechanic signup gives mechanic, anyone
  /// else is a customer.
  UserRole role = UserRole.customer;

  /// Bike Pharma team or owner: verify mechanics (later inventory, billing).
  bool get isTeam => role == UserRole.team || role == UserRole.owner;
  bool get isOwner => role == UserRole.owner;
  bool get isMechanic => role == UserRole.mechanic;

  /// The signed-in verified mechanic's discount percent (0 for everyone else).
  int mechanicDiscount = 0;
  UserProfile? profile;
  List<Vehicle> vehicles = [];
  List<Product> catalogue = [];
  Map<String, int> cart = {};

  Vehicle? get activeVehicle {
    if (vehicles.isEmpty) return null;
    return vehicles.where((v) => v.id == profile?.activeVehicleId).firstOrNull ?? vehicles.first;
  }

  String get firstName {
    final n = profile?.name.trim() ?? '';
    return n.isEmpty ? 'Rider' : n.split(' ').first;
  }

  /// Sam's rule: customers only see parts that fit their own bike. Mechanics
  /// work on every bike, so they see all parts.
  List<Product> productsFor({String? category}) => catalogue
      .where((p) => category == null || p.category == category)
      .where((p) => isMechanic || p.fitsVehicle(activeVehicle))
      .toList();

  /// What the signed-in buyer pays per piece. Only a verified mechanic with a
  /// discount gets less; the server applies the same rule when ordering.
  int priceFor(Product p) => isMechanic ? mechanicPrice(p.price, mechanicDiscount) : p.price;

  Product? productById(String id) => catalogue.where((p) => p.id == id).firstOrNull;

  // ---------- session ----------
  /// Loads everything after sign in. Returns false if the profile is missing.
  Future<bool> loadSession() async {
    // After an app restart the login screen never ran, so take the number from auth.
    final signedIn = repo.currentPhone;
    if (signedIn != null && signedIn.isNotEmpty) phone = signedIn;
    profile = await repo.loadProfile();
    final staff = await repo.staffRole().catchError((_) => null);
    mechanicDiscount = 0;
    if (staff != null) {
      role = staff == StaffRole.owner ? UserRole.owner : UserRole.team;
    } else {
      final application = await repo.myMechanicApplication().catchError((_) => null);
      role = application != null ? UserRole.mechanic : UserRole.customer;
      if (application?.isApproved == true) {
        mechanicDiscount = await repo.myMechanicDiscount().catchError((_) => 0);
      }
    }
    notifyListeners();
    if (profile == null) return false;
    vehicles = await repo.vehicles();
    await Future.wait([refreshCatalogue(), refreshCart()]);
    notifyListeners();
    return vehicles.isNotEmpty;
  }

  /// Where to go right after sign in: the team to mechanic verification,
  /// mechanics to their section, customers to the shop or onboarding.
  Future<String> landingRoute() async {
    final complete = await loadSession();
    if (isTeam) return '/team';
    final demoMechanic = repo is DemoRepository && repo.currentPhone == demoMechanicPhone;
    if (signingInAsMechanic || demoMechanic) {
      role = UserRole.mechanic;
      notifyListeners();
    }
    if (isMechanic) return '/mechanic';
    return complete ? '/home' : '/create-profile';
  }

  /// Re-reads the signed-in mechanic's signup and discount (after signup, or
  /// when the team verifies them or the owner changes the discount).
  Future<MechanicApplication?> refreshMechanic() async {
    final a = await repo.myMechanicApplication();
    if (a != null && !isTeam) role = UserRole.mechanic;
    mechanicDiscount = a?.isApproved == true ? await repo.myMechanicDiscount().catchError((_) => 0) : 0;
    notifyListeners();
    return a;
  }

  Future<void> refreshCatalogue() async {
    catalogue = await repo.products();
    notifyListeners();
  }

  Future<void> saveProfile(String name) async {
    await repo.saveProfile(name: name, phone: phone);
    profile = await repo.loadProfile();
    notifyListeners();
  }

  Future<Vehicle> addVehicle(Vehicle v) async {
    final saved = await repo.saveVehicle(v);
    vehicles = await repo.vehicles();
    profile = await repo.loadProfile();
    if (catalogue.isEmpty) await refreshCatalogue();
    notifyListeners();
    return saved;
  }

  Future<void> switchVehicle(String id) async {
    await repo.setActiveVehicle(id);
    profile = await repo.loadProfile();
    notifyListeners();
  }

  Future<void> signOut() async {
    await repo.signOut();
    profile = null;
    vehicles = [];
    cart = {};
    phone = '';
    role = UserRole.customer;
    mechanicDiscount = 0;
    signingInAsMechanic = false;
    notifyListeners();
  }

  // ---------- cart ----------
  Future<void> refreshCart() async {
    cart = await repo.cart();
    notifyListeners();
  }

  int get cartCount => cart.values.fold(0, (a, b) => a + b);

  List<CartLine> get cartLines => [
        for (final e in cart.entries)
          if (productById(e.key) != null) CartLine(productById(e.key)!, e.value, priceFor(productById(e.key)!)),
      ];

  int get cartSubtotal => cartLines.fold(0, (s, l) => s + l.total);
  int get cartDelivery => deliveryFor(cartSubtotal);
  int get cartTotal => cartSubtotal + cartDelivery;

  Future<void> setQty(String productId, int qty) async {
    if (qty <= 0) {
      cart.remove(productId);
    } else {
      cart[productId] = qty;
    }
    notifyListeners();
    await repo.setCartQty(productId, qty);
  }

  Future<void> addToCart(String productId, [int qty = 1]) => setQty(productId, (cart[productId] ?? 0) + qty);

  Future<PlacedOrder> checkout(Address address, String paymentMethod) async {
    final placed = await repo.placeOrder(items: Map.of(cart), address: address, paymentMethod: paymentMethod);
    await refreshCart();
    return placed;
  }
}
