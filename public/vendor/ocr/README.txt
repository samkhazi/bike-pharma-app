Bill photo reader (Sam 2026-10-11 18:56Z, "Phone, free" 18:59Z): the phone reads the supplier bill itself; the photo never leaves it.
Tesseract OCR for the browser, served from our own site (no outside CDN). Apache License 2.0 (LICENSE.txt).
  tesseract.min.js, worker.min.js                 npm tesseract.js 7.0.0 (dist/)
  tesseract-core-*lstm.wasm.js                     npm tesseract.js-core 7.0.0 (the reader picks the one the phone supports)
  eng.traineddata.gz                               npm @tesseract.js-data/eng 1.0.0 (4.0.0_best_int)
SHA256SUMS.txt lists every file as copied from the npm packages.
