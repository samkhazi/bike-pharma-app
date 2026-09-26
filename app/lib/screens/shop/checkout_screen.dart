import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../data/repository.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

enum _Pay { upi, card, cod }

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _phone;
  final _line1 = TextEditingController();
  final _line2 = TextEditingController();
  final _city = TextEditingController();
  final _pincode = TextEditingController();
  _Pay _pay = _Pay.cod;
  bool _placing = false;

  @override
  void initState() {
    super.initState();
    final state = context.read<AppState>();
    final phone = (state.profile?.phone.isNotEmpty ?? false) ? state.profile!.phone : state.phone;
    _name = TextEditingController(text: state.profile?.name ?? '');
    _phone = TextEditingController(text: _tenDigits(phone));
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _line1, _line2, _city, _pincode]) {
      c.dispose();
    }
    super.dispose();
  }

  static String _tenDigits(String raw) {
    final d = raw.replaceAll(RegExp(r'\D'), '');
    return d.length > 10 ? d.substring(d.length - 10) : d;
  }

  Future<void> _placeOrder() async {
    final state = context.read<AppState>();
    if (state.cartLines.isEmpty) {
      showMessage(context, 'Your cart is empty');
      return;
    }
    if (!_form.currentState!.validate()) {
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _placing = true);
    try {
      final address = Address(
        name: _name.text.trim(),
        phone: _phone.text.trim(),
        line1: _line1.text.trim(),
        line2: _line2.text.trim().isEmpty ? null : _line2.text.trim(),
        city: _city.text.trim(),
        pincode: _pincode.text.trim(),
      );
      final online = _pay != _Pay.cod;
      final placed = await state.checkout(address, online ? 'razorpay' : 'cod');
      if (!mounted) return;

      if (online) {
        // TODO(razorpay): add the razorpay_flutter package and open checkout here:
        //   final rz = Razorpay();
        //   rz.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse r) async {
        //     await state.repo.verifyPayment(
        //       orderId: placed.orderId,
        //       paymentId: r.paymentId!,
        //       signature: r.signature!,
        //     );
        //   });
        //   rz.open({
        //     'key': placed.razorpayKeyId,
        //     'order_id': placed.razorpayOrderId,
        //     'amount': placed.total,
        //     'name': 'Bike Pharma',
        //     'prefill': {'contact': address.phone, 'method': _pay == _Pay.upi ? 'upi' : 'card'},
        //   });
        // Until then the order stays "pending_payment" and we only show it was created.
      }
      setState(() => _placing = false);
      await _showSuccess(placed, online);
      if (mounted) context.go('/orders');
    } catch (e) {
      if (mounted) showMessage(context, 'Order failed: $e');
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  Future<void> _showSuccess(PlacedOrder placed, bool online) => showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => Dialog(
          backgroundColor: BP.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(color: BP.yellow, shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded, size: 40, color: BP.black),
              ),
              const SizedBox(height: 16),
              Text(online ? 'Order created!' : 'Order placed!',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text('Order ID: ${placed.orderId}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(
                online ? 'Amount: ${rupees(placed.total)}' : 'Pay ${rupees(placed.total)} cash on delivery',
                style: const TextStyle(fontSize: 14, color: BP.grey, fontWeight: FontWeight.w500),
              ),
              if (online) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: BP.softYellow, borderRadius: BorderRadius.circular(12)),
                  child: const Text(
                    'Online payment will open here once Razorpay keys are added',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              PrimaryButton(label: 'VIEW MY ORDERS', onPressed: () => Navigator.of(ctx).pop()),
            ]),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final lines = state.cartLines;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          const PageHeader(title: 'Checkout'),
          Expanded(
            child: Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  const _Heading('Delivery address'),
                  _Field(controller: _name, label: 'Full name', validator: _required('Enter your name')),
                  _Field(
                    controller: _phone,
                    label: 'Mobile number',
                    prefix: '+91 ',
                    keyboard: TextInputType.phone,
                    formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
                    validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v?.trim() ?? '')
                        ? null
                        : 'Enter a valid 10-digit mobile number',
                  ),
                  _Field(
                    controller: _line1,
                    label: 'House no, building, street',
                    validator: _required('Enter house no and street'),
                  ),
                  _Field(controller: _line2, label: 'Area, landmark (optional)'),
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: _Field(controller: _city, label: 'City', validator: _required('Enter city')),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _Field(
                        controller: _pincode,
                        label: 'Pincode',
                        keyboard: TextInputType.number,
                        formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                        validator: (v) => RegExp(r'^[1-9]\d{5}$').hasMatch(v?.trim() ?? '')
                            ? null
                            : 'Enter 6-digit pincode',
                      ),
                    ),
                  ]),
                  const SizedBox(height: 8),
                  const _Heading('Payment'),
                  _PayOption(
                    label: 'UPI (GPay, PhonePe, Paytm)',
                    icon: Icons.account_balance_wallet_outlined,
                    selected: _pay == _Pay.upi,
                    onTap: () => setState(() => _pay = _Pay.upi),
                  ),
                  _PayOption(
                    label: 'Debit / Credit card',
                    icon: Icons.credit_card,
                    selected: _pay == _Pay.card,
                    onTap: () => setState(() => _pay = _Pay.card),
                  ),
                  _PayOption(
                    label: 'Cash on delivery',
                    icon: Icons.payments_outlined,
                    selected: _pay == _Pay.cod,
                    onTap: () => setState(() => _pay = _Pay.cod),
                  ),
                  if (_pay != _Pay.cod)
                    const Padding(
                      padding: EdgeInsets.only(top: 2, bottom: 8),
                      child: Text('Online payment will open here once Razorpay keys are added',
                          style: TextStyle(fontSize: 12, color: Color(0xFF8A6A00), fontWeight: FontWeight.w600)),
                    ),
                  const SizedBox(height: 12),
                  const _Heading('Order summary'),
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    decoration: BoxDecoration(color: BP.surface, borderRadius: BorderRadius.circular(16)),
                    child: Column(children: [
                      for (final l in lines)
                        _SummaryRow('${l.product.name} × ${l.qty}', rupees(l.total)),
                      const Divider(height: 18, color: BP.border),
                      _SummaryRow('Item total', rupees(state.cartSubtotal)),
                      _SummaryRow('Delivery fee', state.cartDelivery == 0 ? 'FREE' : rupees(state.cartDelivery)),
                      _SummaryRow('To pay', rupees(state.cartTotal), bold: true),
                    ]),
                  ),
                ],
              ),
            ),
          ),
          BottomAction(
            child: Row(children: [
              Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('To pay', style: TextStyle(fontSize: 13, color: BP.grey, fontWeight: FontWeight.w500)),
                Text(rupees(state.cartTotal), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              ]),
              const SizedBox(width: 16),
              Expanded(
                child: PrimaryButton(
                  label: 'PLACE ORDER',
                  arrow: false,
                  loading: _placing,
                  onPressed: lines.isEmpty ? null : _placeOrder,
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  static FormFieldValidator<String> _required(String msg) => (v) => (v?.trim().isEmpty ?? true) ? msg : null;
}

class _Heading extends StatelessWidget {
  final String text;
  const _Heading(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 12),
        child: Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
      );
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String? prefix;
  final TextInputType? keyboard;
  final List<TextInputFormatter>? formatters;
  final FormFieldValidator<String>? validator;
  const _Field({
    required this.controller,
    required this.label,
    this.prefix,
    this.keyboard,
    this.formatters,
    this.validator,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(
          controller: controller,
          keyboardType: keyboard,
          inputFormatters: formatters,
          validator: validator,
          textInputAction: TextInputAction.next,
          textCapitalization: keyboard == null ? TextCapitalization.words : TextCapitalization.none,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            labelText: label,
            prefixText: prefix,
            labelStyle: const TextStyle(color: BP.grey, fontWeight: FontWeight.w500),
          ),
        ),
      );
}

class _PayOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _PayOption({required this.label, required this.icon, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Material(
          color: BP.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: selected ? BP.yellow : BP.border, width: selected ? 1.5 : 1),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Row(children: [
                Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                    color: selected ? BP.black : const Color(0xFFB0B0AA)),
                const SizedBox(width: 12),
                Expanded(child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700))),
                Icon(icon, size: 20, color: BP.grey),
              ]),
            ),
          ),
        ),
      );
}

class _SummaryRow extends StatelessWidget {
  final String label, value;
  final bool bold;
  const _SummaryRow(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          Expanded(
            child: Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: bold ? 16 : 14,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
                    color: bold ? BP.black : BP.grey)),
          ),
          Text(value, style: TextStyle(fontSize: bold ? 16 : 14, fontWeight: FontWeight.w800)),
        ]),
      );
}
