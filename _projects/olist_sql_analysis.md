---
layout: page
title: OLIST E-Commerce SQL Analysis
description: SQL analytics on 100k real Brazilian e-commerce orders, then the PostgreSQL-specific techniques behind them. Two notebooks, PostgreSQL 15.
img: assets/img/schema_diagram.png
importance: 2
category: analytics
related_publications: false
tags: [PostgreSQL, SQL, Python, Data Analysis]
---

## TL;DR

Repeat purchase rate is 3%. Health and Beauty outperforms electronics. Delivery time is the strongest predictor of review score, and the bottleneck is the carrier, not the seller. Sao Paulo accounts for ~40% of revenue while northern states pay 30-40% freight premiums. 

Those findings are only half of it. I came back to the project later to write the second notebook properly, working through the PostgreSQL internals and benchmarking each query (warm cache, 50 runs, median, Mann-Whitney). Running each query that many times showed most of the indexing advice did nothing on this schema, the one real win being a covering index that cut buffer reads about 140×. A few things are still unfinished, and they are the kind of thing I will come back to.

<a href="https://github.com/StefanStrain/project_04_sql-analysis" target="_blank" style="display:inline-flex; align-items:center; gap:8px; margin-top:0.75rem; padding:10px 24px; border-radius:6px; font-size:0.97em; font-weight:600; background:var(--global-theme-color); color:#fff; text-decoration:none; letter-spacing:0.01em; box-shadow:0 2px 8px rgba(0,0,0,0.18);"><svg height="18" width="18" viewBox="0 0 16 16" style="fill:currentColor;flex-shrink:0;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>View on GitHub</a>

## The project

I built this to get better at SQL. [OLIST](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) is a Brazilian marketplace, similar to Amazon, with a dataset published on Kaggle that has enough tables and relationships to make the queries genuinely interesting, and enough rows that performance starts to matter. The goal wasn't just to get answers from the data. It was to work through increasingly complex SQL patterns, understand why they work, and build up a set of techniques I'd actually use again.

The dataset covers ~100k real orders placed between 2016 and 2018 across 11 tables. Customers, sellers, and products are the core entities, `orders` is the central fact table, and `order_items`, `order_payments`, and `order_reviews` carry the transaction detail.

## What stood out

A few results that were actually surprising. This is a selection, the full set is in the notebooks below.

**From the analysis**

- **Repeat purchase rate is around 3%.** Almost every order comes from a first-time buyer. I expected something closer to the 20-30% that's typical for e-commerce. The cohort analysis confirms it isn't a temporary dip. It's consistent across every acquisition month, and retention is the biggest lever in the data by a wide margin. *(practice notebook, §5 and §10)*
- **Health & Beauty leads revenue, not electronics.** I assumed computers or phones would dominate. They don't, and it isn't close. H&B is a consumable category, so customers *should* come back, which makes a 3% repeat rate in a replenishment-heavy catalogue a contradiction worth understanding. *(practice notebook, §6)*
- **Delivery time predicts review score more cleanly than anything else.** Orders delivered in 0-3 days average 4.46 stars. Orders taking 22+ days average 3.01. The less obvious finding is that the bottleneck sits with the carrier (~9.3 days in transit) rather than the seller (~2.8 days to dispatch). Telling sellers to ship faster is the wrong fix. *(practice notebook, §7)*
- **Sao Paulo accounts for roughly 40% of revenue.** Customers in northern states (AM, PA, RR) face freight costs of 30-40% of item price because nearly all sellers are based in SP. They pay more and wait longer. It's a supply-side problem as much as a demand-side one. *(practice notebook, §4)*
- **At Risk customers are a R$5.7M re-engagement opportunity.** The RFM segmentation flags 23,572 customers as At Risk, which is R$5.7M of revenue from people who have already bought here once. Winning them back is cheaper than finding someone new, and the data to identify them already exists. *(practice notebook, §9)*

**From the optimisation work**

- **A covering index cut buffer reads about 140×.** Once the query asked only for the two columns the index carries, Postgres switched to an `Index Only Scan` with `Heap Fetches: 0` and never touched the main table. Buffer reads dropped from 104,762 to 746, and unlike raw timings that ratio holds rock solid on every run. *(techniques notebook, §11)*
- **Most of the textbook indexing advice did nothing on this schema.** Benchmarked properly (warm cache, 50 runs, median, Mann-Whitney), the foreign-key index and the expression index both left the query plan unchanged. The lesson was that buffer counts, not p-values, tell you whether an index is actually doing any work. *(techniques notebook, §11)*

## Schema

11 tables. `orders` sits at the centre, linking customers to the items they bought, the payments they made, and the reviews they left. Each `order_item` ties an order to a specific product and seller, while customers and sellers connect out to geolocation via Brazilian zip-code prefixes. This star-like layout (transactional fact tables surrounded by descriptive dimensions) is what makes the dataset well suited to the joins, aggregations, and window functions used throughout.

<div id="schema-zoom-wrapper" style="position: relative; width: 100%; height: 600px;">
  <div id="schema-zoom-container" style="width: 100%; height: 100%; border: 1px solid var(--global-divider-color); border-radius: 6px; overflow: hidden; background: var(--global-bg-color);">
    <!-- inline SVG injected by script below -->
  </div>
  <div id="schema-zoom-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.35); color: #fff; font-weight: 500; cursor: pointer; border-radius: 6px; user-select: none; transition: opacity 0.15s;">
    Click to interact (scroll to zoom, drag to pan, double-click to reset)
  </div>
</div>
<p class="text-muted" style="font-size: 0.85em; margin-top: 0.4em;">
  Click outside the diagram or press <kbd>Esc</kbd> to release.
</p>
<p class="text-muted" style="font-size: 0.85em; margin-top: 0.4em;">
  The diagram shows a small <code>geolocation_zip_prefixes</code> node. That one is a reference key for the shared zip-code prefix, not a base table, which is why the count is 11 tables and not 12.
</p>

<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
<script>
  (function () {
    var wrapper = document.getElementById('schema-zoom-wrapper');
    var container = document.getElementById('schema-zoom-container');
    var overlay = document.getElementById('schema-zoom-overlay');
    var pz = null;
    var active = false;

    function setActive(on) {
      if (!pz) return;
      active = on;
      if (on) {
        pz.enableZoom(); pz.enablePan(); pz.enableControlIcons();
        overlay.style.display = 'none';
      } else {
        pz.disableZoom(); pz.disablePan(); pz.disableControlIcons();
        overlay.style.display = 'flex';
      }
    }

    fetch("{{ '/assets/schemas/project_04_schema.svg' | relative_url }}")
      .then(function (r) {
        if (!r.ok) throw new Error('schema svg ' + r.status);
        return r.text();
      })
      .then(function (svgText) {
        // never inject a non-SVG response (e.g. a 404 page, which can carry a
        // meta-refresh that would hijack this page) into the container
        if (svgText.indexOf('<svg') === -1) return;
        container.innerHTML = svgText;
        var svg = container.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('id', 'schema-zoom-svg');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.background = 'transparent';
        pz = svgPanZoom(svg, {
          zoomEnabled: false,
          panEnabled: false,
          controlIconsEnabled: false,
          fit: true,
          center: true,
          minZoom: 0.5,
          maxZoom: 20,
          dblClickZoomEnabled: false
        });
        container.addEventListener('dblclick', function () {
          if (!active) return;
          pz.resetZoom(); pz.center(); pz.fit();
        });
      })
      .catch(function () {
        // schema failed to load: leave the placeholder container in place
      });

    overlay.addEventListener('click', function () { setActive(true); });
    document.addEventListener('click', function (e) {
      if (active && !wrapper.contains(e.target)) setActive(false);
    });
    document.addEventListener('keydown', function (e) {
      if (active && e.key === 'Escape') setActive(false);
    });
  })();
</script>

---

## The notebooks

The project is split across two notebooks. The first is the practice run through the analysis. The second is where I slowed down and worked through the PostgreSQL-specific techniques and query optimisation properly. **Both are collapsed below. Click a bar to expand it.**

<style>
  .nb-collapse {
    border: 1px solid var(--global-divider-color);
    border-radius: 8px;
    margin: 1.25rem 0;
    overflow: hidden;
    background: var(--global-bg-color);
  }
  .nb-collapse > summary {
    list-style: none;
    cursor: pointer;
    padding: 1rem 1.25rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.9rem;
    background: var(--global-card-bg-color, var(--global-bg-color));
    border-left: 4px solid var(--global-theme-color);
    transition: background 0.15s ease;
  }
  .nb-collapse > summary::-webkit-details-marker { display: none; }
  .nb-collapse > summary:hover { background: var(--global-hover-color); }
  .nb-collapse .nb-chevron {
    font-size: 0.85em;
    color: var(--global-theme-color);
    transition: transform 0.2s ease;
    transform: rotate(0deg);
  }
  .nb-collapse[open] .nb-chevron { transform: rotate(90deg); }
  .nb-collapse .nb-titles { min-width: 0; }
  .nb-collapse .nb-title {
    font-weight: 700;
    color: var(--global-text-color);
    line-height: 1.3;
  }
  .nb-collapse .nb-sub {
    font-size: 0.85em;
    color: var(--global-text-color-light, #888);
    margin-top: 0.15rem;
  }
  .nb-collapse .nb-cta {
    white-space: nowrap;
    font-size: 0.8em;
    font-weight: 600;
    color: var(--global-theme-color);
    border: 1px solid var(--global-theme-color);
    border-radius: 999px;
    padding: 0.25rem 0.7rem;
  }
  .nb-collapse[open] .nb-cta-open { display: none; }
  .nb-collapse:not([open]) .nb-cta-close { display: none; }
  .nb-collapse .nb-body { padding: 0.5rem 0.75rem 0.75rem; }
  /* avoid a white flash before the notebook paints / themes itself */
  .nb-collapse iframe { background: var(--global-bg-color); }
</style>

<details class="nb-collapse">
  <summary>
    <span class="nb-chevron">▶</span>
    <span class="nb-titles">
      <span class="nb-title">Practice Notebook - Core Analysis</span>
      <span class="nb-sub">Revenue growth, geographic performance, customer behaviour, RFM segmentation, cohort retention, plus a Part 2 on SQL techniques.</span>
    </span>
    <span class="nb-cta nb-cta-open">Click to expand ▼</span>
    <span class="nb-cta nb-cta-close">Click to collapse ▲</span>
  </summary>
  <div class="nb-body">
    {% assign practice_path = 'assets/jupyter/sql_practice_notebook.ipynb' | relative_url %}
    {% capture practice_exists %}{% file_exists assets/jupyter/sql_practice_notebook.ipynb %}{% endcapture %}
    {% if practice_exists == 'true' %}
      {% jupyter_notebook practice_path %}
    {% else %}
      <p><em>Sorry, the notebook you are looking for does not exist.</em></p>
    {% endif %}
  </div>
</details>

<details class="nb-collapse">
  <summary>
    <span class="nb-chevron">▶</span>
    <span class="nb-titles">
      <span class="nb-title">Techniques &amp; Optimisation</span>
      <span class="nb-sub">Index case studies (EXPLAIN ANALYZE before/after) and seven PostgreSQL techniques: CROSSTAB, FILTER aggregates, LATERAL joins, recursive CTEs, window functions, JSON aggregation, DISTINCT ON.</span>
    </span>
    <span class="nb-cta nb-cta-open">Click to expand ▼</span>
    <span class="nb-cta nb-cta-close">Click to collapse ▲</span>
  </summary>
  <div class="nb-body">
    {% assign techniques_path = 'assets/jupyter/sql_techniques.ipynb' | relative_url %}
    {% capture techniques_exists %}{% file_exists assets/jupyter/sql_techniques.ipynb %}{% endcapture %}
    {% if techniques_exists == 'true' %}
      {% jupyter_notebook techniques_path %}
    {% else %}
      <p><em>Sorry, the notebook you are looking for does not exist.</em></p>
    {% endif %}
  </div>
</details>

<script>
  // Two things happen here:
  //
  // 1. Lazy loading. al-folio sizes a notebook iframe with an onload handler that
  //    reads the content's scrollHeight once. If that fires while the <details> is
  //    collapsed it reads a near-zero height and never recalculates, so we defer
  //    loading each notebook until its bar is first expanded (this also keeps the
  //    initial page load light) and recompute the height as the content settles.
  //
  // 2. Dark theme. The converted notebook only ships a light --jp-* palette, so
  //    al-folio's theme toggle (which flips data-jp-theme-light on the iframe body)
  //    has nothing dark to apply. We inject a dark palette scoped to that same
  //    attribute, then set the attribute to match the current site theme on load.
  //    al-folio's toggle drives it from there.
  (function () {
    // Theme-independent. Markdown (explanation) cells render with only a tiny
    // indent, so they read like a continuation of the previous code output. Give
    // them a callout treatment (left accent bar, subtle tint, breathing room) so
    // prose is unmistakably separate from output.
    var BASE_CSS = [
      '.jp-Notebook .jp-MarkdownCell { margin-top: 26px; margin-bottom: 10px; }',
      '.jp-Notebook .jp-MarkdownCell .jp-RenderedMarkdown {',
      '  border-left: 3px solid var(--jp-brand-color1);',
      '  padding: 8px 0 8px 18px;',
      '  background: var(--jp-rendermime-table-row-background);',
      '  border-radius: 0 6px 6px 0;',
      '}',
      // a thin divider above each prose block, the explicit separator from output
      '.jp-Notebook .jp-CodeCell + .jp-MarkdownCell { position: relative; }',
      '.jp-Notebook .jp-CodeCell + .jp-MarkdownCell::before {',
      '  content: "";',
      '  display: block;',
      '  border-top: 1px solid var(--jp-border-color2);',
      '  margin: 0 0 16px;',
      '}',
      // Inline code inside prose renders in the same colour as the text with only
      // a faint background, so it blends in. Give it the site treatment: accent
      // colour and a real box. :not(pre) > code excludes fenced code blocks.
      '.jp-RenderedMarkdown :not(pre) > code {',
      '  color: var(--jp-brand-color1);',
      '  background: var(--jp-layout-color2);',
      '  border: 1px solid var(--jp-border-color1);',
      '  border-radius: 4px;',
      '  padding: 1px 6px;',
      '}'
    ].join('\n');

    var DARK_CSS = [
      'body[data-jp-theme-light="false"] {',
      '  --jp-layout-color0: #1c1c1d;',
      '  --jp-layout-color1: #1c1c1d;',
      '  --jp-layout-color2: #26292c;',
      '  --jp-layout-color3: #2c3237;',
      '  --jp-layout-color4: #424246;',
      // dataframe zebra striping: odd rows use --jp-layout-color0 (dark above);
      // even rows + hover default to light Material greys, so darken them too
      '  --jp-rendermime-table-row-background: #26292c;',
      '  --jp-rendermime-table-row-hover-background: rgba(38, 152, 186, 0.18);',
      '  --jp-inverse-layout-color0: #ffffff;',
      '  --jp-inverse-layout-color1: #e8e8e8;',
      '  --jp-inverse-layout-color2: #cfcfcf;',
      '  --jp-inverse-layout-color3: #9a9a9a;',
      '  --jp-inverse-layout-color4: #777777;',
      '  --jp-ui-font-color0: #ffffff;',
      '  --jp-ui-font-color1: #e8e8e8;',
      '  --jp-ui-font-color2: rgba(232,232,232,0.72);',
      '  --jp-ui-font-color3: rgba(232,232,232,0.5);',
      '  --jp-content-font-color0: #ffffff;',
      '  --jp-content-font-color1: #e8e8e8;',
      '  --jp-content-font-color2: rgba(232,232,232,0.72);',
      '  --jp-content-font-color3: rgba(232,232,232,0.5);',
      '  --jp-content-link-color: #2698ba;',
      '  --jp-border-color0: #151516;',
      '  --jp-border-color1: #424246;',
      '  --jp-border-color2: #36363a;',
      '  --jp-border-color3: #2a2a2c;',
      '  --jp-brand-color0: #57c1e0;',
      '  --jp-brand-color1: #2698ba;',
      '  --jp-brand-color2: #1f7d99;',
      '  --jp-brand-color3: #186278;',
      '  --jp-cell-editor-background: #2c3237;',
      '  --jp-cell-editor-border-color: #424246;',
      '  --jp-cell-editor-active-background: #343b41;',
      '  --jp-cell-editor-active-border-color: #2698ba;',
      '  --jp-cell-prompt-not-active-font-color: rgba(232,232,232,0.5);',
      '  --jp-cell-inprompt-font-color: #82aaff;',
      '  --jp-cell-outprompt-font-color: #f78c6c;',
      '  --jp-mirror-editor-keyword-color: #c792ea;',
      '  --jp-mirror-editor-atom-color: #f78c6c;',
      '  --jp-mirror-editor-number-color: #fd9170;',
      '  --jp-mirror-editor-def-color: #82aaff;',
      '  --jp-mirror-editor-variable-color: #e8e8e8;',
      '  --jp-mirror-editor-variable-2-color: #82aaff;',
      '  --jp-mirror-editor-variable-3-color: #f78c6c;',
      '  --jp-mirror-editor-punctuation-color: #c3cee3;',
      '  --jp-mirror-editor-property-color: #80cbc4;',
      '  --jp-mirror-editor-operator-color: #89ddff;',
      '  --jp-mirror-editor-comment-color: #7e8aa0;',
      '  --jp-mirror-editor-string-color: #c3e88d;',
      '  --jp-mirror-editor-string-2-color: #f07178;',
      '  --jp-mirror-editor-meta-color: #c792ea;',
      '  --jp-mirror-editor-builtin-color: #ffcb6b;',
      '  --jp-mirror-editor-bracket-color: #c3cee3;',
      '  --jp-mirror-editor-tag-color: #f07178;',
      '  --jp-mirror-editor-attribute-color: #c792ea;',
      '  --jp-mirror-editor-header-color: #82aaff;',
      '  --jp-mirror-editor-quote-color: #c3e88d;',
      '  --jp-mirror-editor-link-color: #82aaff;',
      '  --jp-mirror-editor-error-color: #ff5370;',
      '}',
      // keep the static chart images readable on a dark surface
      'body[data-jp-theme-light="false"] .jp-RenderedImage img {',
      '  background: #ffffff; border-radius: 4px;',
      '}'
    ].join('\n');

    function siteTheme() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function applyTheme(f) {
      try {
        var doc = f.contentWindow.document;
        if (!doc || !doc.body) return;
        if (!doc.getElementById('nb-dark-theme')) {
          var st = doc.createElement('style');
          st.id = 'nb-dark-theme';
          st.textContent = BASE_CSS + '\n' + DARK_CSS;
          doc.head.appendChild(st);
        }
        var dark = siteTheme() === 'dark';
        doc.body.setAttribute('data-jp-theme-light', dark ? 'false' : 'true');
        doc.body.setAttribute('data-jp-theme-name', dark ? 'JupyterLab Dark' : 'JupyterLab Light');
      } catch (e) {}
    }

    function init() {
      document.querySelectorAll('details.nb-collapse').forEach(function (d) {
        var iframe = d.querySelector('iframe');
        if (iframe && iframe.getAttribute('src')) {
          iframe.dataset.src = iframe.getAttribute('src');
          iframe.removeAttribute('src');
        }
        d.addEventListener('toggle', function () {
          if (!d.open) return;
          var f = d.querySelector('iframe');
          if (!f) return;
          if (!f.getAttribute('src') && f.dataset.src) {
            f.setAttribute('src', f.dataset.src);
          }
          function resize() {
            try {
              var doc = f.contentWindow.document;
              if (doc && doc.documentElement.scrollHeight) {
                f.parentElement.style.paddingBottom =
                  (doc.documentElement.scrollHeight + 10) + 'px';
              }
            } catch (e) {}
          }
          // applyTheme + resize are idempotent, so run them on load and again on
          // a few delays. The lone load event can be missed for a fast cached
          // iframe, but the delayed passes reliably catch the loaded document.
          function apply() { applyTheme(f); resize(); }
          f.addEventListener('load', apply);
          apply();
          setTimeout(apply, 100);
          setTimeout(apply, 400);
          setTimeout(apply, 1000);
        });
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
</script>

---

## What's next

A few threads I left open, mostly in the second notebook, that I would pick up the same way I built the rest.

- **Put the geography on an actual map.** The Sao Paulo concentration only jumps out of a bar chart if you already know to look for it. A choropleth of order density across Brazilian states would make it land at a glance, and the state revenue query already returns everything the map needs.
- **Bring acquisition channel into the retention story.** The marketing leads table sat untouched the whole project. It carries acquisition-channel data that could tie customer segments back to where those customers came from. The 3% repeat rate reads as a product problem right now. It might turn out to be a channel problem once the source is in the picture.
- **Put confidence intervals on the delivery-to-review finding.** The pattern across the delivery buckets is clean, but I would want bootstrap intervals before quoting a specific number. The direction is not in doubt. The magnitude is the part still worth pinning down.
- **Measure sellers on what they cancel, not just what they deliver.** The current seller analysis only looks at delivered orders, which quietly excuses the sellers whose real problem is never reaching delivery at all. Cancellation and refund rates would round that out.

**Stretch goal**

**Put the whole thing behind a small interactive dashboard.** Every query here returns a clean result set, so wiring the headline ones into a lightweight dashboard would turn a page of static findings into something a reader can actually poke at. It is more plumbing than analysis, but it would make the work far easier to explore without opening a notebook.

---

## How to run it

Development setup: hardcoded credentials, single-node Postgres, no production hardening. You'll need Docker Desktop, plus Python 3.10+ for the notebooks.

```bash
docker-compose up -d # start PostgreSQL 15
docker-compose exec postgres psql -U postgres -d olist_db -c "\dt" # verify tables loaded

pip install -r notebook_requirements.txt
jupyter lab sql_practice_notebook.ipynb # open the analysis
```

**Connection details:**

| Field    | Value     |
| -------- | --------- |
| Host     | localhost |
| Port     | 5432      |
| User     | postgres  |
| Password | postgres  |
| Database | olist_db  |

The OLIST dataset is published under the [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) licence on [Kaggle](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce). The CSVs are downloaded separately.
