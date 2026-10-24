# Content inventory (migrated from stefanstrain.github.io)

Everything real from the old al-folio/Jekyll site, with the template demo material left behind
(the 31 demo blog posts, demo news, teaching, publications, Einstein about page, sample images 1-12.jpg, demo video/audio).

## Pages on the old site

| Old page    | Source in this folder                      | Notes |
|-------------|--------------------------------------------|-------|
| About (`/`) | `content/profile.md`                       | Bio, photo, contact, socials, languages |
| Projects    | `content/projects/*.md`                    | 2 projects, long-form write-ups |
| CV          | `content/resume.json`, `public/assets/pdf/`       | JSON Resume format, plus EN and FR PDFs |
| Bookshelf   | `content/books/*.md`, `public/assets/img/book_covers/` | 13 books with ratings, dates and short reviews |

## Projects

- **3D Brain Tumour Segmentation** (`mri_segmentation.md`, ~70 KB). Five 3D segmentation architectures on BraTS2021.
  Uses images in `public/assets/img/brats_seg/` and five interactive Plotly embeds in `public/assets/html/brats_seg/`
  (model comparison, params vs Dice, radar, training curves, 3D tumour mesh).
- **OLIST E-Commerce SQL Analysis** (`olist_sql_analysis.md`, ~25 KB). PostgreSQL analytics on 100k orders.
  Uses `public/assets/img/schema_diagram.png`, `public/assets/schemas/project_04_schema.svg` and two notebooks in `public/assets/jupyter/`.

## Conversion status (2026-10-17)

- Both project pages converted: Liquid tags replaced with plain HTML (figures, notebook iframes), al-folio CSS variables
  mapped onto the theme in `src/styles/global.css`, maths rendered at build time with KaTeX (`$$...$$` only).
- Notebook sources are in `content/notebooks/`, pre-rendered with `jupyter nbconvert --to html --output-dir public/assets/jupyter content/notebooks/*.ipynb`. Re-run it if a notebook changes.
- The Plotly charts in `public/assets/html/brats_seg/` got a small script at the end that restyles them for light/dark.
  Re-adding it is needed if the charts are regenerated from Python.
- Segmentation overlays (`overlay_*.png`) are cropped to the scan, which drops the white margin and baked-in title.
  The other figures and diagrams still have white backgrounds and are dimmed in dark mode by CSS. Proper dark versions
  need the BraTS volumes again (project_08 `data/` and `cache_npy/` are empty) to rerun its `scripts/visualize_*.py`.
- Book covers converted to 600px WebP (11 MB down to well under 1 MB).

## Cleaned up during migration

- `resume.json`: removed placeholder `certificates` ("Testing University") and `publications` ("Testing publication"),
  and replaced the placeholder Twitter profile ("asd") with GitHub, LinkedIn and Kaggle.

## Inconsistencies to decide on

- **Languages:** resolved. Romanian was an al-folio leftover; now Serbo-Croatian (Native) in both files.
  English is Native everywhere.
- **Phone number** is in `resume.json` (`basics.phone`). Decide whether it should appear on a public site.
- **Job title:** the site says "Statistician & Data Scientist"; current roles lean ML Engineer / Data Engineer
  (see the Grid Pulse data-engineering project). Worth deciding the headline positioning for v2.
- Typos carried over from the old resume: "Methadology", "Pythong", "Begginner".

## Not migrated (exists only in the old repo)

- Projects that live only on GitHub and never got a page (e.g. Grid Pulse, Nemoria, bidwise).
- `stefan_style_guide.md` was copied to this folder as the writing reference.

## Languages (2026-10-17)

- English at `/`, French at `/fr/`. Content is split by language folder: `content/profile/{en,fr}.md`,
  `content/resume/{en,fr}.json`, `content/projects/{en,fr}/`, `content/books/{en,fr}/`.
  Interface text (nav, headings, buttons) lives in `src/i18n/index.ts`.
- A page missing in one language simply doesn't exist there, so keep the two folders in step when adding content.
- The Jupyter notebooks and Plotly charts stay in English on both versions.
- The Godfather was removed (its review was al-folio lorem ipsum).
- Job dates now match the CV PDFs (startup May 2025 - Jan 2026, Karmen Jul 2024 - Jan 2025, Cyceron Mar - Jul 2023).

## Added 2026-10-17 (agents)

- French Plotly charts in `public/assets/html/brats_seg/fr/` (scripts: scratchpad `plotly_fr.py`, `fr_map.py`).
  French notebooks not done yet.
- Link previews (Open Graph/Twitter), JSON-LD Person data, `public/og-default.png`, printable CV at `/cv/print/`.
- Custom domain: `public/CNAME` = stefanstrainovic.com, `robots.txt` with sitemap.
- Browser demo spike: KAN U-Net exports to ONNX fine (9.8 MB fp32), files in project_08 `outputs/onnx_spike/`.
  Needs one BraTS sample patch to build the demo.
