import 'package:flutter/foundation.dart';

import '../core/money.dart';
import '../models/models.dart';
import 'repository.dart';

/// App-wide state shared by all screens: who is signed in, their bike, the
/// catalogue and the cart.
class AppState extends ChangeNotifier {
  final Repository repo;
  AppState(this.repo);

  String phone = '';
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

  /// Sam's rule: customers only see parts that fit their own bike.
  List<Product> productsFor({String? category}) => catalogue
      .where((p) => category == null || p.category == category)
      .where((p) => p.fitsVehicle(activeVehicle))
      .toList();

  Product? productById(String id) => catalogue.where((p) => p.id == id).firstOrNull;

  // ---------- session ----------
  /// Loads everything after sign in. Returns false if the profile is missing.
  Future<bool> loadSession() async {
    profile = await repo.loadProfile();
    if (profile == null) return false;
    vehicles = await repo.vehicles();
    await Future.wait([refreshCatalogue(), refreshCart()]);
    notifyListeners();
    return vehicles.isNotEmpty;
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
          if (productById(e.key) != null) CartLine(productById(e.key)!, e.value),
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
