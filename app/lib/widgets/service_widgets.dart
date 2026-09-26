import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../data/app_state.dart';
import 'common.dart';

/// Bottom sheet listing the customer's bikes; tapping one makes it active.
Future<void> showVehicleSwitcher(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: BP.white,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (sheetContext) {
      final app = sheetContext.watch<AppState>();
      final active = app.activeVehicle;
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Choose your bike', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            for (final v in app.vehicles)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: v.id == active?.id ? BP.softYellow : BP.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(BP.radius),
                    side: BorderSide(color: v.id == active?.id ? BP.yellow : BP.border, width: 1.5),
                  ),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(BP.radius),
                    onTap: () async {
                      final nav = Navigator.of(sheetContext);
                      try {
                        await app.switchVehicle(v.id);
                      } catch (e) {
                        if (sheetContext.mounted) showMessage(sheetContext, 'Bike change nahi hua: $e');
                        return;
                      }
                      nav.pop();
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(children: [
                        Icon(v.type == 'scooter' ? Icons.electric_scooter : Icons.pedal_bike, color: BP.black),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(v.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                            Text(v.subtitle, style: const TextStyle(fontSize: 13, color: BP.grey)),
                          ]),
                        ),
                        if (v.id == active?.id) const Icon(Icons.check_circle, color: BP.black),
                      ]),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 4),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(sheetContext).pop();
                context.push('/vehicle-details');
              },
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                foregroundColor: BP.black,
                side: const BorderSide(color: BP.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(BP.radius)),
              ),
              icon: const Icon(Icons.add),
              label: const Text('Add another bike', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ]),
        ),
      );
    },
  );
}

/// Success sheet shown after a booking / quote request. Resolves when closed.
Future<void> showConfirmationSheet(
  BuildContext context, {
  required String title,
  required String message,
  String button = 'VIEW MY ORDERS',
}) {
  return showModalBottomSheet<void>(
    context: context,
    isDismissible: false,
    enableDrag: false,
    backgroundColor: BP.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(color: BP.yellow, shape: BoxShape.circle),
            child: const Icon(Icons.check_rounded, size: 40, color: BP.black),
          ),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: BP.grey, fontWeight: FontWeight.w500, height: 1.4)),
          const SizedBox(height: 24),
          PrimaryButton(label: button, onPressed: () => Navigator.of(sheetContext).pop()),
        ]),
      ),
    ),
  );
}
