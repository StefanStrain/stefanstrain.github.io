---
title: Segmentation 3D de tumeurs cérébrales
description: Cinq architectures de deep learning entraînées sur des IRM cérébrales 3D, d'un CNN de référence jusqu'à un Transformer. Un modèle de 2,4M de paramètres a égalé un modèle de 62M. Tout a été construit et comparé de zéro sur un GPU grand public.
img: assets/img/brats_seg/overlay_attention_unet.png
importance: 1
category: medical
tags: [Python, PyTorch, MONAI, Imagerie médicale, Segmentation 3D, Transformers, MLflow]
---
<style>
  /* phones: tighter cells so the results tables fit without sideways scrolling */
  @media (max-width: 575.98px) {
    div[style*="overflow-x:auto"] th,
    div[style*="overflow-x:auto"] td { padding: 6px 5px !important; font-size: 0.85em; }
  }
</style>


## En bref

J'ai entraîné et comparé cinq architectures de segmentation 3D sur le **jeu de données d'IRM cérébrales BraTS2021**, en partant d'un CNN de référence, puis en passant par l'attention à portes, un Transformer global, une adaptation 3D d'un article hybride KAN de 2026 (étendu de la 2D à l'inférence volumétrique), et enfin une ablation KAN contrôlée. Chaque modèle a été entraîné sur une GTX 1070 Ti (8 Go de VRAM) avec seulement 150 des 1 251 cas d'entraînement disponibles, une contrainte matérielle qui a fini par produire des résultats vraiment intéressants. Je m'attendais à ce que le Transformer domine, et j'en suis ressorti avec une image très différente.

> **Le résultat principal :** un CNN de 22M de paramètres avec des portes d'attention a battu un Transformer de 62M de paramètres. Un hybride KAN de 2,4M de paramètres a ensuite égalé le Transformer avec **26× moins de paramètres**. Et une ablation contrôlée (une seule variable modifiée, tout le reste identique) a montré qu'en remplaçant uniquement les activations du bottleneck par des splines KAN, on battait de peu le mécanisme d'attention sur la métrique la plus importante cliniquement, le tout avec 12 % des données disponibles.

<a href="https://github.com/StefanStrain/project_08_mri-segmentation" target="_blank" style="display:inline-flex; align-items:center; gap:8px; margin-top:0.75rem; padding:10px 24px; border-radius:6px; font-size:0.97em; font-weight:600; background:var(--global-theme-color); color:var(--color-bg); text-decoration:none; letter-spacing:0.01em; box-shadow:0 2px 8px rgba(0,0,0,0.18);"><svg height="18" width="18" viewBox="0 0 16 16" style="fill:currentColor;flex-shrink:0;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>Voir sur GitHub</a>

<nav style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:1.25rem 0; font-size:0.88em;">
  <strong style="display:block; margin-bottom:8px; font-size:0.78em; text-transform:uppercase; letter-spacing:.6px; color:var(--color-muted);">Sommaire</strong>
  <style>#toc-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 28px;}@media(max-width:575.98px){#toc-grid{grid-template-columns:1fr;}}</style>
  <div id="toc-grid">
    <a href="#le-problème" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">1.</span>Le problème</a>
    <a href="#jeu-de-données-et-réalité-matérielle" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">2.</span>Jeu de données et réalité matérielle</a>
    <a href="#superpositions-de-segmentation" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">3.</span>Superpositions de segmentation</a>
    <a href="#exploration-des-architectures" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">4.</span>Exploration des architectures</a>
    <a href="#synthèse-des-résultats" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">5.</span>Synthèse des résultats</a>
    <a href="#comparer-deux-modèles-au-choix" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">6.</span>Comparer deux modèles</a>
    <a href="#maillage-3d-de-la-tumeur" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">7.</span>Maillage 3D de la tumeur</a>
    <a href="#cartes-dactivation-des-portes-dattention" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">8.</span>Cartes des portes d'attention</a>
    <a href="#carte-dincertitude-augmentation-au-moment-du-test" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">9.</span>Carte d'incertitude</a>
    <a href="#graphiques-interactifs" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">10.</span>Graphiques interactifs</a>
    <a href="#schémas-darchitecture" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">11.</span>Schémas d'architecture</a>
    <a href="#choix-dingénierie" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">12.</span>Choix d'ingénierie</a>
    <a href="#et-ensuite" style="color:var(--global-theme-color); text-decoration:none;"><span style="color:var(--color-muted); margin-right:5px;">13.</span>Et ensuite</a>
  </div>
</nav>

---

## Le problème

Les tumeurs cérébrales ne se comportent pas de façon prévisible. Leur forme est irrégulière, elles varient énormément d'un patient à l'autre et se composent de plusieurs sous-types de tissus, dont un cœur nécrotique (**NCR**), un anneau d'œdème qui l'entoure (**ED**) et une zone de tumeur active qui prend le contraste (**ET**). Ces tissus n'ont pas du tout le même aspect selon la séquence IRM qu'on regarde. Les radiologues les délimitent généralement à la main, un processus lent et sujet à un biais qui varie d'un clinicien à l'autre.

Automatiser la segmentation 3D est intéressant parce que cela alimente directement des décisions cliniques comme la planification chirurgicale, le ciblage de la radiothérapie ou le suivi de l'efficacité d'un traitement. Bien segmenter, et savoir où le modèle doute, sont deux aspects très importants.

Le jeu de données du challenge définit **trois sous-régions qui ont un sens clinique**, chacune évaluée séparément parce qu'elles servent à des choses différentes.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:8px 16px; text-align:left; font-weight:600;">Région</th>
  <th style="padding:8px 16px; text-align:left; font-weight:600;">Composition</th>
  <th style="padding:8px 16px; text-align:left; font-weight:600;">Usage clinique</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; white-space:nowrap;"><strong>WT</strong> - Tumeur entière</td><td style="padding:8px 16px;">NCR + ED + ET</td><td style="padding:8px 16px;">Planification chirurgicale (quelle quantité de tissu est touchée)</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; white-space:nowrap;"><strong>TC</strong> - Cœur tumoral</td><td style="padding:8px 16px;">NCR + ET</td><td style="padding:8px 16px;">Caractérisation du cœur (la région activement dangereuse)</td></tr>
<tr><td style="padding:8px 16px; white-space:nowrap;"><strong>ET</strong> - Tumeur rehaussée</td><td style="padding:8px 16px;">ET seul</td><td style="padding:8px 16px;">Réponse au traitement (la tumeur rétrécit-elle vraiment ?)</td></tr>
</tbody>
</table>
</div>

### **Le coefficient de Dice**

La métrique principale est le **coefficient de Dice**, qui mesure à quel point la prédiction du modèle recouvre l'annotation de référence tracée par un radiologue expert. Il va de 0 (aucun recouvrement) à 1 (accord parfait).

Imaginez deux ensembles de voxels surlignés sur un scanner cérébral, l'ensemble **P** des voxels que le modèle prédit comme tumeur, et l'ensemble **G** de ceux que le radiologue a réellement annotés comme tumeur. Le coefficient de Dice donne la part des voxels que **P** et **G** classent tous les deux comme tumeur, plus précisément :

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:16px 20px; margin:1rem 0;">

$$\text{Dice}(P, G) = \frac{2|P \cap G|}{|P| + |G|}$$

<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.92em;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="text-align:left; padding:6px 10px; font-weight:600;">Terme</th>
  <th style="text-align:left; padding:6px 10px; font-weight:600;">Signification</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:6px 10px; white-space:nowrap;"><strong>|P ∩ G|</strong></td><td style="padding:6px 10px;">Voxels où le modèle et l'expert ont tous deux dit « tumeur » (le recouvrement)</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:6px 10px; white-space:nowrap;"><strong>|P|</strong></td><td style="padding:6px 10px;">Nombre de voxels que le modèle a prédits comme tumeur</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:6px 10px; white-space:nowrap;"><strong>|G|</strong></td><td style="padding:6px 10px;">Nombre de voxels que l'expert a annotés comme tumeur</td></tr>
<tr><td style="padding:6px 10px; white-space:nowrap;"><strong>Facteur 2</strong></td><td style="padding:6px 10px;">Garantit qu'une prédiction parfaite (P = G) obtienne 1 et non 0,5</td></tr>
</tbody>
</table>
</div>

Si le modèle prédit parfaitement, $$P = G$$, le recouvrement est égal aux deux ensembles et Dice = 1. Si le modèle rate tout, le recouvrement est nul et Dice = 0. Un modèle qui marque *trop* de voxels comme tumeur est pénalisé lui aussi, car un grand $$ \lvert P \rvert $$ gonfle le dénominateur sans aider le numérateur.

Un score de **0,88**, à peu près ce qu'atteint ce projet, signifie que le contour de tumeur du modèle concorde avec l'annotation de l'expert à environ 88 %. Comme on le verra plus bas, cela le place dans la même catégorie que des modèles entraînés sur les 1 251 cas complets.

---

## Jeu de données et réalité matérielle

Le jeu de données du [Brain Tumour Segmentation 2021 Challenge](http://braintumorsegmentation.org/) contient 1 251 IRM multiparamétriques préopératoires, chacune avec quatre modalités alignées et un masque tracé par un expert au niveau du voxel.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em;">
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; font-weight:600; white-space:nowrap; width:32%;">Cas</td><td style="padding:8px 16px;">1 251 patients</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; font-weight:600; white-space:nowrap;">Modalités</td><td style="padding:8px 16px;">FLAIR  -  T1  -  T1CE  -  T2 (4 canaux)</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; font-weight:600; white-space:nowrap;">Taille des volumes</td><td style="padding:8px 16px;">240 × 240 × 155 voxels, 1 mm isotrope</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; font-weight:600; white-space:nowrap;">Labels</td><td style="padding:8px 16px;">0 (fond)  -  1 (NCR)  -  2 (ED)  -  4 (ET)</td></tr>
<tr><td style="padding:8px 16px; font-weight:600; white-space:nowrap;">Code couleur</td><td style="padding:8px 16px;">NCR = rouge  -  ED = jaune  -  ET = cyan</td></tr>
</tbody>
</table>
</div>

### Pourquoi seulement 150 cas ?

La réponse honnête, c'est le matériel. Ce projet a tourné sur une **GTX 1070 Ti**, un GPU grand public avec 8 Go de VRAM et sans Tensor Cores. C'est une vraie contrainte quand on travaille avec des volumes médicaux en 3D.

Un seul scanner cérébral fait 240×240×155 voxels sur quatre modalités. Charger un volume complet en mémoire GPU prend à lui seul plusieurs gigaoctets, il est donc tout simplement impossible de faire une passe avant-arrière sur un cerveau entier d'un coup. La solution est l'**entraînement par patches**. On découpe au hasard des sous-volumes de 128×128×128 et on s'entraîne dessus, avec l'échantillonneur de MONAI biaisé vers le premier plan pour que le modèle voie plus souvent des patches contenant de la tumeur que du fond pur.

Même avec des patches, entraîner un modèle sur les 1 251 cas prendrait plusieurs jours. Avec quatre architectures à comparer, on parle de semaines, ce qui n'est pas réaliste pour un projet personnel. Se limiter à **150 cas d'entraînement et 50 cas de validation** garde chaque entraînement dans une durée raisonnable, tout en restant assez grand pour voir si un changement d'architecture aide vraiment.

Le même découpage fixe, généré une seule fois avec une graine aléatoire et réutilisé pour chaque modèle, garantit des comparaisons équitables. Toute différence de Dice vient de l'architecture, pas d'un artefact du découpage des données.

Le rythme pratique, c'était des entraînements de nuit. On lance un run avant d'aller se coucher, on regarde les chiffres le matin. Les modèles CNN ont pris environ 7 heures chacun, Swin UNETR en a pris 17. À un moment, j'ai envisagé de louer de la puissance de calcul dans le cloud. Pour à peu près le prix d'un café, on pourrait faire tourner Swin UNETR sur les 1 251 cas sur une V100 en quelques heures. J'ai choisi de ne pas le faire. Le but du projet était de comprendre les architectures et de construire le pipeline, pas de courir après le meilleur score possible. Cela dit, c'est une amélioration facile si j'y reviens un jour.

**Ce qui m'a vraiment surpris, c'est à quel point les résultats ont fini par être compétitifs.** Le score TC de l'Attention U-Net, **0,884**, arrive à 0,004 du vainqueur du challenge BraTS2021, qui s'entraînait sur les 1 251 cas avec une vraie puissance de calcul. Le score ET bat carrément à la fois la fourchette publiée dans l'article original de l'Attention U-Net *et* les résultats de Swin UNETR sur le jeu complet. Je ne m'y attendais pas, et ce constat s'est confirmé pour chaque modèle entraîné. Pour ce problème, du moins dans ce régime de données, les choix d'architecture semblent compter autant que le volume de données.

---

## Superpositions de segmentation

Faites glisser la poignée pour comparer la **vérité terrain** (à gauche) et la prédiction de l'**Attention U-Net** (à droite) sur le cas BraTS2021_01619, coupe axiale 67 (un cas de validation où les trois régions tumorales sont bien représentées).

<script type="module" src="https://cdn.jsdelivr.net/npm/img-comparison-slider@8/dist/index.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/img-comparison-slider@8/dist/styles.css" />

<img-comparison-slider style="width:100%; --divider-width: 3px; --divider-color: rgba(255,255,255,0.85); border-radius: 8px; overflow: hidden; margin: 1rem 0;">
  <img slot="first"  src="/assets/img/brats_seg/overlay_gt.png"               alt="Segmentation de référence" style="width:100%; display:block;" />
  <img slot="second" src="/assets/img/brats_seg/overlay_attention_unet.png"   alt="Prédiction de l'Attention U-Net" style="width:100%; display:block;" />
</img-comparison-slider>
<div class="caption">
  <strong>Gauche :</strong> vérité terrain &nbsp; - &nbsp; <strong>Droite :</strong> prédiction de l'Attention U-Net &nbsp; - &nbsp;
  <span style="display:inline-block; width:10px; height:10px; background:rgb(255,51,51); border-radius:2px; vertical-align:middle;"></span> NCR &nbsp;
  <span style="display:inline-block; width:10px; height:10px; background:rgb(255,230,26); border-radius:2px; vertical-align:middle;"></span> ED &nbsp;
  <span style="display:inline-block; width:10px; height:10px; background:rgb(26,217,255); border-radius:2px; vertical-align:middle;"></span> ET
</div>

---

## Exploration des architectures

Plutôt que de choisir une seule architecture et de l'optimiser, j'ai conçu ce projet comme une progression. Chaque modèle a été choisi pour répondre à une question précise soulevée par les résultats du précédent. L'histoire va du local au global, puis revient en arrière.

<div style="margin: 1.5rem 0; font-family:'Inter','Segoe UI',system-ui,sans-serif;">

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px; text-align:center;">
    <strong>3D U-Net</strong>
    <span style="display:block; color:var(--color-muted); font-size:0.85em;">CNN de référence</span>
  </div>

  <div style="padding:10px 0; color:var(--color-muted); font-size:0.85em; line-height:1.5; text-align:center;">
    ↓<br>Les skip connections transmettent toutes les features de l'encodeur directement au décodeur, y compris les régions de fond qui n'ont rien à voir avec la tumeur. Le modèle n'a aucun moyen de les filtrer, ce qui le pousse à sur-prédire.
  </div>

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px; text-align:center;">
    <strong>Attention U-Net</strong>
    <span style="display:block; color:var(--color-muted); font-size:0.85em;">skip connections à portes</span>
  </div>

  <div style="padding:10px 0; color:var(--color-muted); font-size:0.85em; line-height:1.5; text-align:center;">
    ↓<br>Les portes d'attention aident le modèle à se concentrer sur les régions pertinentes dans les skip connections. Mais chaque convolution ne regarde toujours qu'un petit voisinage de voxels à la fois, donc le modèle ne peut pas raisonner sur la forme de la tumeur ou sur le contexte à l'échelle du cerveau entier.
  </div>

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px; text-align:center;">
    <strong>Swin UNETR</strong>
    <span style="display:block; color:var(--color-muted); font-size:0.85em;">Transformer global, 62M de paramètres</span>
  </div>

  <div style="padding:10px 0; color:var(--color-muted); font-size:0.85em; line-height:1.5; text-align:center;">
    ↓<br>Le Transformer a 62 millions de paramètres mais seulement 150 cas d'entraînement pour apprendre. Avec un tel ratio, il finit par mémoriser les patches d'entraînement au lieu de généraliser, et fait moins bien que le CNN, pourtant bien plus petit.
  </div>

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px; text-align:center;">
    <strong>KAN U-Net</strong>
    <span style="display:block; color:var(--color-muted); font-size:0.85em;">hybride léger, 2,42M de paramètres</span>
  </div>

  <div style="padding:10px 0; color:var(--color-muted); font-size:0.85em; line-height:1.5; text-align:center;">
    ↓<br>Ce modèle change plusieurs choses à la fois par rapport à la référence, avec moins de convolutions par niveau, un bottleneck plus léger et des activations KAN. S'il se comporte différemment, impossible de savoir proprement quel changement en est responsable.
  </div>

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px; text-align:center;">
    <strong>KAN 3D U-Net</strong>
    <span style="display:block; color:var(--color-muted); font-size:0.85em;">3D U-Net avec activations KAN au bottleneck</span>
  </div>

</div>

### 3D U-Net (modèle 1, CNN de référence)

> *[Çiçek et al. 2016](https://arxiv.org/abs/1606.06650) — "3D U-Net: Learning Dense Volumetric Segmentation from Sparse Annotation"*

Le point de départ de presque toute tâche de segmentation médicale en 3D. Un encodeur compresse le volume sur quatre niveaux spatiaux (en divisant la résolution par deux à chaque fois par max-pooling), un bottleneck traite les features les plus abstraites, et un décodeur remonte symétriquement, avec des skip connections qui transportent le détail spatial fin de chaque niveau de l'encodeur vers le niveau correspondant du décodeur.

Construire ce modèle en premier était important pour une raison qui dépasse le score de Dice. Il met en place tout le pipeline d'entraînement dont chaque modèle suivant hérite tel quel. L'échantillonneur de patches, l'inférence par fenêtre glissante, les métriques BraTS, le suivi dans MLflow. Toutes les comparaisons se font par rapport à cette base.

**Là où il atteint ses limites.** Un noyau de convolution 3×3×3 voit 27 voxels voisins à la fois. C'est suffisant pour la texture locale et les contours, mais les tumeurs cérébrales ont une structure spatiale à longue portée. La forme de l'anneau de tumeur rehaussée d'un côté est liée au cœur nécrotique de l'autre. Sans empiler beaucoup de couches, le modèle ne peut pas raisonner sur cette distance. Et les skip connections transmettent *tout* de l'encodeur au décodeur, y compris des activations de fond qui poussent le décodeur à sur-segmenter.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Région</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Moyenne</th><th style="padding:7px 12px;">Entraînement</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.876</td><td style="padding:7px 12px;">0.877</td><td style="padding:7px 12px;">0.869</td><td style="padding:7px 12px;">0.874</td><td style="padding:7px 12px;">~7 h</td>
</tr></tbody>
</table>
</div>

---

### Attention U-Net (modèle 2)

> *[Oktay et al. 2018](https://arxiv.org/abs/1804.03999) — "Attention U-Net: Learning Where to Look for the Pancreas"*

Avant d'abandonner complètement les convolutions, peut-on rendre les skip connections plus intelligentes ? L'Attention U-Net garde la même structure encodeur-décodeur mais ajoute un **mécanisme de porte** à chaque skip connection. Avant d'être concaténées dans le décodeur, les features de l'encodeur passent par une porte d'attention qui apprend un masque spatial doux, amplifiant les activations dans les régions qui ressemblent à de la tumeur et les atténuant dans le fond.

La porte est apprise entièrement à partir de la loss de segmentation, sans supervision supplémentaire. Le décodeur génère un signal de porte à chaque niveau de résolution et le compare aux features de l'encodeur. Là où ils concordent (ça ressemble à de la tumeur), la porte s'ouvre. Là où ils divergent, elle se ferme.

$$\alpha = \sigma\!\left(W_\psi \cdot \text{ReLU}(W_g \cdot g + W_x \cdot x + b_g)\right)$$

C'est ce mécanisme que l'on voit dans les cartes d'attention plus bas sur la page.

ET était la région dont j'attendais le plus de gain. Elle est compacte, a des contours irréguliers et c'est la plus difficile à distinguer des tissus voisins. Les résultats ont confirmé ce que j'attendais.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Région</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Moyenne</th><th style="padding:7px 12px;">Paramètres</th><th style="padding:7px 12px;">Entraînement</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.886</td><td style="padding:7px 12px;">0.884</td><td style="padding:7px 12px;">0.875</td><td style="padding:7px 12px;"><strong>0.882</strong></td><td style="padding:7px 12px;">22.66M</td><td style="padding:7px 12px;">~7 h</td>
</tr></tbody>
</table>
</div>

**Comparaison avec les résultats publiés (tous entraînés sur les 1 251 cas complets) :**

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;"></th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:7px 12px; text-align:left; font-weight:600;"> Attention U-Net sur 150 cas </td><td style="padding:7px 12px;"><strong>0.886</strong></td><td style="padding:7px 12px;"><strong>0.884</strong></td><td style="padding:7px 12px;"><strong>0.875</strong></td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:7px 12px; text-align:left;">Attention U-Net publié (Oktay 2018)</td><td style="padding:7px 12px;">0.88–0.90</td><td style="padding:7px 12px;">0.82–0.87</td><td style="padding:7px 12px;">0.78–0.83</td></tr>
<tr><td style="padding:7px 12px; text-align:left;">Vainqueur du challenge BraTS2021 (nnU-Net)</td><td style="padding:7px 12px;">0.932</td><td style="padding:7px 12px;">0.888</td><td style="padding:7px 12px;">0.884</td></tr>
</tbody>
</table>
</div>

TC et ET battent tous les deux la fourchette publiée dans l'article original, avec 12 % des données. TC est à 0,004 du vainqueur du challenge BraTS2021.

---

### Swin UNETR (modèle 3)

> *[Hatamizadeh et al. 2022](https://arxiv.org/abs/2201.01266) — "Swin UNETR: Swin Transformers for Semantic Segmentation of Brain Tumors in MRI Images"*

Les portes d'attention aident, mais elles opèrent toujours sur des features convolutives. La contrainte de localité est inscrite dans la convolution elle-même, pas seulement dans les skip connections. La question suivante est donc naturelle. Que se passe-t-il si l'on remplace les convolutions par un mécanisme sans aucune contrainte de localité ?

C'est exactement ce que fait Swin UNETR. Il découpe le volume 3D en petits patches (des tokens) et les fait passer dans un encodeur Swin Transformer hiérarchique, où chaque token porte son attention sur tous les autres tokens de sa fenêtre locale, et où ces fenêtres se décalent d'une couche à l'autre pour laisser le contexte global s'accumuler. Un voxel à l'avant du cerveau peut, en principe, influencer directement les prédictions à l'arrière. Le décodeur reste basé sur des CNN, pour garder un chemin de suréchantillonnage efficace.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Région</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Moyenne</th><th style="padding:7px 12px;">Paramètres</th><th style="padding:7px 12px;">Entraînement</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.882</td><td style="padding:7px 12px;">0.863</td><td style="padding:7px 12px;">0.862</td><td style="padding:7px 12px;">0.869</td><td style="padding:7px 12px;"><strong>62.19M</strong></td><td style="padding:7px 12px;">~17 h</td>
</tr></tbody>
</table>
</div>

**Swin UNETR a perdu face à l'Attention U-Net (0,869 contre 0,882 de Dice moyen) malgré 2,7× plus de paramètres et environ 17 heures d'entraînement.**

C'est le résultat que j'ai trouvé le plus intéressant, et honnêtement celui que je n'avais pas prévu. Je m'attendais à ce que le Transformer égale au moins le CNN en évaluation sur volume complet, puisqu'il faisait clairement mieux au niveau des patches (0,855 contre 0,834). Ce n'est pas arrivé. Avec le recul, trois choses se sont additionnées. Soixante-deux millions de paramètres pour 150 cas, c'est un mauvais rapport dès le départ (l'écart entre la validation par patches et l'évaluation sur volume complet est le signe classique d'un modèle qui mémorise des motifs de patches au lieu de généraliser). Ensuite, l'entraînement par patches a sapé précisément ce qui devait justifier le coût de Swin UNETR. Il a été entraîné sur des découpes de 128³ et n'a jamais vu un cerveau entier, donc le mécanisme d'attention conçu pour le contexte global n'a jamais eu de contexte global à exploiter. Enfin, les CNN ont un a priori de localité spatiale intégré qui s'avère être une hypothèse utile pour les images médicales, et qui généralise bien à partir de peu d'exemples, ce que les Transformers, qui apprennent la structure spatiale de zéro, ne font tout simplement pas.

**Plus de paramètres et une attention globale ne garantissent pas de meilleurs résultats. Avec peu de données, un CNN bien conçu avec une attention ciblée bat un Transformer 4× plus gros.**

---

### KAN U-Net (modèle 4, 3D U-KABS)

> *[Liu et al. 2024](https://arxiv.org/abs/2404.19756) — "KAN: Kolmogorov-Arnold Networks" (ICLR 2025)*<br>
> *[arXiv:2602.07702](https://arxiv.org/abs/2602.07702) — "A hybrid Kolmogorov-Arnold network for medical image segmentation"*

Le résultat de Swin UNETR change toute la question. Si un modèle plus gros et plus puissant a échoué parce qu'il avait trop de paramètres pour les données disponibles, que se passe-t-il si l'on va dans la direction opposée ? Jusqu'où peut-on réduire le modèle avant que les performances s'effondrent ?

Au départ, le plan était d'implémenter CDA-Mamba ici (un modèle à espace d'états récent qui semblait être le successeur naturel de Swin UNETR, en remplaçant le coût quadratique de l'attention du Transformer par un balayage linéaire). Je me suis heurté à un mur. `mamba-ssm` n'a pas de wheels Windows officielles, et le compiler depuis les sources avec la bonne version de CUDA n'était pas l'affaire d'un après-midi. Plutôt que de passer des jours à me battre avec l'environnement, je suis passé à KAN U-Net, un article de 2026, lui aussi récent et peu conventionnel, et en pur PyTorch sans dépendances exotiques. Avec le recul, ce changement de cap a été une bonne chose, car le résultat KAN s'est révélé le plus intéressant de tout le projet.

KAN U-Net est l'expérience qui teste la piste légère. C'est une ossature 3D U-Net où les activations standard des deux niveaux spatiaux les plus profonds sont remplacées par des **activations KAN (Kolmogorov-Arnold Network)**, des fonctions splines apprenables plutôt que des non-linéarités fixes. Le reste de l'architecture reste mince, avec une seule convolution par niveau, un bottleneck séparable en profondeur et une attention par canal de type squeeze-and-excitation. Le nombre total de paramètres est de **2,42M**.

L'idée clé des KAN, c'est que dans un réseau classique, les poids sont apprenables mais les fonctions d'activation (ReLU, GELU) ont une forme fixe. Les KAN inversent la logique. Ce sont les activations elles-mêmes qui deviennent des courbes apprenables qui s'adaptent pendant l'entraînement. La base théorique est le théorème de représentation de Kolmogorov-Arnold, selon lequel toute fonction continue peut se décomposer en compositions de fonctions plus simples à une seule variable.

Deux types de courbes sont utilisés par bloc. L'un utilise des courbes globales lisses, adaptées à la forme générale de la tumeur, appelées **KAB** (polynômes de Bernstein). L'autre utilise des courbes à adaptation locale, mieux adaptées au détail fin des contours, appelées **KAS** (B-splines).

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Région</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Moyenne</th><th style="padding:7px 12px;">Paramètres</th><th style="padding:7px 12px;">Entraînement</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.878</td><td style="padding:7px 12px;">0.873</td><td style="padding:7px 12px;">0.856</td><td style="padding:7px 12px;"><strong>0.869</strong></td><td style="padding:7px 12px;"><strong>2.42M</strong></td><td style="padding:7px 12px;">~7 h</td>
</tr></tbody>
</table>
</div>

**KAN U-Net égale le Dice moyen de Swin UNETR (0,869) avec 26× moins de paramètres.** Le Transformer avait besoin de 62 millions de paramètres et de 17 heures d'entraînement. Celui-ci y est arrivé avec 2,42 millions, en une fraction du temps.

---

### KAN 3D U-Net (modèle 5, ablation)

Une chose me travaillait. L'architecture U-KABS (KAN U-Net) diffère du 3D U-Net par bien plus que ses activations. Elle utilise aussi une seule convolution par niveau, un bottleneck en profondeur et une attention par canal SE. Donc même si U-KABS fonctionne bien, on ne peut pas attribuer proprement ce résultat aux activations KAN. Pour trancher, j'ai mené une ablation contrôlée sur **exactement la même architecture 3D U-Net**, avec pour seul changement le remplacement des deux activations LeakyReLU du bottleneck par des activations KAN (Bernstein + B-spline). Chaque bloc de l'encodeur, chaque bloc du décodeur, chaque skip connection reste inchangé. Seule la fonction d'activation du bottleneck diffère.

On obtient ainsi une ablation propre, une seule variable modifiée et tout le reste identique.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Région</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Moyenne</th><th style="padding:7px 12px;">Paramètres</th><th style="padding:7px 12px;">Entraînement</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.879</td><td style="padding:7px 12px;">0.885</td><td style="padding:7px 12px;">0.869</td><td style="padding:7px 12px;"><strong>0.878</strong></td><td style="padding:7px 12px;">22.59M</td><td style="padding:7px 12px;">~7 h</td>
</tr></tbody>
</table>
</div>

Le score TC de **0,885 bat de peu l'Attention U-Net (0,884)**, le modèle précisément conçu pour améliorer TC grâce à ses portes apprises. Il me faudrait plusieurs graines pour être sûr que l'amélioration moyenne de 0,004 est un vrai signal et pas du bruit, mais la tendance est constante. Ce qui est clair, c'est que des activations KAN au bottleneck ne font pas de mal, et pourraient apporter un léger gain à la couche la plus complexe sémantiquement du réseau.

---

## Synthèse des résultats

*Trié par Dice moyen (décroissant). Tous les modèles : GTX 1070 Ti, 150 cas d'entraînement sur 1 251, pipeline identique.*

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.9em;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:8px 12px; text-align:left;">Modèle</th>
  <th style="padding:8px 12px; text-align:center;">WT</th>
  <th style="padding:8px 12px; text-align:center;">TC</th>
  <th style="padding:8px 12px; text-align:center;">ET</th>
  <th style="padding:8px 12px; text-align:center;">Moyenne</th>
  <th style="padding:8px 12px; text-align:center;">Paramètres</th>
  <th style="padding:8px 12px; text-align:center; white-space:nowrap;">Entraînement</th>
  <th style="padding:8px 12px; text-align:left;">Remarques</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 12px; font-weight:600;">Attention U-Net</td><td style="padding:8px 12px; text-align:center;"><strong>0.886</strong></td><td style="padding:8px 12px; text-align:center;"><strong>0.884</strong></td><td style="padding:8px 12px; text-align:center;"><strong>0.875</strong></td><td style="padding:8px 12px; text-align:center;"><strong>0.882</strong></td><td style="padding:8px 12px; text-align:center;">22.66M</td><td style="padding:8px 12px; text-align:center;">~7 h</td><td style="padding:8px 12px; font-size:0.88em;">Meilleur au global, TC et ET battent les résultats publiés sur données complètes</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 12px;">KAN 3D U-Net</td><td style="padding:8px 12px; text-align:center;">0.879</td><td style="padding:8px 12px; text-align:center;"><strong>0.885</strong></td><td style="padding:8px 12px; text-align:center;">0.869</td><td style="padding:8px 12px; text-align:center;">0.878</td><td style="padding:8px 12px; text-align:center;">22.59M</td><td style="padding:8px 12px; text-align:center;">~7 h</td><td style="padding:8px 12px; font-size:0.88em;">Ablation, KAN au bottleneck uniquement, TC bat l'Attention U-Net</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 12px;">3D U-Net</td><td style="padding:8px 12px; text-align:center;">0.876</td><td style="padding:8px 12px; text-align:center;">0.877</td><td style="padding:8px 12px; text-align:center;">0.869</td><td style="padding:8px 12px; text-align:center;">0.874</td><td style="padding:8px 12px; text-align:center;">22.58M</td><td style="padding:8px 12px; text-align:center;">~7 h</td><td style="padding:8px 12px; font-size:0.88em;">Référence</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 12px;">Swin UNETR</td><td style="padding:8px 12px; text-align:center;">0.882</td><td style="padding:8px 12px; text-align:center;">0.863</td><td style="padding:8px 12px; text-align:center;">0.862</td><td style="padding:8px 12px; text-align:center;">0.869</td><td style="padding:8px 12px; text-align:center;">62.19M</td><td style="padding:8px 12px; text-align:center;">~17 h</td><td style="padding:8px 12px; font-size:0.88em;">Battu par un CNN malgré 2,7× plus de paramètres</td></tr>
<tr><td style="padding:8px 12px; font-weight:600;">KAN U-Net</td><td style="padding:8px 12px; text-align:center;">0.878</td><td style="padding:8px 12px; text-align:center;">0.873</td><td style="padding:8px 12px; text-align:center;">0.856</td><td style="padding:8px 12px; text-align:center;"><strong>0.869</strong></td><td style="padding:8px 12px; text-align:center;"><strong>2.42M</strong></td><td style="padding:8px 12px; text-align:center;">~7 h</td><td style="padding:8px 12px; font-size:0.88em;">Égale le Transformer avec 26× moins de paramètres</td></tr>
</tbody>
</table>
</div>

Tous les modèles ont été entraînés sur les mêmes **150 cas sur 1 251**, sur une GTX 1070 Ti, avec des pipelines d'entraînement identiques. Ce sont les comparaisons entre architectures qui comptent ici. Les scores absolus sont en dessous des résultats publiés sur le jeu complet, mais c'est une question de volume de données, pas d'architecture.

---

## Comparer deux modèles au choix

Choisissez les prédictions à placer de chaque côté du séparateur, puis faites glisser la ligne pour révéler l'une sous l'autre.

<style>
#mcw { font-family: 'Inter','Segoe UI',system-ui,sans-serif; user-select: none; }
#mcw .mcw-selectors {
  display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;
}
#mcw .mcw-group {
  flex: 1; min-width: 220px;
  background: rgba(0,0,0,0.18); border-radius: 8px; padding: 8px 10px;
  border: 1px solid var(--global-divider-color, #ddd);
}
#mcw .mcw-group-label {
  font-size: 10px; font-weight: 700; letter-spacing: .6px;
  color: #888; margin-bottom: 6px; text-transform: uppercase;
}
#mcw .mcw-btns { display: flex; flex-wrap: wrap; gap: 5px; }
#mcw .mcw-btn {
  font-size: 11px; padding: 4px 10px; border-radius: 5px; cursor: pointer;
  border: 1px solid var(--global-divider-color, #ccc);
  background: transparent; color: var(--global-text-color, #333);
  transition: background .15s, color .15s, border-color .15s;
}
#mcw .mcw-btn:hover { border-color: var(--global-theme-color, #666); }
#mcw .mcw-btn.active-left  { background: #4C78A8; color: #fff; border-color: #4C78A8; }
#mcw .mcw-btn.active-right { background: #E45756; color: #fff; border-color: #E45756; }
#mcw .mcw-viewer {
  position: relative; border-radius: 8px; overflow: hidden;
  line-height: 0; cursor: col-resize; touch-action: pan-y;
}
#mcw .mcw-img-base  { display: block; width: 100%; height: auto; }
#mcw .mcw-img-top   {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  clip-path: inset(0 50% 0 0);
}
#mcw .mcw-divider {
  position: absolute; top: 0; bottom: 0; left: 50%;
  width: 3px; background: rgba(255,255,255,0.85);
  transform: translateX(-50%); pointer-events: none;
  display: flex; align-items: center; justify-content: center;
}
#mcw .mcw-handle {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(255,255,255,0.9); display: flex;
  align-items: center; justify-content: center;
  font-size: 13px; color: #111; font-weight: 900; flex-shrink: 0;
}
#mcw .mcw-lbl {
  position: absolute; top: 8px;
  background: rgba(0,0,0,0.62); color: #ddd;
  font-size: 10px; font-weight: 700; padding: 2px 8px; line-height: 1.5;
  border-radius: 3px; pointer-events: none; transition: opacity .15s;
}
#mcw .mcw-lbl-l { left: 8px; }
#mcw .mcw-lbl-r { right: 8px; }
#mcw .mcw-legend {
  display: flex; justify-content: center; gap: 18px;
  margin-top: 8px; flex-wrap: wrap;
}
#mcw .mcw-legend span {
  font-size: 10px; color: #888; display: flex; align-items: center; gap: 5px;
}
#mcw .mcw-swatch {
  width: 9px; height: 9px; border-radius: 2px; display: inline-block;
}
</style>

<div id="mcw">
  <div class="mcw-selectors">
    <div class="mcw-group">
      <div class="mcw-group-label" style="color:#4C78A8;">◀ Panneau gauche</div>
      <div class="mcw-btns" id="mcw-left-btns">
        <button class="mcw-btn active-left" data-key="gt">Vérité terrain</button>
        <button class="mcw-btn" data-key="unet3d">3D U-Net</button>
        <button class="mcw-btn" data-key="attn">Attention U-Net</button>
        <button class="mcw-btn" data-key="swin">Swin UNETR</button>
        <button class="mcw-btn" data-key="kan">KAN U-Net</button>
        <button class="mcw-btn" data-key="kanfull">KAN 3D U-Net</button>
      </div>
    </div>
    <div class="mcw-group">
      <div class="mcw-group-label" style="color:#E45756;">Panneau droit ▶</div>
      <div class="mcw-btns" id="mcw-right-btns">
        <button class="mcw-btn" data-key="gt">Vérité terrain</button>
        <button class="mcw-btn" data-key="unet3d">3D U-Net</button>
        <button class="mcw-btn active-right" data-key="attn">Attention U-Net</button>
        <button class="mcw-btn" data-key="swin">Swin UNETR</button>
        <button class="mcw-btn" data-key="kan">KAN U-Net</button>
        <button class="mcw-btn" data-key="kanfull">KAN 3D U-Net</button>
      </div>
    </div>
  </div>

  <div class="mcw-viewer" id="mcw-viewer">
    <img class="mcw-img-base" id="mcw-img-l" src="" alt="Panneau gauche" />
    <img class="mcw-img-top"  id="mcw-img-r" src="" alt="Panneau droit" />
    <div class="mcw-divider" id="mcw-div">
      <div class="mcw-handle">⟺</div>
    </div>
    <div class="mcw-lbl mcw-lbl-l" id="mcw-lbl-l">Vérité terrain</div>
    <div class="mcw-lbl mcw-lbl-r" id="mcw-lbl-r">Attention U-Net</div>
  </div>

  <div class="mcw-legend">
    <span><span class="mcw-swatch" style="background:rgb(255,51,51);"></span>NCR - cœur nécrotique</span>
    <span><span class="mcw-swatch" style="background:rgb(255,230,26);"></span>ED - œdème péritumoral</span>
    <span><span class="mcw-swatch" style="background:rgb(26,217,255);"></span>ET - tumeur rehaussée</span>
  </div>
</div>

<script>
(function () {
  var IMGS = {
    gt:       "/assets/img/brats_seg/overlay_gt.png",
    unet3d:   "/assets/img/brats_seg/overlay_unet3d.png",
    attn:     "/assets/img/brats_seg/overlay_attention_unet.png",
    swin:     "/assets/img/brats_seg/overlay_swin_unetr.png",
    kan:      "/assets/img/brats_seg/overlay_kan_unet.png",
    kanfull:  "/assets/img/brats_seg/overlay_kan_unet3d_full.png",
  };
  var LABELS = {
    gt: "Vérité terrain", unet3d: "3D U-Net",
    attn: "Attention U-Net", swin: "Swin UNETR",
    kan: "KAN U-Net", kanfull: "KAN 3D U-Net"
  };

  var state = { left: "gt", right: "attn", pct: 50, dragging: false };

  var viewer  = document.getElementById("mcw-viewer");
  var imgL    = document.getElementById("mcw-img-l");
  var imgR    = document.getElementById("mcw-img-r");
  var divEl   = document.getElementById("mcw-div");
  var lblL    = document.getElementById("mcw-lbl-l");
  var lblR    = document.getElementById("mcw-lbl-r");
  var btnsL   = document.getElementById("mcw-left-btns");
  var btnsR   = document.getElementById("mcw-right-btns");

  function render() {
    imgL.src = IMGS[state.left];
    imgR.src = IMGS[state.right];
    var p = state.pct;
    imgR.style.clipPath = "inset(0 " + (100 - p) + "% 0 0)";
    divEl.style.left    = p + "%";
    lblL.style.opacity  = p > 7  ? "1" : "0";
    lblR.style.opacity  = p < 93 ? "1" : "0";
    lblL.textContent    = LABELS[state.left];
    lblR.textContent    = LABELS[state.right];
  }

  function setPct(e) {
    var rect = viewer.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    state.pct = Math.max(2, Math.min(98, (x / rect.width) * 100));
    render();
  }

  viewer.addEventListener("mousedown",  function (e) { state.dragging = true; setPct(e); e.preventDefault(); });
  viewer.addEventListener("touchstart", function (e) { state.dragging = true; setPct(e); }, { passive: true });
  window.addEventListener("mousemove",  function (e) { if (state.dragging) setPct(e); });
  window.addEventListener("touchmove",  function (e) { if (state.dragging) setPct(e); }, { passive: true });
  window.addEventListener("mouseup",    function ()  { state.dragging = false; });
  window.addEventListener("touchend",   function ()  { state.dragging = false; });

  function setupBtns(container, side) {
    container.querySelectorAll(".mcw-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state[side] = btn.dataset.key;
        container.querySelectorAll(".mcw-btn").forEach(function (b) {
          b.classList.remove("active-left", "active-right");
        });
        btn.classList.add(side === "left" ? "active-left" : "active-right");
        render();
      });
    });
  }

  setupBtns(btnsL, "left");
  setupBtns(btnsR, "right");
  render();
})();
</script>
<p class="text-muted" style="font-size:0.82em; margin-top:0.4em;">
  Faites glisser le séparateur pour révéler une prédiction sous l'autre. Cas BraTS2021_01619, coupe axiale 67.
</p>

---

## Maillage 3D de la tumeur

Le masque de segmentation n'est pas qu'un contour 2D. C'est un volume 3D complet. En appliquant Marching Cubes à l'annotation de référence, chaque sous-région devient un maillage de surface triangulé. La coque grise translucide est la surface du cerveau lui-même, extraite de l'image FLAIR sans le crâne, pour donner une idée de l'emplacement anatomique de la tumeur et de sa taille par rapport aux tissus qui l'entourent.

Glissez pour faire pivoter, molette pour zoomer. Cliquez sur les éléments de la légende pour afficher ou masquer les régions.

<div style="position:relative; border-radius:8px; margin:0.5rem 0; overflow:hidden;">
  <iframe src="/assets/html/brats_seg/fr/tumor_mesh_3d.html"
          width="100%" height="580" frameborder="0" scrolling="no"
          style="border-radius:8px; display:block; background:rgb(13,13,20);"></iframe>
  <div id="mesh-hint" onclick="this.style.display='none'"
       style="position:absolute; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; cursor:pointer; border-radius:8px;">
    <div style="text-align:center; color:rgba(255,255,255,0.85); font-family:'Inter','Segoe UI',system-ui,sans-serif; pointer-events:none;">
      <div style="font-size:2em; margin-bottom:8px;">↺</div>
      <div style="font-weight:600; font-size:0.95em;">Cliquez et glissez pour faire pivoter</div>
      <div style="font-size:0.82em; margin-top:5px; color:rgba(255,255,255,0.55);">Molette pour zoomer · cliquez sur la légende pour afficher ou masquer les régions</div>
    </div>
  </div>
</div>
<p class="text-muted" style="font-size:0.82em; margin-top:0.2em;">
  Vérité terrain du cas BraTS2021_01619, rendue avec Marching Cubes. Surface du cerveau (pas de 5, 7k sommets) · NCR en rouge (3,9k sommets) · ED en jaune (10,2k sommets) · ET en cyan (7,8k sommets).
</p>

---

## Cartes d'activation des portes d'attention

L'un des avantages de l'Attention U-Net, c'est qu'il produit des sorties interprétables au-delà du masque de segmentation. Les portes d'attention génèrent une carte de poids spatiale à chaque niveau du décodeur. Des valeurs proches de 1 signifient que la porte est ouverte (ces features de l'encodeur passent), des valeurs proches de 0 qu'elles sont atténuées. Les zones claires sont celles sur lesquelles le modèle se concentre.

Elles ont été extraites en enregistrant des forward hooks sur chaque module `AttentionGate3d` pendant une seule passe avant sur un patch de 128³ centré sur la tumeur. Chaque image montre trois panneaux, la découpe FLAIR brute (à gauche), la carte d'activation de la porte (au centre) et la porte superposée à la FLAIR (à droite). Les trois panneaux sont alignés spatialement sur le même patch.

<!-- Lightbox for attention gate images -->
<div id="gate-lb" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.88); z-index:9999; align-items:center; justify-content:center; flex-direction:column;" onclick="gateLbClose(event)">
  <div style="position:absolute; top:16px; right:20px; color:rgba(255,255,255,0.7); font-size:1.5em; cursor:pointer; line-height:1;" onclick="gateLbClose({target:null})">✕</div>
  <div style="overflow:auto; max-width:94vw; max-height:88vh; display:flex; align-items:center; justify-content:center;">
    <img id="gate-lb-img" src="" alt="" style="max-width:none; display:block; transform-origin:top left; border-radius:4px; box-shadow:0 8px 40px rgba(0,0,0,0.5); cursor:zoom-in;" />
  </div>
  <p style="color:rgba(255,255,255,0.55); font-size:0.8em; margin-top:10px; pointer-events:none;">Cliquez sur l'image pour zoomer · cliquez à nouveau pour dézoomer · Échap ou clic à l'extérieur pour fermer</p>
</div>

<script>
(function () {
  var lb = document.getElementById('gate-lb');
  var img = document.getElementById('gate-lb-img');
  var zoom = 0;
  var steps = [1, 2, 4];
  window.gateLbOpen = function (el) {
    img.src = el.href;
    zoom = 0; img.style.transform = 'scale(1)'; img.style.cursor = 'zoom-in';
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };
  img.addEventListener('click', function (e) {
    e.stopPropagation();
    zoom = (zoom + 1) % steps.length;
    img.style.transform = 'scale(' + steps[zoom] + ')';
    img.style.cursor = zoom === steps.length - 1 ? 'zoom-out' : 'zoom-in';
  });
  window.gateLbClose = function (e) {
    if (!e.target || e.target !== img) {
      lb.style.display = 'none';
      document.body.style.overflow = '';
      zoom = 0; img.style.transform = 'scale(1)';
    }
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.gateLbClose({ target: null });
  });
})();
</script>

<div class="row">
  <div class="col-12 col-sm mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/attention_gate_1.png" onclick="gateLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/attention_gate_1.png" alt="Porte d'attention, niveau 1" loading="lazy" /><figcaption>Porte 1, niveau le plus profond (résolution 8³). Activation grossière et diffuse sur l'ensemble de la région tumorale.</figcaption></figure>
    </a>
  </div>
  <div class="col-12 col-sm mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/attention_gate_2.png" onclick="gateLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/attention_gate_2.png" alt="Porte d'attention, niveau 2" loading="lazy" /><figcaption>Porte 2. L'activation commence à se localiser autour du cœur tumoral et de l'œdème qui l'entoure.</figcaption></figure>
    </a>
  </div>
</div>
<div class="row">
  <div class="col-12 col-sm mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/attention_gate_3.png" onclick="gateLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/attention_gate_3.png" alt="Porte d'attention, niveau 3" loading="lazy" /><figcaption>Porte 3. Focalisation plus nette, qui commence à suivre plus précisément le contour de la tumeur.</figcaption></figure>
    </a>
  </div>
  <div class="col-12 col-sm mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/attention_gate_4.png" onclick="gateLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/attention_gate_4.png" alt="Porte d'attention, niveau 4" loading="lazy" /><figcaption>Porte 4, niveau le moins profond (résolution 128³). Activation fine, concentrée sur les bords de la tumeur et l'anneau rehaussé.</figcaption></figure>
    </a>
  </div>
</div>
<div class="caption">
  Cas BraTS2021_01619, coupe axiale 67 (le même cas et la même coupe que sur toute la page). Portes 1 à 4, de la plus profonde à la moins profonde. Ce passage du grossier au fin est le mécanisme derrière l'amélioration de l'Attention U-Net par rapport au simple 3D U-Net. Au lieu de transmettre toutes les features de l'encodeur par chaque skip connection, le décodeur amplifie de manière sélective celles qui sont pertinentes spatialement à chaque résolution. Cliquez sur une image pour zoomer.
</div>

---

## Carte d'incertitude (augmentation au moment du test)

Savoir *où* le modèle est confiant compte autant que la prédiction elle-même. Les cartes ci-dessous ont été produites avec l'**Attention U-Net**, le meilleur modèle de cette comparaison. Pour obtenir une estimation de confiance par voxel sans changer l'architecture, j'ai lancé l'inférence 8 fois, chaque fois avec une combinaison différente de retournements d'axes appliqués à l'entrée puis annulés sur la sortie. La moyenne de ces 8 prédictions donne un masque final plus robuste, et l'écart-type par voxel donne une carte d'incertitude.

L'intuition est simple. Si le modèle donne la même réponse quelle que soit l'orientation du cerveau, il est confiant. Si la réponse change avec l'orientation, quelque chose est ambigu à cet endroit.

**L'incertitude élevée (jaune-rouge vif) se concentre aux bords de la tumeur**, exactement là où un radiologue voudrait vérifier deux fois. La transition NCR/ED, où le cœur nécrotique rencontre l'œdème environnant, est systématiquement la région la plus incertaine d'un patient à l'autre.

<figure><img src="/assets/img/brats_seg/uncertainty_attention_unet.png" alt="Gauche : vérité terrain · Centre : prédiction moyenne TTA · Droite : incertitude (écart-type sur 8 passes augmentées)." loading="lazy" /><figcaption>Gauche : vérité terrain · Centre : prédiction moyenne TTA · Droite : incertitude (écart-type sur 8 passes augmentées). L'anneau clair sur les contours est l'endroit où le modèle est le moins sûr.</figcaption></figure>

---

## Graphiques interactifs

### Comparaison des modèles

<iframe src="/assets/html/brats_seg/fr/model_comparison.html"
        width="100%" height="580" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0;"></iframe>
<div class="caption">Score de Dice sur volume complet par région pour les cinq modèles (50 cas de validation, inférence par fenêtre glissante avec 50 % de recouvrement).</div>

### Graphique radar

<iframe src="/assets/html/brats_seg/fr/radar_comparison.html"
        width="100%" height="530" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0;"></iframe>
<div class="caption">Graphique radar (un triangle plus grand signifie de meilleures performances sur les trois régions tumorales à la fois).</div>

### Efficacité en paramètres

<iframe src="/assets/html/brats_seg/fr/params_vs_dice.html"
        width="100%" height="480" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0;"></iframe>
<div class="caption">Dice moyen en fonction du nombre de paramètres (échelle log). KAN U-Net est en bas à gauche (le moins de paramètres) avec le même Dice moyen que Swin UNETR (en haut à droite).</div>

### Courbes d'entraînement

Les courbes de Dice de validation sautent pas mal, et cela mérite une explication. Chaque passe de validation pendant l'entraînement tourne sur des patches aléatoires de 128³ (pas sur le cerveau entier). Avec seulement 50 cas de validation, une époque donnée peut tomber sur plus de régions de fond, ou au contraire attraper le bord de la tumeur rehaussée sur chaque cas, ce qui fait bouger le Dice global de quelques points dans un sens ou dans l'autre. C'est du bruit d'échantillonnage, pas de l'instabilité. Les chiffres finaux des tableaux de résultats sont une autre histoire. Ils viennent d'une inférence par fenêtre glissante sur le volume entier, qui lisse tout cela, et c'est pourquoi les scores rapportés sont à la fois plus stables et un peu plus élevés que ce que suggèrent les courbes en cours d'entraînement.

<style>
  /* the chart stacks its four panels on phones, so it needs a taller frame */
  @media (max-width: 575.98px) { .training-curves-frame { height: 1120px; } }
</style>
<iframe class="training-curves-frame" src="/assets/html/brats_seg/fr/training_curves.html"
        width="100%" height="630" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0;"></iframe>
<div class="caption">Loss et Dice par époque, depuis MLflow. Swin UNETR a la loss d'entraînement finale la plus basse (0,099), et pourtant il fait moins bien en évaluation sur volume complet (la signature classique du surapprentissage sur un petit jeu de données).</div>

---

## Schémas d'architecture

<!-- Lightbox overlay for architecture diagrams -->
<div id="arch-lb" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.88); z-index:9999; align-items:center; justify-content:center; flex-direction:column;" onclick="archLbClose(event)">
  <div style="position:absolute; top:16px; right:20px; color:rgba(255,255,255,0.7); font-size:1.5em; cursor:pointer; line-height:1;" onclick="archLbClose({target:null})">✕</div>
  <div style="overflow:auto; max-width:94vw; max-height:88vh; display:flex; align-items:center; justify-content:center;">
    <img id="arch-lb-img" src="" alt="" style="max-width:none; display:block; transform-origin:top left; border-radius:4px; box-shadow:0 8px 40px rgba(0,0,0,0.5); cursor:zoom-in;" />
  </div>
  <p style="color:rgba(255,255,255,0.55); font-size:0.8em; margin-top:10px; pointer-events:none;">Cliquez sur l'image pour zoomer · cliquez à nouveau pour dézoomer · Échap ou clic à l'extérieur pour fermer</p>
</div>

<script>
(function () {
  var lb = document.getElementById('arch-lb');
  var img = document.getElementById('arch-lb-img');
  var zoom = 1;
  var steps = [1, 2, 4];
  window.archLbOpen = function (el) {
    img.src = el.href;
    zoom = 0; img.style.transform = 'scale(1)'; img.style.cursor = 'zoom-in';
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };
  img.addEventListener('click', function (e) {
    e.stopPropagation();
    zoom = (zoom + 1) % steps.length;
    img.style.transform = 'scale(' + steps[zoom] + ')';
    img.style.cursor = zoom === steps.length - 1 ? 'zoom-out' : 'zoom-in';
  });
  window.archLbClose = function (e) {
    if (!e.target || e.target !== img) {
      lb.style.display = 'none';
      document.body.style.overflow = '';
      zoom = 0; img.style.transform = 'scale(1)';
    }
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.archLbClose({ target: null });
  });
})();
</script>

<div class="row mt-3">
  <div class="col-12 col-sm-6 mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/arch_unet3d.png" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/arch_unet3d.png" alt="3D U-Net" loading="lazy" /><figcaption>3D U-Net. Encodeur-décodeur avec skip connections.</figcaption></figure>
    </a>
  </div>
  <div class="col-12 col-sm-6 mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/arch_attention_unet3d.png" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/arch_attention_unet3d.png" alt="Attention U-Net" loading="lazy" /><figcaption>Attention U-Net. Nœuds de porte d'attention verts sur chaque skip connection.</figcaption></figure>
    </a>
  </div>
</div>
<div class="row mt-2">
  <div class="col-12 col-sm-6 mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/arch_swin_unetr.png" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/arch_swin_unetr.png" alt="Swin UNETR" loading="lazy" /><figcaption>Swin UNETR. Les étages Swin Transformer violets remplacent l'encodeur CNN.</figcaption></figure>
    </a>
  </div>
  <div class="col-12 col-sm-6 mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/arch_kan_unet3d.png" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/arch_kan_unet3d.png" alt="KAN U-Net (U-KABS)" loading="lazy" /><figcaption>KAN U-Net. Encodeur ConvSE mince, blocs KABS violets aux deux niveaux les plus profonds.</figcaption></figure>
    </a>
  </div>
</div>
<div class="row mt-2">
  <div class="col-12 col-sm-6 mt-3 mt-md-0">
    <a href="/assets/img/brats_seg/arch_kan_unet3d_full.png" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      <figure><img src="/assets/img/brats_seg/arch_kan_unet3d_full.png" alt="KAN 3D U-Net (ablation)" loading="lazy" /><figcaption>KAN 3D U-Net. Identique au 3D U-Net de référence, sauf le bloc violet du bottleneck qui utilise des activations KAN (Bernstein + B-spline) au lieu de LeakyReLU. Tout le reste est inchangé.</figcaption></figure>
    </a>
  </div>
</div>
<div class="caption">
  Les cinq architectures. Cliquez sur un schéma pour l'ouvrir en grand et zoomer. Légende des couleurs : jaune-orange = blocs DoubleConv standard  -  violet = opérations non standard (étages Swin Transformer ou activations KAN)  -  nœuds verts = portes d'attention  -  rouge foncé = MaxPool  -  turquoise = suréchantillonnage  -  arcs bleus = skip connections.
</div>

---

## Choix d'ingénierie

Quelques décisions qui ont façonné le déroulement du projet. Certaines étaient plutôt évidentes, d'autres moins.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">Cache de pré-traitement en npy</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">Charger du NIfTI avec nibabel est environ 100× plus lent que charger un tableau numpy. Comme chaque entraînement parcourt 150 cas par époque pendant 100 époques, ce surcoût s'accumule vite. Une passe de pré-traitement unique qui convertit tout en fichiers <code>.npy</code> en float16 fait passer le chargement des données par époque de quelques minutes à quelques millisecondes. C'est le genre de chose qui ressemble à un détail d'optimisation mais qui change vraiment ce qu'il est possible d'expérimenter.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">Patches de 128³, batch de 1, fp16</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">Un volume BraTS complet (240×240×155 sur 4 modalités) est très loin de tenir dans 8 Go de VRAM. La solution consiste à découper au hasard des patches de 128³ avec un échantillonnage biaisé vers le premier plan, pour que le modèle voie plus souvent du tissu tumoral que du fond. Un batch de 1 et la précision mixte fp16 (<code>torch.cuda.amp</code>) sont tous deux nécessaires pour rester dans la VRAM. Le GradScaler gère automatiquement le sous-dépassement des gradients en fp16.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">BCEDiceLoss (mélange 50/50)</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">La Dice loss seule est instable au début de l'entraînement. Quand toutes les prédictions sont proches de zéro à l'initialisation, le gradient s'annule presque. Y mélanger la BCE à parts égales donne un signal stable dès la première époque. Le ratio 50/50 est un point de départ classique pour BraTS et je n'ai pas trouvé de raison d'y toucher.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">AdamW (lr 1e-4, weight decay 1e-5)</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">Dans Adam classique, le weight decay est intégré à la mise à jour du gradient, ce qui fait varier la régularisation effective d'un paramètre à l'autre selon l'amplitude de son gradient. AdamW découple les deux, et pénalise chaque paramètre proportionnellement à sa propre amplitude, indépendamment du gradient. En pratique, cela généralise mieux, surtout pour de gros modèles comme Swin UNETR. Le même lr et le même weight decay sont utilisés pour les cinq modèles, sans réglage par architecture.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">Découpage train/val fixe (graine 42)</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">Les cinq modèles s'entraînent et sont évalués sur exactement le même découpage de 150/50 cas, généré une seule fois et enregistré dans <code>splits.json</code>. Sans cela, un seul tirage aléatoire heureux ou malheureux pourrait expliquer une différence de Dice de 0,003 entre deux modèles. Avec un découpage fixe, toute différence vient de l'architecture, pas de la loterie des données.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">MLflow (SQLite en local)</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">Tous les hyperparamètres et les métriques par époque sont enregistrés automatiquement dans une base SQLite locale. Aucun serveur nécessaire. Le graphique des courbes d'entraînement sur cette page vient directement de cette base. Les courbes sont un enregistrement littéral de ce qui s'est passé pendant l'entraînement, pas une reconstruction après coup.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">Activations KAN en fp32</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">L'évaluation des polynômes de Bernstein passe par le calcul de x⁴, qui perd assez de précision en fp16 pour déstabiliser l'entraînement. La passe avant KAN repasse en fp32 en interne, quel que soit le contexte AMP autour. Petit détail, mais il m'a fallu un moment pour le trouver.</p>
</div>

---

## Et ensuite

**Entraîner sur le jeu de données complet** est la suite la plus directe. WT est la région la plus sensible au volume de données, spatialement diffuse, et c'est là que l'écart avec l'état de l'art publié a le plus de chances de se réduire avec plus de cas. Tout le reste du pipeline est déjà en place. Il ne manque qu'un GPU avec plus de 8 Go de VRAM, et du temps.

**[CDA-Mamba](https://www.nature.com/articles/s41598-025-06462-3)** était la quatrième architecture prévue à l'origine, un modèle Mamba à attention croisée directionnelle qui remplace le coût quadratique de l'attention du Transformer par un balayage linéaire à espace d'états le long des trois axes du volume. J'ai dû le reporter parce que `mamba-ssm` n'a pas de wheels Windows officielles. C'est celui qui me rend le plus curieux. Si le problème de Swin UNETR était le surapprentissage sur peu de données, l'empreinte plus légère de Mamba, avec un contexte global, pourrait mieux s'en sortir dans ce régime.

**HD95** est en partie implémenté dans le code mais n'a jamais intégré l'évaluation finale. Cette métrique repère les cas où un modèle a un bon Dice mais des faux positifs éparpillés loin de la tumeur (la distance de surface au 95e centile entre prédiction et vérité terrain explose dans ces cas-là). Le terminer revient surtout à compléter l'implémentation et à relancer l'évaluation.

---

**Objectifs bonus**

**Le pipeline se généralise au-delà des tumeurs cérébrales.** Entraînement par patches, inférence par fenêtre glissante, évaluation du Dice multi-classes. Rien de tout cela n'est propre à BraTS. Toute tâche d'imagerie médicale 3D avec des séquences multimodales et un déséquilibre de classes similaire entre anatomie et fond s'y prête naturellement, et adapter le pipeline relèverait plus de la configuration que du code.

**L'inférence dans le navigateur** est l'objectif bonus auquel je reviens sans cesse. Avec 2,42M de paramètres, le KAN U-Net est assez petit pour être exporté en ONNX et tourner via `onnxruntime-web`, avec une inférence qui s'exécute dans le navigateur du visiteur sur un patch préchargé, sans aucun serveur. Cela transformerait cette page de résultats statique en quelque chose avec lequel on peut vraiment interagir.
