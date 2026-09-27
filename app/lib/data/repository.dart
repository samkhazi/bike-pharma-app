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

  /// The signed-in mobile number in E.164, e.g. +919876543210.
  String? get currentPhone;

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

  // Roles: the team list (team/{phone}) decides staff and owner. Null for
  // customers and mechanics.
  Future<StaffRole?> staffRole();
  Future<List<TeamMember>> teamMembers(); // team
  Future<void> saveTeamMember(TeamMember member); // owner
  Future<void> removeTeamMember(String phone); // owner

  // Mechanic signup + team verification
  Future<MechanicApplication?> myMechanicApplication();
  Future<void> submitMechanicApplication(MechanicApplication application);
  Future<List<MechanicApplication>> pendingMechanicApplications(); // team
  /// Team: approve (returns the new BPM id) or reject a signup.
  Future<String?> reviewMechanicApplication(String uid, {required bool approve, String? reason, double? lat, double? lng});

  // Mechanic discounts: set by the owner per verified mechanic, applied by the
  // server when that mechanic orders. Customers never get them.
  Future<List<MechanicDiscount>> mechanicDiscounts(); // owner
  Future<void> setMechanicDiscount(MechanicDiscount discount); // owner
  /// The signed-in mechanic's own discount percent (0 if none).
  Future<int> myMechanicDiscount();

  // Warranty tracker: warranty-covered parts from this customer's bills
  Future<List<WarrantyItem>> warranties();
}
