import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/models.dart';
import 'repository.dart';

/// Talks to the Firebase backend in `backend/` (see docs/DATA_MODEL.md).
class FirebaseRepository implements Repository {
  final _auth = FirebaseAuth.instance;
  final _db = FirebaseFirestore.instance;
  final _fn = FirebaseFunctions.instanceFor(region: 'asia-south1');

  String? _verificationId;
  ConfirmationResult? _webConfirmation;

  DocumentReference<Map<String, dynamic>> get _me => _db.collection('users').doc(_uid);
  String get _uid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) throw StateError('Not signed in');
    return uid;
  }

  @override
  String? get currentUid => _auth.currentUser?.uid;

  @override
  String? get currentPhone => _auth.currentUser?.phoneNumber;

  // ---------- Auth ----------
  @override
  Future<void> sendOtp(String phone) async {
    final completer = Completer<void>();
    await _auth.verifyPhoneNumber(
      phoneNumber: phone,
      verificationCompleted: (cred) async {
        // Android can auto-read the SMS.
        await _auth.signInWithCredential(cred);
        if (!completer.isCompleted) completer.complete();
      },
      verificationFailed: (e) {
        if (!completer.isCompleted) completer.completeError(Exception(e.message ?? 'Could not send OTP'));
      },
      codeSent: (id, _) {
        _verificationId = id;
        if (!completer.isCompleted) completer.complete();
      },
      codeAutoRetrievalTimeout: (id) => _verificationId = id,
    );
    return completer.future;
  }

  /// Web builds use reCAPTCHA-based sign in instead of [sendOtp].
  Future<void> sendOtpWeb(String phone) async {
    _webConfirmation = await _auth.signInWithPhoneNumber(phone);
  }

  @override
  Future<String> verifyOtp(String code) async {
    if (_auth.currentUser != null) return _auth.currentUser!.uid; // auto-verified
    if (_webConfirmation != null) {
      final r = await _webConfirmation!.confirm(code);
      return r.user!.uid;
    }
    final id = _verificationId;
    if (id == null) throw Exception('Please request the OTP again');
    final r = await _auth.signInWithCredential(PhoneAuthProvider.credential(verificationId: id, smsCode: code));
    return r.user!.uid;
  }

  @override
  Future<void> signOut() => _auth.signOut();

  // ---------- Profile ----------
  @override
  Future<UserProfile?> loadProfile() async {
    if (currentUid == null) return null;
    final d = await _me.get();
    if (!d.exists) return null;
    final m = d.data()!;
    return UserProfile(uid: d.id, name: m['name'] ?? '', phone: m['phone'] ?? '', activeVehicleId: m['activeVehicleId']);
  }

  @override
  Future<void> saveProfile({required String name, required String phone}) => _me.set({
        'name': name,
        'phone': phone,
        'createdAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

  @override
  Future<List<Vehicle>> vehicles() async {
    final q = await _me.collection('vehicles').get();
    return q.docs.map((d) => Vehicle.fromMap(d.id, d.data())).toList();
  }

  @override
  Future<Vehicle> saveVehicle(Vehicle v, {bool makeActive = true}) async {
    final col = _me.collection('vehicles');
    final ref = v.id.isEmpty ? col.doc() : col.doc(v.id);
    await ref.set(v.toMap());
    if (makeActive) await setActiveVehicle(ref.id);
    return v.copyWith(id: ref.id);
  }

  @override
  Future<void> setActiveVehicle(String vehicleId) =>
      _me.set({'activeVehicleId': vehicleId}, SetOptions(merge: true));

  @override
  Future<Vehicle> lookupVehicle(String regNo) async {
    try {
      final r = await _fn.httpsCallable('lookupVehicle').call({'regNo': normalizeRegNo(regNo)});
      final m = Map<String, dynamic>.from(r.data as Map);
      return Vehicle.fromMap('', {...m, 'source': 'vahan'});
    } on FirebaseFunctionsException catch (e) {
      throw LookupUnavailable(e.message ?? 'Vehicle details could not be fetched. Please fill them manually.');
    }
  }

  // ---------- Catalogue ----------
  @override
  Future<List<Offer>> offers() async {
    final q = await _db.collection('offers').where('active', isEqualTo: true).orderBy('order').get();
    return q.docs.map((d) => Offer.fromMap(d.id, d.data())).toList();
  }

  @override
  Future<List<Product>> products({String? category}) async {
    Query<Map<String, dynamic>> q = _db.collection('products').where('active', isEqualTo: true);
    if (category != null) q = q.where('category', isEqualTo: category);
    final r = await q.get();
    return r.docs.map((d) => Product.fromMap(d.id, d.data())).toList();
  }

  @override
  Future<Product?> product(String id) async {
    final d = await _db.collection('products').doc(id).get();
    return d.exists ? Product.fromMap(d.id, d.data()!) : null;
  }

  // ---------- Cart ----------
  @override
  Future<Map<String, int>> cart() async {
    final q = await _me.collection('cart').get();
    return {for (final d in q.docs) d.id: (d.data()['qty'] ?? 0) as int};
  }

  @override
  Future<void> setCartQty(String productId, int qty) {
    final ref = _me.collection('cart').doc(productId);
    return qty <= 0 ? ref.delete() : ref.set({'qty': qty, 'addedAt': FieldValue.serverTimestamp()});
  }

  // ---------- Orders ----------
  @override
  Future<PlacedOrder> placeOrder({
    required Map<String, int> items,
    required Address address,
    required String paymentMethod,
  }) async {
    final r = await _fn.httpsCallable('placeOrder').call({
      'items': [for (final e in items.entries) {'productId': e.key, 'qty': e.value}],
      'address': address.toMap(),
      'paymentMethod': paymentMethod,
    });
    final m = Map<String, dynamic>.from(r.data as Map);
    final rz = m['razorpay'] == null ? null : Map<String, dynamic>.from(m['razorpay'] as Map);
    return PlacedOrder(
      orderId: m['orderId'],
      total: m['total'],
      razorpayOrderId: rz?['orderId'],
      razorpayKeyId: rz?['keyId'],
    );
  }

  @override
  Future<void> verifyPayment({required String orderId, required String paymentId, required String signature}) =>
      _fn.httpsCallable('verifyPayment').call({
        'orderId': orderId,
        'razorpayPaymentId': paymentId,
        'razorpaySignature': signature,
      });

  @override
  Future<List<ShopOrder>> orders() async {
    final q = await _db.collection('orders').where('uid', isEqualTo: _uid).orderBy('createdAt', descending: true).get();
    return q.docs.map((d) {
      final m = d.data();
      return ShopOrder(
        id: d.id,
        items: [for (final i in (m['items'] as List? ?? [])) OrderItem.fromMap(Map<String, dynamic>.from(i))],
        subtotal: m['subtotal'] ?? 0,
        deliveryFee: m['deliveryFee'] ?? 0,
        total: m['total'] ?? 0,
        status: m['status'] ?? 'placed',
        paymentMethod: m['paymentMethod'] ?? 'cod',
        paid: m['paid'] ?? false,
        createdAt: (m['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      );
    }).toList();
  }

  @override
  Future<ServiceBooking> bookService({
    required String vehicleId,
    required String serviceType,
    required String date,
    required String slot,
    required bool pickup,
  }) async {
    final ref = await _db.collection('serviceBookings').add({
      'uid': _uid,
      'vehicleId': vehicleId,
      'serviceType': serviceType,
      'date': date,
      'slot': slot,
      'pickup': pickup,
      'status': 'booked',
      'createdAt': FieldValue.serverTimestamp(),
    });
    return ServiceBooking(id: ref.id, vehicleId: vehicleId, serviceType: serviceType, date: date, slot: slot, pickup: pickup);
  }

  @override
  Future<List<ServiceBooking>> serviceBookings() async {
    final q = await _db.collection('serviceBookings').where('uid', isEqualTo: _uid).get();
    return q.docs.map((d) {
      final m = d.data();
      return ServiceBooking(
        id: d.id,
        vehicleId: m['vehicleId'] ?? '',
        serviceType: m['serviceType'] ?? '',
        date: m['date'] ?? '',
        slot: m['slot'] ?? '',
        pickup: m['pickup'] ?? false,
        status: m['status'] ?? 'booked',
      );
    }).toList();
  }

  @override
  Future<void> requestModify({required String vehicleId, required List<String> items, String? note}) =>
      _db.collection('modifyRequests').add({
        'uid': _uid,
        'vehicleId': vehicleId,
        'items': items,
        'note': note,
        'status': 'new',
        'createdAt': FieldValue.serverTimestamp(),
      });

  // ---------- Mechanics ----------
  @override
  Future<Mechanic?> mechanic(String id) async {
    final d = await _db.collection('mechanics').doc(id).get();
    if (!d.exists) return null;
    final m = Mechanic.fromMap(d.id, d.data()!);
    return m.verified ? m : null;
  }

  // ---------- Roles: team list by mobile number ----------
  /// Owner: admins/{uid} or team/{phone} with role "owner". Staff: any other
  /// team/{phone}. Customers and mechanics are never on these lists, and the
  /// rules refuse them the read.
  @override
  Future<StaffRole?> staffRole() async {
    final user = _auth.currentUser;
    if (user == null) return null;
    Future<Map<String, dynamic>?> read(String collection, String id) async {
      try {
        final d = await _db.collection(collection).doc(id).get();
        return d.exists ? d.data() : null;
      } catch (_) {
        return null;
      }
    }

    if (await read('admins', user.uid) != null) return StaffRole.owner;
    final phone = user.phoneNumber;
    if (phone == null || phone.isEmpty) return null;
    final member = await read('team', phone);
    if (member == null) return null;
    return TeamMember.fromMap(phone, member).role;
  }

  @override
  Future<List<TeamMember>> teamMembers() async {
    final q = await _db.collection('team').get();
    final list = q.docs.map((d) => TeamMember.fromMap(d.id, d.data())).toList();
    list.sort((a, b) => a.role == b.role ? a.name.compareTo(b.name) : (a.role == StaffRole.owner ? -1 : 1));
    return list;
  }

  @override
  Future<void> saveTeamMember(TeamMember m) => _db.collection('team').doc(m.phone).set({
        ...m.toMap(),
        'addedBy': _uid,
        'addedAt': FieldValue.serverTimestamp(),
      });

  @override
  Future<void> removeTeamMember(String phone) => _db.collection('team').doc(phone).delete();

  // ---------- Mechanic discounts (owner sets, server applies) ----------
  @override
  Future<List<MechanicDiscount>> mechanicDiscounts() async {
    final results = await Future.wait([
      _db.collection('mechanics').where('verified', isEqualTo: true).get(),
      _db.collection('mechanicDiscounts').get(),
    ]);
    final percents = {for (final d in results[1].docs) d.id: ((d.data()['percent'] ?? 0) as num).toInt()};
    final list = [
      for (final d in results[0].docs)
        MechanicDiscount(
          mechanicId: d.id,
          garageName: (d.data()['garageName'] ?? '') as String,
          name: (d.data()['name'] ?? '') as String,
          uid: d.data()['uid'] as String?,
          percent: percents[d.id] ?? 0,
        ),
    ]..sort((a, b) => a.mechanicId.compareTo(b.mechanicId));
    return list;
  }

  @override
  Future<void> setMechanicDiscount(MechanicDiscount d) => _db.collection('mechanicDiscounts').doc(d.mechanicId).set({
        'percent': d.percent,
        'uid': ?d.uid,
        'updatedBy': _uid,
        'updatedAt': FieldValue.serverTimestamp(),
      });

  @override
  Future<int> myMechanicDiscount() async {
    final a = await myMechanicApplication();
    final id = a != null && a.isApproved ? a.mechanicId : null;
    if (id == null) return 0;
    try {
      final d = await _db.collection('mechanicDiscounts').doc(id).get();
      return d.exists ? ((d.data()!['percent'] ?? 0) as num).toInt() : 0;
    } catch (_) {
      return 0; // no discount set yet (the rules refuse reading a missing doc)
    }
  }

  MechanicApplication _application(DocumentSnapshot<Map<String, dynamic>> d) =>
      MechanicApplication.fromMap(d.id, d.data()!, createdAt: (d.data()!['createdAt'] as Timestamp?)?.toDate());

  // ---------- Mechanic signup + verification ----------
  @override
  Future<MechanicApplication?> myMechanicApplication() async {
    final d = await _db.collection('mechanicApplications').doc(_uid).get();
    return d.exists ? _application(d) : null;
  }

  @override
  Future<void> submitMechanicApplication(MechanicApplication a) async {
    final ref = _db.collection('mechanicApplications').doc(_uid);
    final existing = await ref.get();
    await ref.set({
      ...a.toMap(),
      'createdAt': existing.exists ? existing.data()!['createdAt'] : FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  @override
  Future<List<MechanicApplication>> pendingMechanicApplications() async {
    final q = await _db
        .collection('mechanicApplications')
        .where('status', isEqualTo: 'pending')
        .orderBy('createdAt')
        .get();
    return q.docs.map(_application).toList();
  }

  @override
  Future<String?> reviewMechanicApplication(String uid,
      {required bool approve, String? reason, double? lat, double? lng}) async {
    final r = await _fn.httpsCallable('reviewMechanicApplication').call({
      'uid': uid,
      'approve': approve,
      'reason': ?reason,
      if (lat != null && lng != null) 'geo': {'lat': lat, 'lng': lng},
    });
    return (r.data as Map)['mechanicId'] as String?;
  }

  @override
  Future<List<WarrantyItem>> warranties() async {
    final q = await _db
        .collection('warranties')
        .where('uid', isEqualTo: _uid)
        .orderBy('purchasedAt', descending: true)
        .get();
    return q.docs.map((d) {
      final m = d.data();
      return WarrantyItem(
        id: d.id,
        billNo: m['billNo'] ?? '',
        productName: m['productName'] ?? '',
        brand: m['brand'] ?? '',
        serial: m['serial'],
        vehicle: m['vehicle'],
        purchasedAt: (m['purchasedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
        months: (m['months'] as num?)?.toInt() ?? 0,
      );
    }).toList();
  }

  @override
  Future<List<PurchaseInvoice>> purchaseInvoices() async {
    final q = await _db.collection('purchaseInvoices').orderBy('createdAt', descending: true).limit(100).get();
    return q.docs
        .map((d) => PurchaseInvoice.fromMap(d.id, d.data(), createdAt: (d.data()['createdAt'] as Timestamp?)?.toDate()))
        .toList();
  }

  @override
  Future<PurchaseInvoice> createPurchaseInvoice({
    required String distributor,
    required String invoiceNo,
    required List<PurchaseLine> lines,
  }) async {
    final id = purchaseInvoiceId(distributor, invoiceNo);
    final ref = _db.collection('purchaseInvoices').doc(id);
    await _db.runTransaction((tx) async {
      if ((await tx.get(ref)).exists) throw Exception('Ye invoice pehle se entered hai');
      tx.set(ref, {
        'distributor': distributor.trim(),
        'invoiceNo': invoiceNo.trim(),
        'lines': [for (final l in lines) l.toMap()],
        'received': false,
        'createdBy': _uid,
        'createdAt': FieldValue.serverTimestamp(),
      });
    });
    return PurchaseInvoice(
      id: id,
      distributor: distributor.trim(),
      invoiceNo: invoiceNo.trim(),
      lines: lines,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<void> receivePurchaseInvoice(PurchaseInvoice invoice) async {
    final ref = _db.collection('purchaseInvoices').doc(invoice.id);
    await _db.runTransaction((tx) async {
      final snap = await tx.get(ref);
      if (!snap.exists) throw Exception('Invoice nahi mila');
      if (snap.data()?['received'] == true) throw Exception('Ye invoice pehle hi inventory me add ho chuka hai');
      for (final l in invoice.lines) {
        if (l.received <= 0 && l.barcode == null) continue;
        tx.update(_db.collection('products').doc(l.productId), {
          if (l.received > 0) 'stock': FieldValue.increment(l.received),
          if (l.barcode != null) 'barcodes': FieldValue.arrayUnion([l.barcode]),
        });
      }
      tx.update(ref, {
        'lines': [for (final l in invoice.lines) l.toMap()],
        'received': true,
        'receivedBy': _uid,
        'receivedAt': FieldValue.serverTimestamp(),
      });
    });
  }
}
