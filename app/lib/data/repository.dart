import '../models/models.dart';

class LookupUnavailable implements Exception {
  final String message;
  LookupUnavailable(this.message);
  @override
  String toString() => message;
}

class PlacedOrder {
  final String orderId;
  final int total;
  final String? razorpayOrderId;
  final String? razorpayKeyId;
  const PlacedOrder({required this.orderId, required this.total, this.razorpayOrderId, this.razorpayKeyId});
}

/// Everything the app needs from the backend. [DemoRepository] runs fully
/// offline with sample data; [FirebaseRepository] talks to Firebase.
abstract class Repository {
  // Auth
  Future<void> sendOtp(String phone);
  Future<String> verifyOtp(String code); // returns uid
  Future<void> signOut();
  String? get currentUid;

  // Profile + vehicles
  Future<UserProfile?> loadProfile();
  Future<void> saveProfile({required String name, required String phone});
  Future<List<Vehicle>> vehicles();
  Future<Vehicle> saveVehicle(Vehicle v, {bool makeActive = true});
  Future<void> setActiveVehicle(String vehicleId);
  Future<Vehicle> lookupVehicle(String regNo);

  // Catalogue
  Future<List<Offer>> offers();
  Future<List<Product>> products({String? category});
  Future<Product?> product(String id);

  // Cart (server-side so it syncs across devices)
  Future<Map<String, int>> cart();
  Future<void> setCartQty(String productId, int qty);

  // Orders + bookings
  Future<PlacedOrder> placeOrder({
    required Map<String, int> items,
    required Address address,
    required String paymentMethod,
  });
  Future<void> verifyPayment({required String orderId, required String paymentId, required String signature});
  Future<List<ShopOrder>> orders();
  Future<ServiceBooking> bookService({
    required String vehicleId,
    required String serviceType,
    required String date,
    required String slot,
    required bool pickup,
  });
  Future<List<ServiceBooking>> serviceBookings();
  Future<void> requestModify({required String vehicleId, required List<String> items, String? note});

  // Mechanics
  Future<Mechanic?> mechanic(String id);
}
