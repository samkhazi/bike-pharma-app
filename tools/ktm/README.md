# KTM + Husqvarna catalogue (11 Oct 2026, from Sam's 97 HD PDFs "All Catalogue/KTM/KTM_PDF_HD_All_Years")
1. `python3 -I ktm_parse.py <pdf dir> parsed.json` reads every PDF: assembly pages, table rows (by the drawn row bands),
   and the byte place of each diagram (an ASCII85 JPEG stream inside the PDF). parsed.json here is that output.
2. `python3 -I ktm_build.py parsed.json out` writes out/ktm.json, husqvarna.json (app rows merged across model years)
   and out/<slug>-dg.json (diagram links `pa:catalogues/ktm/<pdf>:<offset>:<length>`, the files the server needs, spare PDFs).
3. `python3 -I ktm_verify.py <pdf dir> parsed.json out` checks every model year's every diagram decodes to that year's own JPEG.
The JSON ships in GitHub `website` branch public/cat/; the PDFs go to the server through Admin > More > Catalogue files.
p2_ktm.py / p3_ktm.py = the app patches (already in ../../src/app.html).
