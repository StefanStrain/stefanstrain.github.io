---
title: Analyse SQL du e-commerce OLIST
description: Analyse SQL de 100 000 vraies commandes e-commerce brésiliennes, puis les techniques propres à PostgreSQL qui se cachent derrière. Deux notebooks, PostgreSQL 15.
img: assets/img/schema_diagram.png
importance: 2
category: analytics
tags: [PostgreSQL, SQL, Python, Analyse de données]
---

## En bref

Le taux de réachat est de 3 %. La catégorie Santé et Beauté dépasse l'électronique. Le délai de livraison est le meilleur prédicteur de la note laissée par le client, et le goulot d'étranglement est le transporteur, pas le vendeur. São Paulo représente environ 40 % du chiffre d'affaires, tandis que les États du nord paient 30 à 40 % de frais de port en plus.

Ces résultats ne sont que la moitié de l'histoire. Je suis revenu plus tard sur le projet pour écrire correctement le second notebook, en étudiant le fonctionnement interne de PostgreSQL et en mesurant chaque requête (cache chaud, 50 exécutions, médiane, test de Mann-Whitney). Exécuter chaque requête autant de fois a montré que la plupart des conseils d'indexation ne changeaient rien sur ce schéma, le seul vrai gain étant un index couvrant qui a divisé les lectures de buffers par environ 140. Certaines choses ne sont pas encore terminées, et ce sont justement celles sur lesquelles je reviendrai.

<a href="https://github.com/StefanStrain/project_04_sql-analysis" target="_blank" style="display:inline-flex; align-items:center; gap:8px; margin-top:0.75rem; padding:10px 24px; border-radius:6px; font-size:0.97em; font-weight:600; background:var(--global-theme-color); color:var(--color-bg); text-decoration:none; letter-spacing:0.01em; box-shadow:0 2px 8px rgba(0,0,0,0.18);"><svg height="18" width="18" viewBox="0 0 16 16" style="fill:currentColor;flex-shrink:0;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>Voir sur GitHub</a>

## Le projet

J'ai construit ce projet pour progresser en SQL. [OLIST](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) est une marketplace brésilienne, un peu comme Amazon, dont le jeu de données publié sur Kaggle a assez de tables et de relations pour rendre les requêtes vraiment intéressantes, et assez de lignes pour que la performance commence à compter. Le but n'était pas seulement d'obtenir des réponses. Il s'agissait de travailler des patterns SQL de plus en plus complexes, de comprendre pourquoi ils fonctionnent, et de me constituer un ensemble de techniques que je réutiliserais vraiment.

Le jeu de données couvre environ 100 000 vraies commandes passées entre 2016 et 2018, réparties sur 11 tables. Les clients, les vendeurs et les produits sont les entités principales, `orders` est la table de faits centrale, et `order_items`, `order_payments` et `order_reviews` portent le détail des transactions.

## Ce qui ressort

Quelques résultats qui m'ont vraiment surpris. Ce n'est qu'une sélection, l'ensemble se trouve dans les notebooks plus bas.

**Côté analyse**

- **Le taux de réachat tourne autour de 3 %.** Presque toutes les commandes viennent d'un premier achat. Je m'attendais à quelque chose de plus proche des 20 à 30 % habituels dans l'e-commerce. L'analyse de cohortes confirme qu'il ne s'agit pas d'un creux passager. Le chiffre est stable pour tous les mois d'acquisition, et la rétention est de loin le plus gros levier dans ces données. *(notebook d'analyse, §5 et §10)*
- **Santé et Beauté mène le chiffre d'affaires, pas l'électronique.** Je pensais que les ordinateurs ou les téléphones domineraient. Ce n'est pas le cas, et de loin. Santé et Beauté est une catégorie de consommables, donc les clients *devraient* revenir, ce qui fait d'un taux de réachat de 3 % dans un catalogue fait pour le réapprovisionnement une contradiction qui mérite d'être comprise. *(notebook d'analyse, §6)*
- **Le délai de livraison prédit la note mieux que tout le reste.** Les commandes livrées en 0 à 3 jours obtiennent en moyenne 4,46 étoiles. Celles qui prennent plus de 22 jours tombent à 3,01. Le résultat moins évident, c'est que le goulot d'étranglement se trouve chez le transporteur (environ 9,3 jours de transit) plutôt que chez le vendeur (environ 2,8 jours avant l'expédition). Demander aux vendeurs d'expédier plus vite n'est pas la bonne solution. *(notebook d'analyse, §7)*
- **São Paulo représente environ 40 % du chiffre d'affaires.** Les clients des États du nord (AM, PA, RR) paient des frais de port de 30 à 40 % du prix de l'article, parce que presque tous les vendeurs sont basés à SP. Ils paient plus et attendent plus longtemps. C'est un problème d'offre autant que de demande. *(notebook d'analyse, §4)*
- **Les clients « à risque » représentent une opportunité de réengagement de 5,7 M R$.** La segmentation RFM classe 23 572 clients comme « à risque », soit 5,7 M R$ de chiffre d'affaires venant de personnes qui ont déjà acheté ici une fois. Les reconquérir coûte moins cher que d'en trouver de nouveaux, et les données pour les identifier existent déjà. *(notebook d'analyse, §9)*

**Côté optimisation**

- **Un index couvrant a divisé les lectures de buffers par environ 140.** Dès que la requête ne demandait plus que les deux colonnes portées par l'index, Postgres est passé à un `Index Only Scan` avec `Heap Fetches: 0` sans jamais toucher la table principale. Les lectures de buffers sont tombées de 104 762 à 746, et contrairement aux temps bruts, ce ratio reste parfaitement stable d'une exécution à l'autre. *(notebook des techniques, §11)*
- **La plupart des conseils d'indexation classiques n'ont rien changé sur ce schéma.** Mesurés proprement (cache chaud, 50 exécutions, médiane, Mann-Whitney), l'index sur clé étrangère comme l'index sur expression ont laissé le plan d'exécution inchangé. La leçon, c'est que ce sont les compteurs de buffers, et non les p-values, qui disent si un index travaille vraiment. *(notebook des techniques, §11)*

## Schéma

11 tables. `orders` est au centre, et relie les clients aux articles qu'ils ont achetés, aux paiements qu'ils ont faits et aux avis qu'ils ont laissés. Chaque `order_item` associe une commande à un produit et à un vendeur précis, tandis que clients et vendeurs se rattachent à la géolocalisation via les préfixes de codes postaux brésiliens. Cette organisation en étoile (des tables de faits transactionnelles entourées de dimensions descriptives) est ce qui rend le jeu de données si adapté aux jointures, agrégations et fonctions de fenêtrage utilisées tout au long du projet.

<style>
  /* the diagram is wide, so a shorter frame wastes less space on phones */
  @media (max-width: 575.98px) { #schema-zoom-wrapper { height: 320px !important; } }
</style>
<div id="schema-zoom-wrapper" style="position: relative; width: 100%; height: 600px;">
  <div id="schema-zoom-container" style="width: 100%; height: 100%; border: 1px solid var(--global-divider-color); border-radius: 6px; overflow: hidden; background: var(--global-bg-color);">
    <!-- inline SVG injected by script below -->
  </div>
  <div id="schema-zoom-overlay" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.35); color: #fff; font-weight: 500; cursor: pointer; border-radius: 6px; user-select: none; transition: opacity 0.15s;">
    Cliquez pour interagir (molette pour zoomer, glisser pour se déplacer, double-clic pour réinitialiser)
  </div>
</div>
<p id="schema-zoom-hint" class="text-muted" style="font-size: 0.85em; margin-top: 0.4em;">
  Cliquez en dehors du diagramme ou appuyez sur <kbd>Échap</kbd> pour le libérer.
</p>
<p class="text-muted" style="font-size: 0.85em; margin-top: 0.4em;">
  Le diagramme montre un petit nœud <code>geolocation_zip_prefixes</code>. Ce n'est pas une table de base mais une clé de référence pour le préfixe de code postal partagé, c'est pourquoi on compte 11 tables et non 12.
</p>

<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
<script>
  (function () {
    var wrapper = document.getElementById('schema-zoom-wrapper');
    var container = document.getElementById('schema-zoom-container');
    var overlay = document.getElementById('schema-zoom-overlay');
    var pz = null;
    var active = false;
    var svgUrl = "/assets/schemas/project_04_schema.svg";
    // svg-pan-zoom has no touch gestures, so on touch screens a tap opens the full-size
    // diagram instead, where the browser's own pinch-zoom works
    var touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch) {
      overlay.textContent = 'Touchez pour ouvrir le diagramme en grand';
      var hint = document.getElementById('schema-zoom-hint');
      if (hint) hint.style.display = 'none';
    }

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

    fetch(svgUrl)
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

    overlay.addEventListener('click', function () {
      if (touch) window.open(svgUrl, '_blank', 'noopener');
      else setActive(true);
    });
    document.addEventListener('click', function (e) {
      if (active && !wrapper.contains(e.target)) setActive(false);
    });
    document.addEventListener('keydown', function (e) {
      if (active && e.key === 'Escape') setActive(false);
    });
  })();
</script>

---

## Les notebooks

Le projet est réparti sur deux notebooks. Le premier est le parcours d'entraînement à travers l'analyse. Le second est celui où j'ai ralenti pour travailler correctement les techniques propres à PostgreSQL et l'optimisation des requêtes. **Les deux sont repliés ci-dessous. Cliquez sur une barre pour l'ouvrir.**

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
  /* phones: put the expand button under the text instead of squeezing the text beside it */
  @media (max-width: 575.98px) {
    .nb-collapse > summary {
      grid-template-columns: auto 1fr;
      padding: 0.9rem 1rem;
      gap: 0.4rem 0.75rem;
    }
    .nb-collapse .nb-cta { grid-column: 2; justify-self: start; margin-top: 0.35rem; }
  }
</style>

<details class="nb-collapse">
  <summary>
    <span class="nb-chevron">▶</span>
    <span class="nb-titles">
      <span class="nb-title">Notebook d'analyse - Analyse principale</span>
      <span class="nb-sub">Croissance du chiffre d'affaires, performance géographique, comportement client, segmentation RFM, rétention par cohorte, plus une partie 2 sur les techniques SQL.</span>
    </span>
    <span class="nb-cta nb-cta-open">Cliquer pour ouvrir ▼</span>
    <span class="nb-cta nb-cta-close">Cliquer pour replier ▲</span>
  </summary>
  <div class="nb-body">
    <div class="jupyter-notebook-iframe-container" style="position:relative; width:100%;"><iframe src="/assets/jupyter/sql_practice_notebook.html" style="position:absolute; inset:0; border:none;" width="100%" height="100%" loading="lazy"></iframe></div>
  </div>
</details>

<details class="nb-collapse">
  <summary>
    <span class="nb-chevron">▶</span>
    <span class="nb-titles">
      <span class="nb-title">Techniques et optimisation</span>
      <span class="nb-sub">Études de cas d'indexation (EXPLAIN ANALYZE avant/après) et sept techniques PostgreSQL : CROSSTAB, agrégats FILTER, jointures LATERAL, CTE récursives, fonctions de fenêtrage, agrégation JSON, DISTINCT ON.</span>
    </span>
    <span class="nb-cta nb-cta-open">Cliquer pour ouvrir ▼</span>
    <span class="nb-cta nb-cta-close">Cliquer pour replier ▲</span>
  </summary>
  <div class="nb-body">
    <div class="jupyter-notebook-iframe-container" style="position:relative; width:100%;"><iframe src="/assets/jupyter/sql_techniques.html" style="position:absolute; inset:0; border:none;" width="100%" height="100%" loading="lazy"></iframe></div>
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
  //    the site's themechange event drives it from there.
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
      '  --jp-layout-color0: #161c25;',
      '  --jp-layout-color1: #161c25;',
      '  --jp-layout-color2: #1d2531;',
      '  --jp-layout-color3: #232c3a;',
      '  --jp-layout-color4: #2e3846;',
      // dataframe zebra striping: odd rows use --jp-layout-color0 (dark above);
      // even rows + hover default to light Material greys, so darken them too
      '  --jp-rendermime-table-row-background: #1d2531;',
      '  --jp-rendermime-table-row-hover-background: rgba(95, 179, 161, 0.18);',
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
      '  --jp-content-link-color: #5fb3a1;',
      '  --jp-border-color0: #0d1117;',
      '  --jp-border-color1: #2e3846;',
      '  --jp-border-color2: #273140;',
      '  --jp-border-color3: #1f2733;',
      '  --jp-brand-color0: #7cc9b8;',
      '  --jp-brand-color1: #5fb3a1;',
      '  --jp-brand-color2: #4a9a89;',
      '  --jp-brand-color3: #3a7d6f;',
      '  --jp-cell-editor-background: #232c3a;',
      '  --jp-cell-editor-border-color: #2e3846;',
      '  --jp-cell-editor-active-background: #28323f;',
      '  --jp-cell-editor-active-border-color: #5fb3a1;',
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
    // follow the site's light/dark toggle while a notebook is open
    window.addEventListener('themechange', function () {
      document.querySelectorAll('details.nb-collapse iframe').forEach(applyTheme);
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
</script>

---

## Et ensuite

Quelques pistes que j'ai laissées ouvertes, surtout dans le second notebook, et que je reprendrais de la même façon que le reste.

- **Mettre la géographie sur une vraie carte.** La concentration à São Paulo ne saute aux yeux sur un diagramme en barres que si l'on sait déjà où regarder. Une carte choroplèthe de la densité de commandes par État brésilien la rendrait évidente en un coup d'œil, et la requête sur le chiffre d'affaires par État renvoie déjà tout ce dont la carte a besoin.
- **Intégrer le canal d'acquisition à l'histoire de la rétention.** La table des leads marketing est restée inutilisée pendant tout le projet. Elle contient des données de canal d'acquisition qui permettraient de relier les segments de clients à leur provenance. Pour l'instant, le taux de réachat de 3 % ressemble à un problème de produit. Il pourrait s'avérer être un problème de canal une fois la source prise en compte.
- **Ajouter des intervalles de confiance au lien entre livraison et note.** La tendance entre les tranches de délai est nette, mais je voudrais des intervalles bootstrap avant d'avancer un chiffre précis. Le sens de l'effet ne fait pas de doute. C'est son ampleur qui reste à préciser.
- **Évaluer les vendeurs sur ce qu'ils annulent, pas seulement sur ce qu'ils livrent.** L'analyse actuelle des vendeurs ne regarde que les commandes livrées, ce qui excuse discrètement ceux dont le vrai problème est de ne jamais arriver jusqu'à la livraison. Les taux d'annulation et de remboursement compléteraient le tableau.

**Objectif bonus**

**Mettre le tout derrière un petit tableau de bord interactif.** Chaque requête renvoie un résultat propre, donc brancher les principales sur un tableau de bord léger transformerait une page de constats statiques en quelque chose que le lecteur peut vraiment manipuler. C'est plus de la plomberie que de l'analyse, mais cela rendrait le travail bien plus facile à explorer sans ouvrir de notebook.

---

## Comment le lancer

Environnement de développement : identifiants en dur, Postgres sur un seul nœud, rien de durci pour la production. Il vous faut Docker Desktop, plus Python 3.10 ou plus récent pour les notebooks.

```bash
docker-compose up -d # démarre PostgreSQL 15
docker-compose exec postgres psql -U postgres -d olist_db -c "\dt" # vérifie que les tables sont chargées

pip install -r notebook_requirements.txt
jupyter lab sql_practice_notebook.ipynb # ouvre l'analyse
```

**Paramètres de connexion :**

| Champ    | Valeur    |
| -------- | --------- |
| Host     | localhost |
| Port     | 5432      |
| Utilisateur | postgres  |
| Mot de passe | postgres  |
| Base de données | olist_db  |

Le jeu de données OLIST est publié sous licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) sur [Kaggle](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce). Les CSV se téléchargent séparément.
