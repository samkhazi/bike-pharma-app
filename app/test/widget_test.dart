import 'package:bike_pharma/core/money.dart';
import 'package:bike_pharma/data/demo_repository.dart';
import 'package:bike_pharma/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registration numbers are normalised and formatted', () {
    expect(normalizeRegNo('mh 12-ab 1234'), 'MH12AB1234');
    expect(formatRegNo('MH12AB1234'), 'MH 12 AB 1234');
  });

  test('mechanic ids are read from QR text', () {
    expect(parseMechanicId('bikepharma://mechanic/BPM-0231'), 'BPM-0231');
    expect(parseMechanicId('bpm0231'), 'BPM-0231');
    expect(parseMechanicId('hello'), isNull);
  });

  test('shop only shows parts that fit the customer bike', () {
    const shine = Vehicle(id: 'v1', brand: 'Honda', model: 'Shine 125', year: 2022);
    const pulsar = Vehicle(id: 'v2', brand: 'Bajaj', model: 'Pulsar 150', year: 2020);
    final airFilter = demoProducts.firstWhere((p) => p.id == 'p3'); // Shine only
    final helmet = demoProducts.firstWhere((p) => p.id == 'a1'); // universal
    expect(airFilter.fitsVehicle(shine), isTrue);
    expect(airFilter.fitsVehicle(pulsar), isFalse);
    expect(helmet.fitsVehicle(pulsar), isTrue);
  });

  test('delivery is free from ₹499', () {
    expect(deliveryFor(0), 0);
    expect(deliveryFor(39900), 4900);
    expect(deliveryFor(49900), 0);
  });
}
