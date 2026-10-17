# Brand catalogues from Sam's package (update 7, 2026-10-11)
`python3 -I brands_build.py <out dir> hero re yamaha honda tvs` writes cat/<slug>.json + <slug>-dg.json for the server build
(copy them to the scratchpad's brands/out/, then `python3 tools/build_public.py --no-cat` picks them up).
Inputs (src.py): the brand CSVs / DATA zips staged from Sam's Mac (All Catalogues/BikeSurgeon_Catalog_Import) and
the zip indexes made on his Mac (website-server/catalogue-index/*.idx.json: [entry, method, data offset, csize, size, crc32]).
Hero / RE model rules come from designs/prototype-build/bj/hr_pkg_build.py. Diagram + photo links are 'pf:<dir>/<zip>:<offset>:<length>'
into the stored (method 0) zips, read by the server's /api/files/read. brtest.mjs = Playwright check (PASS=1 lists the byte ranges
the screens ask for, PASS=2 expects them filled into same-size test zips).

## Bajaj (update 7b)
`python3 -I bj_pages.py <folder with the PDFs as pdfs/...> <bajaj_parts.csv> bajaj-pages.json` (needs pymupdf) finds each plate's page
and crop in the 90 PDFs (layouts modern / old 2-up / code / scan) and fixes the CSV's plate of each line on the old 2-plate pages;
then `brands_build.py <out> bajaj` (BJ_BOOKS = model, norm, qualifier and date of each book; twins and repeats in BJ_SAME).
Diagram links are 'pdf:catalogues/bajaj/bajaj_spc_pdfs.zip:<pdf data offset>:<pdf length>:<page, 1-based>:<x0>,<y0>,<x1>,<y1>'
(fractions of the page as shown). The app draws them with pdf.js 3.11.174 legacy (public/vendor/pdfjs in the GitHub repo,
sha512 in its README.txt) through range reads, at min(5, sqrt(14e6 / crop area)) px per point. Check: tools/test_bajaj.mjs
(BOOKS = offsets of books in a test zip) + tools/bajaj_cmp.py (compares with MuPDF's drawing of the same page).

## Suzuki (update 7c)
`python3 -I sz_parse.py "<All Catalogues/Suzuki>" suzuki-pages.json` (needs pymupdf) reads each text book's parts tables by word
position (REF / PART NO. / DESCRIPTION / QTY / REMARKS columns; the dealer's slanted watermark is left out) and the price list
03-Oct'26.pdf (12,211 part no.: name, model code, MRP). Same-content copies are read once. Then `brands_build.py <out> suzuki`:
SZ_BOOKS = model, code and years of each book; SZ_OCR = the two old books whose text layer is OCR and the 5 scanned books
(titles and words fixed against the clean books' words). Price-list parts that no book has go to their model by
the MODEL code (SZ_FAMILY rules, 'Other models' for the rest) as '<model> · more parts (price list)' editions, grouped by the
part number's first two digits (SZ_PL), no diagram. Diagram links: 'pdf:catalogues/suzuki/<book>:0:<size>:<page>:0,0,1,1'
(the whole page). Check: tools/test_suzuki.mjs (uploads the folder through Admin > Catalogue files, draws 2 pages per book)
+ tools/bajaj_cmp.py <FILES_DIR> <OUT>.

## Suzuki scanned books (update 7d)
The 5 books that are only pictures (GS150R K9/L0 and L3, Gixxer SF 2017, Slingshot 2013, Swish 125 2016):
`python3 -I ocr_book.py <book.pdf> <out.ocr.json>` reads every page with RapidOCR (pip rapidocr-onnxruntime, 300 dpi; ~5 s a page),
then `python3 -I sz_ocr.py suzuki-pages.json "<All Catalogues/Suzuki>" <book>=<out.ocr.json> ...` puts the boxes in rows and reads
the tables with sz_parse's column rules. REF / QTY digits the OCR missed are read from the book's own printed digits (class Glyphs:
the cells the OCR did read give each digit's picture; a mark must match one digit at >= 0.85 and 0.1 better than any other),
checked against the OCR's recogniser on 3,789 cells: all the same except 6 where the recogniser read 7 as 1. Then
`brands_build.py <out> suzuki` as above (SzNear puts right a name the OCR lost a letter in, sz_rem splits FORYVBJBANEWPN...).

## TVS extras (update 7d)
tvs_extra() adds Sam's tvs_painted_parts.csv (each colour of each model as its own section, diagram from tvs_images.zip),
tvs_kit_parts.csv (kit part no. with MRP, then the parts in it as K<n>.<j>) and tvs_oils_lubricants.csv (model 'Oils & lubricants',
which the customer's bike list leaves out).

## TVS ALL (update 8f)
`python3 -I tvs_parse.py "<All Catalogues/TVS ALL>" tvs-pages.json` (needs pymupdf) reads TVS's own PDF parts books and colour lists
(table columns from the lines TVS drew, words placed by position; white-boxed old numbers are not read). Then `brands_build.py <out> tvs`:
tvs() ends with tvs_books(o, dg), which adds TVS_BOOKS (17 books: model, edition label, columns) after every e-catalogue entry, unchanged.
TVS_SPARE = the 32 books whose parts are already in the e-catalogue (or copies of another book); the upload card leaves them on the computer.
Diagram links: 'pdf:catalogues/tvs/<book>:0:<size>:<page>:0,0,1,1'. MRP only from the existing MRP table (new numbers have none).
Check: tools/test_tvs.mjs (uploads the folder through Admin > Catalogue files with only tvs_images.zip on the server, draws 2 pages per book).

## Royal Enfield diagram books (update 9h)
Sam's folder Downloads > Royal-Enfield-Catalogue > Models (16 Oct 2026, made from spares.royalenfield.com): one '<edition> - Diagrams[ - Part n of m].pdf'
per edition (151 books, 142 editions, 1.6 GB), vector diagrams with each item's part no., MRP, UOM, MOQ and note. On the Mac:
`pdftotext -layout` of each book into '<folder>@<file>.txt' + _sizes.tsv, then `python3 -I re_parse.py <txt dir> re-pages.json`
(a table going on into the next Part file belongs to the last diagram before it; 'n of N variants' from each book's index pages).
`brands_build.py <out> re` replaces the RE package's data: models by hr_pkg_build's RE_RULES (+ FF.C6 = Flying Flea C6), the edition's year
from the package's edition of the same name, MRP from the books, then RE_MRP_PriceList_2026-10.xlsx; price-list parts no book has go to
model 'Other parts (price list)' (a section per first letter, no diagram). Part photos stay in RE_Upload_Package_IMAGES_part2.zip.
Diagram links: 'pdf:catalogues/royal-enfield/<book>:0:<size>:<page>:0,0,1,1'. Check: tools/test_re.mjs.
