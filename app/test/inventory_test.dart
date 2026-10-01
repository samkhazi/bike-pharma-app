import 'package:bike_pharma/data/app_state.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/models/models.dart';
import 'package:bike_pharma/screens/team/receive_invoice_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

Future<void> _asTeam(DemoRepository repo) async {
  await repo.sendOtp(demoTeamPhone);
  await repo.verifyOtp('123456');
}

void main() {
  test('same distributor + invoice number gives the same id', () {
    expect(purchaseInvoiceId('Sharma Auto', 'INV/101'), purchaseInvoiceId(' sharma auto ', 'inv-101'));
  });

  test('matchInvoiceLine uses the line code, then the product codes', () {
    const lines = [
      PurchaseLine(productId: 'p1', name: 'Brake Pad Set', qty: 2, barcode: 'AAA'),
      PurchaseLine(productId: 'p2', name: 'Engine Oil', qty: 1),
    ];
    final products = [
      demoProducts[1].withReceived(0, barcode: 'OIL-1'),
    ];
    expect(matchInvoiceLine('AAA', lines, products), 0);
    expect(matchInvoiceLine(' OIL-1 ', lines, products), 1);
    expect(matchInvoiceLine('ZZZ', lines, products), isNull);
    expect(matchInvoiceLine('', lines, products), isNull);
  });

  test('receiving adds only the ticked pieces to stock, once', () async {
    final repo = DemoRepository();
    await _asTeam(repo);
    final before = (await repo.product('p1'))!.stock;
    final inv = await repo.createPurchaseInvoice(
      distributor: 'Sharma Auto',
      invoiceNo: 'INV-101',
      lines: const [PurchaseLine(productId: 'p1', name: 'Brake Pad Set', qty: 5)],
    );
    await expectLater(
      repo.createPurchaseInvoice(distributor: 'sharma auto', invoiceNo: 'inv-101', lines: inv.lines),
      throwsException,
    );

    final ticked = inv.copyWith(lines: [inv.lines.first.copyWith(received: 3, barcode: 'BP-123')]);
    await repo.receivePurchaseInvoice(ticked);
    final p = (await repo.product('p1'))!;
    expect(p.stock, before + 3);
    expect(p.barcodes, contains('BP-123'));
    expect((await repo.purchaseInvoices()).single.received, isTrue);
    await expectLater(repo.receivePurchaseInvoice(ticked), throwsException);
    expect((await repo.product('p1'))!.stock, before + 3);
  });

  testWidgets('scanning ticks parts off and the confirm adds them to stock', (tester) async {
    tester.view.physicalSize = const Size(720, 3000);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final repo = DemoRepository();
    final app = AppState(repo);
    late PurchaseInvoice inv;
    await tester.runAsync(() async {
      await _asTeam(repo);
      await app.loadSession();
      inv = await repo.createPurchaseInvoice(
        distributor: 'Sharma Auto',
        invoiceNo: 'INV-7',
        lines: const [
          PurchaseLine(productId: 'p1', name: 'Brake Pad Set', qty: 2),
          PurchaseLine(productId: 'p2', name: 'Engine Oil 10W-30 (1L)', qty: 1),
        ],
      );
    });
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: app,
        child: MaterialApp(home: ReceiveInvoiceScreen(id: inv.id)),
      ),
    );
    await tester.runAsync(() => Future.delayed(const Duration(milliseconds: 800)));
    await tester.pumpAndSettle();
    expect(find.text('0/2'), findsOneWidget);

    // A new code asks which part it is, then counts it.
    await tester.enterText(find.byKey(const Key('codeInput')), 'BP-1');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('assign-0')));
    await tester.pumpAndSettle();
    expect(find.textContaining('1/2'), findsWidgets);

    // The same code is now recognised and ticks the next piece.
    await tester.enterText(find.byKey(const Key('codeInput')), 'BP-1');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(find.textContaining('2/2'), findsWidgets);

    // The oil is ticked by hand (no code).
    await tester.tap(find.byKey(const Key('plus-1')));
    await tester.pumpAndSettle();

    final before = (await tester.runAsync(() => repo.product('p1')))!.stock;
    await tester.tap(find.byKey(const Key('receiveInvoice')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('confirmReceive')));
    await tester.runAsync(() => Future.delayed(const Duration(milliseconds: 800)));
    await tester.pumpAndSettle();

    expect((await tester.runAsync(() => repo.product('p1')))!.stock, before + 2);
    expect(find.byKey(const Key('receiveInvoice')), findsNothing);
  });
}
