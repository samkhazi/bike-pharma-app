import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../data/app_state.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import 'team_widgets.dart';

/// What happened to a scanned code.
enum ScanResult { counted, alreadyComplete, unknown }

/// Finds the invoice line a scanned [code] belongs to: a code already saved on
/// the line, or one saved on the line's product from an earlier invoice.
int? matchInvoiceLine(String code, List<PurchaseLine> lines, List<Product> products) {
  final c = code.trim();
  if (c.isEmpty) return null;
  for (var i = 0; i < lines.length; i++) {
    final l = lines[i];
    if (l.barcode == c) return i;
    final p = products.where((p) => p.id == l.productId).firstOrNull;
    if (p != null && p.barcodes.contains(c)) return i;
  }
  return null;
}

/// Team: the checklist for one distributor invoice. Every scan ticks a piece
/// off; "Inventory me add karo" adds only what was ticked to stock.
class ReceiveInvoiceScreen extends StatefulWidget {
  final String id;
  const ReceiveInvoiceScreen({super.key, required this.id});

  @override
  State<ReceiveInvoiceScreen> createState() => _ReceiveInvoiceScreenState();
}

class _ReceiveInvoiceScreenState extends State<ReceiveInvoiceScreen> {
  PurchaseInvoice? _inv;
  List<Product> _products = [];
  bool _loaded = false;
  bool _scanning = false;
  bool _saving = false;
  MobileScannerController? _camera;
  String? _lastCode;
  DateTime _lastAt = DateTime.fromMillisecondsSinceEpoch(0);
  final _codeCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (context.read<AppState>().isTeam) _load();
  }

  @override
  void dispose() {
    _camera?.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final repo = context.read<AppState>().repo;
      final all = await repo.purchaseInvoices();
      final products = await repo.products();
      if (!mounted) return;
      setState(() {
        _inv = all.where((i) => i.id == widget.id).firstOrNull;
        _products = products;
        _loaded = true;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _loaded = true);
        showMessage(context, 'Invoice load nahi ho paya');
      }
    }
  }

  void _setLine(int i, PurchaseLine l) {
    final inv = _inv!;
    final lines = [...inv.lines]..[i] = l;
    setState(() => _inv = inv.copyWith(lines: lines));
  }

  void _bump(int i, int by) {
    final l = _inv!.lines[i];
    final next = (l.received + by).clamp(0, l.qty);
    _setLine(i, l.copyWith(received: next));
  }

  /// Handles one scanned (or typed) code.
  Future<ScanResult> _onCode(String raw) async {
    final code = raw.trim();
    var i = matchInvoiceLine(code, _inv!.lines, _products);
    if (i == null) {
      i = await _askWhichPart(code);
      if (i == null || !mounted) return ScanResult.unknown;
      _setLine(i, _inv!.lines[i].copyWith(barcode: code));
    }
    final l = _inv!.lines[i];
    if (l.received >= l.qty) {
      showMessage(context, '${l.name}: invoice me sirf ${l.qty} hain, ye extra hai');
      return ScanResult.alreadyComplete;
    }
    _setLine(i, l.copyWith(received: l.received + 1, barcode: l.barcode ?? code));
    showMessage(context, '${l.name}  ${l.received + 1}/${l.qty}');
    return ScanResult.counted;
  }

  Future<int?> _askWhichPart(String code) {
    final lines = _inv!.lines;
    return showDialog<int>(
      context: context,
      builder: (_) => SimpleDialog(
        title: const Text('Naya code, ye kaunsa part hai?'),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
            child: Text(code, style: const TextStyle(color: BP.grey, fontSize: 13)),
          ),
          for (var i = 0; i < lines.length; i++)
            if (!lines[i].done)
              SimpleDialogOption(
                key: Key('assign-$i'),
                onPressed: () => Navigator.pop(context, i),
                child: Text(lines[i].name),
              ),
          SimpleDialogOption(onPressed: () => Navigator.pop(context), child: const Text('Invoice me nahi hai / cancel')),
        ],
      ),
    );
  }

  void _onDetect(BarcodeCapture capture) {
    final raw = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
    if (raw == null) return;
    final now = DateTime.now();
    // The camera sees the same code many times a second.
    if (raw == _lastCode && now.difference(_lastAt) < const Duration(seconds: 2)) return;
    _lastCode = raw;
    _lastAt = now;
    _onCode(raw);
  }

  void _toggleScanner() {
    setState(() {
      _scanning = !_scanning;
      if (_scanning) {
        _camera = MobileScannerController();
      } else {
        _camera?.dispose();
        _camera = null;
      }
    });
  }

  Future<void> _submitTyped() async {
    final text = _codeCtrl.text;
    if (text.trim().isEmpty) return;
    _codeCtrl.clear();
    await _onCode(text);
  }

  Future<void> _finish() async {
    final inv = _inv!;
    final missing = inv.missingQty;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Inventory me add karo?'),
        content: Text(
          '${inv.totalReceived} pieces stock me judenge.'
          '${missing > 0 ? '\n$missing pieces scan nahi hue, wo add nahi honge (distributor se check karo).' : ''}',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Wapas')),
          FilledButton(key: const Key('confirmReceive'), onPressed: () => Navigator.pop(context, true), child: const Text('Add karo')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _saving = true);
    try {
      await context.read<AppState>().repo.receivePurchaseInvoice(inv);
      if (!mounted) return;
      showMessage(context, '${inv.totalReceived} pieces inventory me add ho gaye');
      setState(() {
        _saving = false;
        _scanning = false;
        _camera?.dispose();
        _camera = null;
        _inv = inv.copyWith(received: true);
      });
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showMessage(context, e.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!context.watch<AppState>().isTeam) {
      return const AccessDenied(title: 'Invoice check', message: 'Ye screen sirf Bike Pharma team ke liye hai.');
    }
    final inv = _inv;
    if (inv == null) {
      return Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              const PageHeader(title: 'Invoice check'),
              Expanded(
                child: Center(
                  child: _loaded ? const Text('Invoice nahi mila', style: TextStyle(color: BP.grey)) : const CircularProgressIndicator(color: BP.black),
                ),
              ),
            ],
          ),
        ),
      );
    }
    final open = !inv.received;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: '${inv.distributor} · ${inv.invoiceNo}',
              subtitle: '${inv.totalReceived}/${inv.totalQty} pieces ${inv.received ? 'inventory me add' : 'scan hue'}',
            ),
            if (open) ...[
              if (_scanning && _camera != null)
                SizedBox(
                  height: 200,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(BP.radius),
                    child: MobileScanner(controller: _camera!, onDetect: _onDetect),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        key: const Key('codeInput'),
                        controller: _codeCtrl,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _submitTyped(),
                        decoration: const InputDecoration(
                          hintText: 'Code type karo ya scanner se scan karo',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      key: const Key('toggleScanner'),
                      style: IconButton.styleFrom(backgroundColor: BP.yellow, foregroundColor: BP.black),
                      tooltip: _scanning ? 'Camera band karo' : 'Camera se scan karo',
                      icon: Icon(_scanning ? Icons.videocam_off_outlined : Icons.qr_code_scanner),
                      onPressed: _toggleScanner,
                    ),
                  ],
                ),
              ),
            ],
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                children: [
                  for (var i = 0; i < inv.lines.length; i++) _LineTile(inv.lines[i], index: i, open: open, onBump: _bump),
                ],
              ),
            ),
            if (open)
              BottomAction(
                child: PrimaryButton(
                  key: const Key('receiveInvoice'),
                  label: 'Inventory me add karo (${inv.totalReceived})',
                  loading: _saving,
                  onPressed: inv.totalReceived == 0 ? null : _finish,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LineTile extends StatelessWidget {
  final PurchaseLine line;
  final int index;
  final bool open;
  final void Function(int index, int by) onBump;
  const _LineTile(this.line, {required this.index, required this.open, required this.onBump});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: line.done ? BP.softYellow : BP.white,
        border: Border.all(color: BP.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListTile(
        key: Key('check-$index'),
        leading: Icon(
          line.done ? Icons.check_circle : Icons.radio_button_unchecked,
          color: line.done ? Colors.green : BP.grey,
        ),
        title: Text(line.name, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text('${line.received}/${line.qty}${line.barcode == null ? '' : ' · ${line.barcode}'}'),
        trailing: open
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    key: Key('minus-$index'),
                    icon: const Icon(Icons.remove_circle_outline),
                    onPressed: line.received > 0 ? () => onBump(index, -1) : null,
                  ),
                  IconButton(
                    key: Key('plus-$index'),
                    icon: const Icon(Icons.add_circle_outline),
                    onPressed: line.done ? null : () => onBump(index, 1),
                  ),
                ],
              )
            : null,
      ),
    );
  }
}
