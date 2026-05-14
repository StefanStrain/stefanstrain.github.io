---
layout: page
title: 3D Brain Tumour Segmentation
description: Five deep learning architectures trained on 3D brain MRI scans, from a CNN baseline to a Transformer. A 2.4M-parameter model matched a 62M-parameter one. Everything built and benchmarked from scratch on a consumer GPU.
img: assets/img/brain_mri.jpg
importance: 1
category: medical
related_publications: false
tags: [Python, PyTorch, MONAI, Medical Imaging, 3D Segmentation, Transformers, MLflow]
---

## TL;DR

I trained and compared five 3D segmentation architectures on the **BraTS2021 brain MRI dataset**, starting from a CNN baseline and progressing through gated attention, a global Transformer, a 3D adaptation of a 2026 KAN hybrid paper (extended from 2D to volumetric inference), and a controlled KAN ablation. Every model was trained on a GTX 1070 Ti (8 GB VRAM) using only 150 of the available 1,251 training cases, a hardware constraint that turned out to produce some genuinely interesting results. I went in expecting the Transformer to dominate and left with a very different picture.

> **The headline finding:** A 22M-parameter CNN with attention gates outperformed a 62M-parameter Transformer. A 2.4M-parameter KAN hybrid then matched the Transformer at **26× fewer parameters**. And a controlled ablation (one variable changed, everything else identical) showed that swapping just the bottleneck activations for KAN splines narrowly beat the attention mechanism on the most clinically important metric, all while using 12% of the available data.

<a href="https://github.com/StefanStrain/brain_tumor_classifier" target="_blank" style="display:inline-block; margin-top:0.75rem; padding:7px 18px; border-radius:6px; font-size:0.93em; font-weight:600; background:var(--global-theme-color); color:#fff; text-decoration:none; letter-spacing:0.01em;">View on GitHub</a>

---

## The Problem

Brain tumours don't behave predictably. They're irregular in shape, vary enormously between patients and are comprised of different tissue sub-types including a necrotic core (**NCR**), a surrounding ring of oedema (**ED**) and a patch of actively growing enhancing tumour (**ET**). These tissue types all look different depending on which MRI sequence you're looking at. Radiologists usually delineate them by hand in a process that's slow and prone to include a bias that varies between clinicians.

Automating 3D segmentation is interesting because it feeds directly into clinical decisions: surgery planning, radiation targeting, and tracking whether a treatment is actually shrinking the tumour. Getting it right, and knowing where the model is uncertain are two very important aspects.

The challenge dataset defines **three clinically meaningful sub-regions**, each evaluated separately because they're used for different purposes:

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:8px 16px; text-align:left; font-weight:600;">Region</th>
  <th style="padding:8px 16px; text-align:left; font-weight:600;">Composed of</th>
  <th style="padding:8px 16px; text-align:left; font-weight:600;">Clinical use</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; white-space:nowrap;"><strong>WT</strong> — Whole Tumour</td><td style="padding:8px 16px;">NCR + ED + ET</td><td style="padding:8px 16px;">Surgery planning (how much tissue is affected)</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; white-space:nowrap;"><strong>TC</strong> — Tumour Core</td><td style="padding:8px 16px;">NCR + ET</td><td style="padding:8px 16px;">Core characterisation (the actively dangerous region)</td></tr>
<tr><td style="padding:8px 16px; white-space:nowrap;"><strong>ET</strong> — Enhancing Tumour</td><td style="padding:8px 16px;">ET only</td><td style="padding:8px 16px;">Treatment response (is the tumour actually shrinking?)</td></tr>
</tbody>
</table>
</div>

### **The Dice coefficient**

The primary metric is the **Dice coefficient**, which measures how well the model's prediction overlaps with the ground truth label drawn by an expert radiologist. It ranges from 0 (no overlap whatsoever) to 1 (perfect agreement).

If you think of two sets of highlighted voxels on a brain scan, a set of voxels the model predicts as tumour **P**, and a set the radiologist actually labelled as tumour **G**. The Dice coef. would give us the fraction of voxels that both **P** and **G** classify as a tumour, to be more precise: 

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:16px 20px; margin:1rem 0;">

$$\text{Dice}(P, G) = \frac{2|P \cap G|}{|P| + |G|}$$

<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.92em;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="text-align:left; padding:6px 10px; font-weight:600;">Term</th>
  <th style="text-align:left; padding:6px 10px; font-weight:600;">Meaning</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:6px 10px; white-space:nowrap;"><strong>|P ∩ G|</strong></td><td style="padding:6px 10px;">Voxels where both the model and the expert said "tumour" (the overlap)</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:6px 10px; white-space:nowrap;"><strong>|P|</strong></td><td style="padding:6px 10px;">How many voxels the model predicted as tumour</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:6px 10px; white-space:nowrap;"><strong>|G|</strong></td><td style="padding:6px 10px;">How many voxels the expert labelled as tumour</td></tr>
<tr><td style="padding:6px 10px; white-space:nowrap;"><strong>Factor of 2</strong></td><td style="padding:6px 10px;">Ensures a perfect prediction (P = G) scores 1 rather than 0.5</td></tr>
</tbody>
</table>
</div>

If the model predicts perfectly, $$P = G$$, the overlap equals both sets, and Dice = 1. If the model misses everything, the overlap is zero and Dice = 0. A model that marks *too much* as tumour gets penalised too: a large $$ \lvert P \rvert $$ inflates the denominator without helping the numerator.

A score of **0.88**, roughly what this project achieves, means the model's tumour outline agrees with the expert label about 88% of the time. As you'll see below, that puts it in competitive territory with models trained on the full 1,251-case dataset.

---

## Dataset & Hardware Reality

The [Brain Tumour Segmentation 2021 Challenge](http://braintumorsegmentation.org/) dataset has 1,251 pre-operative multi-parametric MRI scans, each with four aligned modalities and an expert-drawn voxel-level mask.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em;">
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; font-weight:600; white-space:nowrap; width:32%;">Cases</td><td style="padding:8px 16px;">1,251 patients</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; font-weight:600; white-space:nowrap;">Modalities</td><td style="padding:8px 16px;">FLAIR · T1 · T1CE · T2 (4 channels)</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; font-weight:600; white-space:nowrap;">Volume shape</td><td style="padding:8px 16px;">240 × 240 × 155 voxels, 1 mm isotropic</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 16px; font-weight:600; white-space:nowrap;">Labels</td><td style="padding:8px 16px;">0 (background) · 1 (NCR) · 2 (ED) · 4 (ET)</td></tr>
<tr><td style="padding:8px 16px; font-weight:600; white-space:nowrap;">Colour scheme</td><td style="padding:8px 16px;">NCR = red · ED = yellow · ET = cyan</td></tr>
</tbody>
</table>
</div>

### Why only 150 cases?

The honest answer is hardware. This project ran on a **GTX 1070 Ti**, a consumer GPU with 8 GB of VRAM and no Tensorcores. That's a real constraint when dealing with 3D medical volumes.

A single brain scan is 240×240×155 voxels across four modalities. Loading one full volume into GPU memory takes several gigabytes on its own; there's simply no way to run a full forward-backward pass on a complete brain at once. The workaround is **patch-based training**: randomly crop 128×128×128 sub-volumes and train on those instead, using MONAI's foreground-biased sampler to ensure the model sees tumour-containing patches more often than pure background.

Even with patches, training one model on all 1,251 cases would take several days of wall-clock time. With four architectures to compare, that's weeks, which isn't a realistic timeline for a personal project. Capping at **150 training cases and 50 validation cases** keeps each run to a manageable window while still being large enough to tell whether an architectural change is genuinely helping.

The same fixed split, generated once with a random seed and reused for every model, ensures the comparisons are fair. Any Dice difference is an architecture signal, not a data split artefact.

The practical rhythm was overnight training sessions: kick off a run before bed, check the numbers in the morning. The CNN models landed at roughly 7 hours each; Swin UNETR took 17. At one point I looked into renting cloud compute. For roughly the cost of a coffee you could run Swin UNETR on the full 1,251 cases on a V100 in a few hours. I decided against it. The point of the project was understanding the architectures and building the pipeline, not chasing the best possible number. That said, it's an easy upgrade path if I ever come back to it.

**What genuinely surprised me was how competitive the numbers ended up being.** The Attention U-Net's TC score of **0.884** came within 0.004 of the BraTS2021 challenge winner, which trained on the full 1,251 cases with serious compute. The ET score outright beats both the original Attention U-Net paper's published range *and* Swin UNETR's full-dataset results. I didn't expect that going in, and the pattern held across every model I trained. For this problem, at least in this data regime, architectural choices seem to matter as much as data volume.

---

## Segmentation Overlays

Drag the handle to compare **Ground Truth** (left) against the **Attention U-Net** prediction (right) on case BraTS2021_01619, axial slice 67 (a validation case with strong representation of all three tumour regions).

<script type="module" src="https://cdn.jsdelivr.net/npm/img-comparison-slider@8/dist/index.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/img-comparison-slider@8/dist/styles.css" />

<img-comparison-slider style="width:100%; --divider-width: 3px; --divider-color: rgba(255,255,255,0.85); border-radius: 8px; overflow: hidden; margin: 1rem 0;">
  <img slot="first"  src="{{ '/assets/img/brats_seg/overlay_gt.png' | relative_url }}"               alt="Ground truth segmentation" style="width:100%; display:block;" />
  <img slot="second" src="{{ '/assets/img/brats_seg/overlay_attention_unet.png' | relative_url }}"   alt="Attention U-Net prediction" style="width:100%; display:block;" />
</img-comparison-slider>
<div class="caption">
  <strong>Left:</strong> Ground truth &nbsp;·&nbsp; <strong>Right:</strong> Attention U-Net prediction &nbsp;·&nbsp;
  <span style="display:inline-block; width:10px; height:10px; background:rgb(255,51,51); border-radius:2px; vertical-align:middle;"></span> NCR &nbsp;
  <span style="display:inline-block; width:10px; height:10px; background:rgb(255,230,26); border-radius:2px; vertical-align:middle;"></span> ED &nbsp;
  <span style="display:inline-block; width:10px; height:10px; background:rgb(26,217,255); border-radius:2px; vertical-align:middle;"></span> ET
</div>

---

## Architecture Exploration

Rather than picking a single architecture and optimising it, I designed this as a progression. Each model was chosen to answer a specific question raised by the previous one's results. The story goes from local to global, and then back again.

<div style="max-width:480px; margin: 1.5rem 0; font-family:'Inter','Segoe UI',system-ui,sans-serif;">

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px;">
    <strong>3D U-Net</strong> <span style="color:#888; font-size:0.85em;">· CNN baseline</span>
  </div>

  <div style="padding:6px 0 6px 20px; color:#888; font-size:0.82em; line-height:1.3;">
    ↓ &nbsp;skip connections carry background noise into the decoder
  </div>

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px;">
    <strong>Attention U-Net</strong> <span style="color:#888; font-size:0.85em;">· gated skip connections</span>
  </div>

  <div style="padding:6px 0 6px 20px; color:#888; font-size:0.82em; line-height:1.3;">
    ↓ &nbsp;attention gates are local — the convolution itself still is
  </div>

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px;">
    <strong>Swin UNETR</strong> <span style="color:#888; font-size:0.85em;">· global Transformer, 62M params</span>
  </div>

  <div style="padding:6px 0 6px 20px; color:#888; font-size:0.82em; line-height:1.3;">
    ↓ &nbsp;too many parameters for 150 cases — overfits, beaten by the CNN
  </div>

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px;">
    <strong>KAN U-Net</strong> <span style="color:#888; font-size:0.85em;">· lightweight hybrid, 2.42M params</span>
  </div>

  <div style="padding:6px 0 6px 20px; color:#888; font-size:0.82em; line-height:1.3;">
    ↓ &nbsp;architecture has multiple differences from the baseline — hard to isolate KAN activations specifically
  </div>

  <div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:10px 16px;">
    <strong>KAN 3D U-Net</strong> <span style="color:#888; font-size:0.85em;">· ablation — KAN bottleneck only</span>
  </div>

</div>

### 3D U-Net (Model 1, CNN Baseline)

> *[Çiçek et al. 2016](https://arxiv.org/abs/1606.06650) — "3D U-Net: Learning Dense Volumetric Segmentation from Sparse Annotation"*

The starting point for almost any 3D medical segmentation task. An encoder compresses the volume down through four spatial levels (halving resolution each time via max-pooling), a bottleneck processes the most abstract features, and a decoder mirrors the encoder back up, with skip connections carrying fine-grained spatial detail from each encoder level to the corresponding decoder level.

Building this first was important for a reason beyond the Dice score. It establishes the full training pipeline that every later model inherits unchanged. The patch sampler, the sliding-window inference, the BraTS metrics, the MLflow logging. All comparisons are relative to this foundation.

**Where it falls short:** A 3×3×3 convolution kernel sees 27 neighbouring voxels at a time. That's fine for local texture and edges, but brain tumours have long-range spatial structure. The shape of the enhancing tumour rim on one side relates to the necrotic core on the other. Without many stacked layers, the model can't reason across that distance. And the skip connections pass *everything* from encoder to decoder, including background activations that push the decoder toward over-segmenting.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Region</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Mean</th><th style="padding:7px 12px;">Train time</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.876</td><td style="padding:7px 12px;">0.877</td><td style="padding:7px 12px;">0.869</td><td style="padding:7px 12px;">0.874</td><td style="padding:7px 12px;">~7 hrs</td>
</tr></tbody>
</table>
</div>

---

### Attention U-Net (Model 2)

> *[Oktay et al. 2018](https://arxiv.org/abs/1804.03999) — "Attention U-Net: Learning Where to Look for the Pancreas"*

Before abandoning convolutions entirely, can we make the skip connections smarter? The Attention U-Net keeps the same encoder-decoder structure but adds a **gating mechanism** to each skip connection. Before encoder features get concatenated into the decoder, they pass through an attention gate that learns a spatial soft-mask, amplifying activations in tumour-like regions and suppressing them in background.

The gate is learned entirely from the segmentation loss with no extra supervision. The decoder generates a gating signal at each resolution level and compares it to the encoder's features. Where they agree (this looks like tumour), the gate opens. Where they don't, it closes.

$$\alpha = \sigma\!\left(W_\psi \cdot \text{ReLU}(W_g \cdot g + W_x \cdot x + b_g)\right)$$

This is the mechanism visualised in the attention heatmaps further down the page.

ET was the region I expected to benefit most. It's compact, has irregular boundaries, and is hardest to distinguish from surrounding tissue. The results confirmed what I expected.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Region</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Mean</th><th style="padding:7px 12px;">Params</th><th style="padding:7px 12px;">Train time</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.886</td><td style="padding:7px 12px;">0.884</td><td style="padding:7px 12px;">0.875</td><td style="padding:7px 12px;"><strong>0.882</strong></td><td style="padding:7px 12px;">22.66M</td><td style="padding:7px 12px;">~7 hrs</td>
</tr></tbody>
</table>
</div>

**How this compares to published results (all trained on the full 1,251 cases):**

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;"></th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:7px 12px; text-align:left; font-weight:600;">Ours — 150 cases</td><td style="padding:7px 12px;"><strong>0.886</strong></td><td style="padding:7px 12px;"><strong>0.884</strong></td><td style="padding:7px 12px;"><strong>0.875</strong></td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:7px 12px; text-align:left;">Published Attention U-Net (Oktay 2018)</td><td style="padding:7px 12px;">0.88–0.90</td><td style="padding:7px 12px;">0.82–0.87</td><td style="padding:7px 12px;">0.78–0.83</td></tr>
<tr><td style="padding:7px 12px; text-align:left;">BraTS2021 challenge winner (nnU-Net)</td><td style="padding:7px 12px;">0.932</td><td style="padding:7px 12px;">0.888</td><td style="padding:7px 12px;">0.884</td></tr>
</tbody>
</table>
</div>

TC and ET both beat the original paper's published range, on 12% of the data. TC is within 0.004 of the BraTS2021 challenge winner.

---

### Swin UNETR (Model 3)

> *[Hatamizadeh et al. 2022](https://arxiv.org/abs/2201.01266) — "Swin UNETR: Swin Transformers for Semantic Segmentation of Brain Tumors in MRI Images"*

Attention gates help, but they still operate on convolutional features. The locality constraint is baked into the convolution itself, not just the skip connections. The natural next question is what happens if we replace convolutions with a mechanism that has no locality constraint at all.

Swin UNETR does exactly that. It tokenises the 3D volume into small patches and passes them through a hierarchical Swin Transformer encoder, where every token attends to every other token within its local window and those windows shift between layers to allow global context to accumulate. A voxel near the front of the brain can, in principle, directly influence predictions near the back. The decoder stays CNN-based, keeping the upsampling path efficient.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Region</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Mean</th><th style="padding:7px 12px;">Params</th><th style="padding:7px 12px;">Train time</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.882</td><td style="padding:7px 12px;">0.863</td><td style="padding:7px 12px;">0.862</td><td style="padding:7px 12px;">0.869</td><td style="padding:7px 12px;"><strong>62.19M</strong></td><td style="padding:7px 12px;">~17 hrs</td>
</tr></tbody>
</table>
</div>

**Swin UNETR lost to the Attention U-Net (0.869 vs 0.882 mean Dice) despite having 2.7× more parameters and taking roughly 17 hours to train.**

This was the result I found most interesting, and honestly the one I hadn't predicted going in. I expected the Transformer to at least match the CNN at full-volume evaluation, given that it clearly did better at the patch level (0.855 vs 0.834). It didn't. Looking back, three things were compounding each other. Sixty-two million parameters on 150 cases is a bad mismatch from the start (the gap between patch-level validation and full-volume evaluation is the textbook sign of memorising patch patterns rather than generalising). And the patch training specifically undermined the thing that was supposed to make Swin UNETR worth the extra cost. It was trained on 128³ crops and never once saw a complete brain, so the attention mechanism designed for global context never actually got global context to work with. On top of that, CNNs have a built-in spatial locality prior that turns out to be a useful assumption for medical images, and it generalises well from limited examples in a way that Transformers, which learn spatial structure from scratch, simply don't.

**More parameters and global attention don't automatically mean better results. With limited data, a well-designed CNN with targeted attention outperforms a 4× larger Transformer.**

---

### KAN U-Net (Model 4, 3D U-KABS)

> *[Liu et al. 2024](https://arxiv.org/abs/2404.19756) — "KAN: Kolmogorov-Arnold Networks" (ICLR 2025)*<br>
> *[arXiv:2602.07702](https://arxiv.org/abs/2602.07702) — "A hybrid Kolmogorov-Arnold network for medical image segmentation"*

Swin UNETR's result reframes the whole question. If a bigger, more powerful model failed because it had too many parameters for the available data, what happens if we go in the opposite direction? How small can we make the model before performance collapses?

Originally, the plan was to implement CDA-Mamba here (a recent state-space model that seemed like a natural successor to Swin UNETR, replacing the Transformer's quadratic attention cost with linear state-space scanning). I hit a wall. `mamba-ssm` has no official Windows wheels, and getting it to compile from source against the right CUDA version was not a quick afternoon. Rather than spend days fighting the environment, I switched to KAN U-Net, a 2026 paper, also recent, also non-standard, and pure PyTorch with no exotic dependencies. In hindsight that pivot worked out well, because the KAN result turned out to be the most interesting one in the whole project.

KAN U-Net is the experiment that tests the lightweight direction. It's a 3D U-Net backbone where the standard activations at the two deepest spatial levels are replaced with **KAN (Kolmogorov-Arnold Network) activations**, learnable spline functions rather than fixed nonlinearities. The rest of the architecture stays slim, with a single convolution per level, a depth-wise separable bottleneck, and squeeze-and-excitation channel attention. Total parameter count is **2.42M**.

The key idea behind KANs is that in a standard network, the weights are learnable scalars and the activations (ReLU, GELU) are fixed. KANs flip this. The activations themselves are learnable curves (B-splines and Bernstein polynomials), grounded in the Kolmogorov-Arnold representation theorem, which says any continuous function can be expressed as compositions of univariate functions. Two activation types are used per block. **KAB (Bernstein)** activations are globally smooth polynomials, suited for capturing broad tumour structure. **KAS (B-spline)** activations are locally adaptive, better suited for fine-grained boundary features.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Region</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Mean</th><th style="padding:7px 12px;">Params</th><th style="padding:7px 12px;">Train time</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.878</td><td style="padding:7px 12px;">0.873</td><td style="padding:7px 12px;">0.856</td><td style="padding:7px 12px;"><strong>0.869</strong></td><td style="padding:7px 12px;"><strong>2.42M</strong></td><td style="padding:7px 12px;">~7 hrs</td>
</tr></tbody>
</table>
</div>

**KAN U-Net ties Swin UNETR's mean Dice (0.869) at 26× fewer parameters.** The Transformer needed 62 million parameters and 17 hours of training; this got there with 2.42 million in a fraction of the time.

---

### KAN 3D U-Net (Model 5, Ablation)

Something that had been nagging at me was that the U-KABS architecture (KAN U-Net) differs from the 3D U-Net in more than just its activations. It also uses single convolutions per level, a depth-wise bottleneck, and SE channel attention. So even if U-KABS performs well, you can't cleanly attribute that to the KAN activations specifically. To settle the question, I ran a controlled ablation using the **exact same 3D U-Net architecture**, with the single change of replacing the two LeakyReLU activations in the bottleneck with KAN activations (Bernstein + B-spline). Every encoder block, every decoder block, every skip connection, unchanged. Only the bottleneck activation function differs.

One variable. Everything else identical.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0;">
<table style="width:100%; border-collapse:collapse; font-size:0.92em; text-align:center;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:7px 12px; text-align:left;">Region</th>
  <th style="padding:7px 12px;">WT</th><th style="padding:7px 12px;">TC</th><th style="padding:7px 12px;">ET</th><th style="padding:7px 12px;">Mean</th><th style="padding:7px 12px;">Params</th><th style="padding:7px 12px;">Train time</th>
</tr></thead>
<tbody><tr>
  <td style="padding:7px 12px; text-align:left; font-weight:600;">Dice</td>
  <td style="padding:7px 12px;">0.879</td><td style="padding:7px 12px;">0.885</td><td style="padding:7px 12px;">0.869</td><td style="padding:7px 12px;"><strong>0.878</strong></td><td style="padding:7px 12px;">22.59M</td><td style="padding:7px 12px;">~7 hrs</td>
</tr></tbody>
</table>
</div>

The TC score of **0.885 narrowly beats the Attention U-Net (0.884)**, the model specifically designed to improve TC through learned gating. I'd need multiple seeds to be sure the 0.004 mean improvement is a real signal rather than noise, but the direction is consistent. What's clear is that KAN activations at the bottleneck don't hurt, and might give a modest benefit at the most semantically complex layer of the network.

---

## Results Summary

*Sorted by mean Dice (descending). All models: GTX 1070 Ti, 150/1,251 training cases, identical pipeline.*

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:4px 0; margin:1rem 0; overflow-x:auto;">
<table style="width:100%; border-collapse:collapse; font-size:0.9em;">
<thead><tr style="border-bottom:1px solid var(--global-divider-color,#ddd);">
  <th style="padding:8px 12px; text-align:left;">Model</th>
  <th style="padding:8px 12px; text-align:center;">WT</th>
  <th style="padding:8px 12px; text-align:center;">TC</th>
  <th style="padding:8px 12px; text-align:center;">ET</th>
  <th style="padding:8px 12px; text-align:center;">Mean</th>
  <th style="padding:8px 12px; text-align:center;">Params</th>
  <th style="padding:8px 12px; text-align:center; white-space:nowrap;">Train time</th>
  <th style="padding:8px 12px; text-align:left;">Notes</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 12px; font-weight:600;">Attention U-Net</td><td style="padding:8px 12px; text-align:center;"><strong>0.886</strong></td><td style="padding:8px 12px; text-align:center;"><strong>0.884</strong></td><td style="padding:8px 12px; text-align:center;"><strong>0.875</strong></td><td style="padding:8px 12px; text-align:center;"><strong>0.882</strong></td><td style="padding:8px 12px; text-align:center;">22.66M</td><td style="padding:8px 12px; text-align:center;">~7 hrs</td><td style="padding:8px 12px; font-size:0.88em;">Best overall; TC and ET beat published full-data results</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 12px;">KAN 3D U-Net</td><td style="padding:8px 12px; text-align:center;">0.879</td><td style="padding:8px 12px; text-align:center;"><strong>0.885</strong></td><td style="padding:8px 12px; text-align:center;">0.869</td><td style="padding:8px 12px; text-align:center;">0.878</td><td style="padding:8px 12px; text-align:center;">22.59M</td><td style="padding:8px 12px; text-align:center;">~7 hrs</td><td style="padding:8px 12px; font-size:0.88em;">Ablation: KAN bottleneck only; TC beats Attention U-Net</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 12px;">3D U-Net</td><td style="padding:8px 12px; text-align:center;">0.876</td><td style="padding:8px 12px; text-align:center;">0.877</td><td style="padding:8px 12px; text-align:center;">0.869</td><td style="padding:8px 12px; text-align:center;">0.874</td><td style="padding:8px 12px; text-align:center;">22.58M</td><td style="padding:8px 12px; text-align:center;">~7 hrs</td><td style="padding:8px 12px; font-size:0.88em;">Baseline</td></tr>
<tr style="border-bottom:1px solid var(--global-divider-color,#eee);"><td style="padding:8px 12px;">Swin UNETR</td><td style="padding:8px 12px; text-align:center;">0.882</td><td style="padding:8px 12px; text-align:center;">0.863</td><td style="padding:8px 12px; text-align:center;">0.862</td><td style="padding:8px 12px; text-align:center;">0.869</td><td style="padding:8px 12px; text-align:center;">62.19M</td><td style="padding:8px 12px; text-align:center;">~17 hrs</td><td style="padding:8px 12px; font-size:0.88em;">Beaten by CNN despite 2.7× more params</td></tr>
<tr><td style="padding:8px 12px; font-weight:600;">KAN U-Net</td><td style="padding:8px 12px; text-align:center;">0.878</td><td style="padding:8px 12px; text-align:center;">0.873</td><td style="padding:8px 12px; text-align:center;">0.856</td><td style="padding:8px 12px; text-align:center;"><strong>0.869</strong></td><td style="padding:8px 12px; text-align:center;"><strong>2.42M</strong></td><td style="padding:8px 12px; text-align:center;">~7 hrs</td><td style="padding:8px 12px; font-size:0.88em;">Ties Transformer at 26× fewer params</td></tr>
</tbody>
</table>
</div>

All models trained on the same **150 of 1,251 cases**, on a GTX 1070 Ti, using identical training pipelines. The comparisons between architectures are what matter here. Absolute scores are below full-dataset published results, but that's a data volume issue, not an architecture one.

---

## Compare Any Two Models

Pick which predictions to put on each side of the divider, then drag the line to reveal one under the other.

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
  font-size: 10px; font-weight: 700; padding: 2px 8px;
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
      <div class="mcw-group-label" style="color:#4C78A8;">◀ Left panel</div>
      <div class="mcw-btns" id="mcw-left-btns">
        <button class="mcw-btn active-left" data-key="gt">Ground Truth</button>
        <button class="mcw-btn" data-key="unet3d">3D U-Net</button>
        <button class="mcw-btn" data-key="attn">Attention U-Net</button>
        <button class="mcw-btn" data-key="swin">Swin UNETR</button>
        <button class="mcw-btn" data-key="kan">KAN U-Net</button>
        <button class="mcw-btn" data-key="kanfull">KAN 3D U-Net</button>
      </div>
    </div>
    <div class="mcw-group">
      <div class="mcw-group-label" style="color:#E45756;">Right panel ▶</div>
      <div class="mcw-btns" id="mcw-right-btns">
        <button class="mcw-btn" data-key="gt">Ground Truth</button>
        <button class="mcw-btn" data-key="unet3d">3D U-Net</button>
        <button class="mcw-btn active-right" data-key="attn">Attention U-Net</button>
        <button class="mcw-btn" data-key="swin">Swin UNETR</button>
        <button class="mcw-btn" data-key="kan">KAN U-Net</button>
        <button class="mcw-btn" data-key="kanfull">KAN 3D U-Net</button>
      </div>
    </div>
  </div>

  <div class="mcw-viewer" id="mcw-viewer">
    <img class="mcw-img-base" id="mcw-img-l" src="" alt="Left panel" />
    <img class="mcw-img-top"  id="mcw-img-r" src="" alt="Right panel" />
    <div class="mcw-divider" id="mcw-div">
      <div class="mcw-handle">⟺</div>
    </div>
    <div class="mcw-lbl mcw-lbl-l" id="mcw-lbl-l">Ground Truth</div>
    <div class="mcw-lbl mcw-lbl-r" id="mcw-lbl-r">Attention U-Net</div>
  </div>

  <div class="mcw-legend">
    <span><span class="mcw-swatch" style="background:rgb(255,51,51);"></span>NCR — necrotic core</span>
    <span><span class="mcw-swatch" style="background:rgb(255,230,26);"></span>ED — peritumoral oedema</span>
    <span><span class="mcw-swatch" style="background:rgb(26,217,255);"></span>ET — enhancing tumour</span>
  </div>
</div>

<script>
(function () {
  var IMGS = {
    gt:       "{{ '/assets/img/brats_seg/overlay_gt.png'               | relative_url }}",
    unet3d:   "{{ '/assets/img/brats_seg/overlay_unet3d.png'           | relative_url }}",
    attn:     "{{ '/assets/img/brats_seg/overlay_attention_unet.png'   | relative_url }}",
    swin:     "{{ '/assets/img/brats_seg/overlay_swin_unetr.png'       | relative_url }}",
    kan:      "{{ '/assets/img/brats_seg/overlay_kan_unet.png'         | relative_url }}",
    kanfull:  "{{ '/assets/img/brats_seg/overlay_kan_unet3d_full.png'  | relative_url }}",
  };
  var LABELS = {
    gt: "Ground Truth", unet3d: "3D U-Net",
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
  Drag the divider to reveal one prediction under the other. Case BraTS2021_01619, axial slice 67.
</p>

---

## 3D Tumour Mesh

The segmentation mask isn't just a 2D outline. It's a full 3D volume. Running Marching Cubes on the ground truth label converts each sub-region into a triangulated surface mesh. The translucent grey shell is the brain surface itself, extracted from the skull-stripped FLAIR image, giving a sense of where the tumour sits anatomically and how large it is relative to the surrounding tissue.

Drag to rotate, scroll to zoom. Click legend entries to toggle regions on and off.

<iframe src="{{ '/assets/html/brats_seg/tumor_mesh_3d.html' | relative_url }}"
        width="100%" height="580" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0; background:rgb(13,13,20);"></iframe>
<p class="text-muted" style="font-size:0.82em; margin-top:0.2em;">
  Case BraTS2021_01619 ground truth, rendered with Marching Cubes. Brain surface (step size 5, 7k verts) · NCR red (3.9k verts) · ED yellow (10.2k verts) · ET cyan (7.8k verts).
</p>

---

## Attention Gate Heatmaps

One of the nicer things about the Attention U-Net is that it produces interpretable outputs beyond the segmentation mask. The attention gates generate a spatial weight map at each decoder level. Values close to 1 mean the gate is open (these encoder features get passed through); values close to 0 mean they're suppressed. Bright regions are where the model is focusing.

These were extracted by registering forward hooks on each `AttentionGate3d` module during a single forward pass on a tumour-centred 128³ patch. Each image shows three panels: the raw FLAIR crop (left), the gate activation heatmap (centre), and the gate overlaid on FLAIR (right). All three panels are spatially aligned to the same patch.

<!-- Lightbox for attention gate images -->
<div id="gate-lb" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.88); z-index:9999; align-items:center; justify-content:center; flex-direction:column;" onclick="gateLbClose(event)">
  <div style="position:absolute; top:16px; right:20px; color:rgba(255,255,255,0.7); font-size:1.5em; cursor:pointer; line-height:1;" onclick="gateLbClose({target:null})">✕</div>
  <div style="overflow:auto; max-width:94vw; max-height:88vh; display:flex; align-items:center; justify-content:center;">
    <img id="gate-lb-img" src="" alt="" style="max-width:none; display:block; transform-origin:top left; border-radius:4px; box-shadow:0 8px 40px rgba(0,0,0,0.5); cursor:zoom-in;" />
  </div>
  <p style="color:rgba(255,255,255,0.55); font-size:0.8em; margin-top:10px; pointer-events:none;">Click image to zoom in · click again to zoom out · Esc or click outside to close</p>
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
  <div class="col-sm mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/attention_gate_1.png' | relative_url }}" onclick="gateLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/attention_gate_1.png" title="Attention Gate Level 1" class="img-fluid rounded z-depth-1" caption="Gate 1 — deepest level (8³ resolution). Coarse, diffuse activation over the broad tumour region." %}
    </a>
  </div>
  <div class="col-sm mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/attention_gate_2.png' | relative_url }}" onclick="gateLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/attention_gate_2.png" title="Attention Gate Level 2" class="img-fluid rounded z-depth-1" caption="Gate 2 — activation begins to localise around the tumour core and surrounding oedema." %}
    </a>
  </div>
</div>
<div class="row">
  <div class="col-sm mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/attention_gate_3.png' | relative_url }}" onclick="gateLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/attention_gate_3.png" title="Attention Gate Level 3" class="img-fluid rounded z-depth-1" caption="Gate 3 — sharper focus, starting to trace the tumour boundary more precisely." %}
    </a>
  </div>
  <div class="col-sm mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/attention_gate_4.png' | relative_url }}" onclick="gateLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/attention_gate_4.png" title="Attention Gate Level 4" class="img-fluid rounded z-depth-1" caption="Gate 4 — shallowest level (128³ resolution). Fine-grained activation concentrated on tumour edges and the enhancing rim." %}
    </a>
  </div>
</div>
<div class="caption">
  Case BraTS2021_01619, axial slice 67 (the same case and slice used throughout this page). Gates 1–4 from deep to shallow. The progression from coarse to fine is the mechanism behind the Attention U-Net's improvement over the plain 3D U-Net. Rather than passing all encoder features through every skip connection, the decoder selectively amplifies the ones that are spatially relevant at each resolution. Click any image to zoom.
</div>

---

## Uncertainty Heatmap (Test-Time Augmentation)

Knowing *where* the model is confident matters as much as the prediction itself. The maps below were produced using the **Attention U-Net**, the best-performing model in this comparison. To get a per-voxel confidence estimate without any architectural changes, I ran inference 8 times, each time with a different combination of axis flips applied to the input and then undone on the output. Averaging these 8 predictions gives a more robust final mask; the per-voxel standard deviation across them gives an uncertainty map.

The intuition: if the model gives the same answer regardless of how the brain is oriented, it's confident. If the answer shifts with orientation, something there is ambiguous.

**High uncertainty (bright yellow-red) clusters at tumour boundaries**, which is exactly where a radiologist would want to double-check. The NCR/ED transition, where necrotic core meets the surrounding oedema, is consistently the most uncertain region across patients.

{% include figure.liquid path="assets/img/brats_seg/uncertainty_attention_unet.png" caption="Left: ground truth · Centre: TTA mean prediction · Right: uncertainty (std dev across 8 augmented passes). The bright boundary ring is where the model is least sure." class="img-fluid rounded z-depth-1" zoomable=true %}

---

## Interactive Charts

### Model Comparison

<iframe src="{{ '/assets/html/brats_seg/model_comparison.html' | relative_url }}"
        width="100%" height="500" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0;"></iframe>
<div class="caption">Full-volume Dice score per region across all five models (50 val cases, sliding-window inference at 50% overlap).</div>

### Radar Chart

<iframe src="{{ '/assets/html/brats_seg/radar_comparison.html' | relative_url }}"
        width="100%" height="530" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0;"></iframe>
<div class="caption">Radar chart — a larger polygon means better performance across all three tumour regions simultaneously.</div>

### Parameter Efficiency

<iframe src="{{ '/assets/html/brats_seg/params_vs_dice.html' | relative_url }}"
        width="100%" height="480" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0;"></iframe>
<div class="caption">Mean Dice vs parameter count (log scale). KAN U-Net sits bottom-left — fewest parameters, same mean Dice as Swin UNETR top-right.</div>

### Training Curves

The val Dice lines jump around quite a bit, and that's worth explaining. Each validation pass during training runs on random 128³ patches (not the full brain). With only 50 val cases in the pool, any given epoch might happen to sample more background-heavy regions, or catch the enhancing tumour edge on every case, and that swings the aggregate Dice by a few points in either direction. It's sampling noise, not instability. The final numbers in the results tables are a different story. Those come from sliding-window inference across the entire volume, which averages all of that out and is why the reported scores are both more stable and a bit higher than the mid-training curves suggest.

<iframe src="{{ '/assets/html/brats_seg/training_curves.html' | relative_url }}"
        width="100%" height="630" frameborder="0" scrolling="no"
        style="border-radius:8px; margin:0.5rem 0;"></iframe>
<div class="caption">Loss and Dice per epoch from MLflow. Swin UNETR has the lowest final training loss (0.099), yet underperforms on full-volume evaluation (the textbook signature of overfitting on a small dataset).</div>

---

## Architecture Diagrams

<!-- Lightbox overlay for architecture diagrams -->
<div id="arch-lb" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.88); z-index:9999; align-items:center; justify-content:center; flex-direction:column;" onclick="archLbClose(event)">
  <div style="position:absolute; top:16px; right:20px; color:rgba(255,255,255,0.7); font-size:1.5em; cursor:pointer; line-height:1;" onclick="archLbClose({target:null})">✕</div>
  <div style="overflow:auto; max-width:94vw; max-height:88vh; display:flex; align-items:center; justify-content:center;">
    <img id="arch-lb-img" src="" alt="" style="max-width:none; display:block; transform-origin:top left; border-radius:4px; box-shadow:0 8px 40px rgba(0,0,0,0.5); cursor:zoom-in;" />
  </div>
  <p style="color:rgba(255,255,255,0.55); font-size:0.8em; margin-top:10px; pointer-events:none;">Click image to zoom in · click again to zoom out · Esc or click outside to close</p>
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
  <div class="col-sm-6 mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/arch_unet3d.png' | relative_url }}" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/arch_unet3d.png" title="3D U-Net" caption="3D U-Net — encoder-decoder with skip connections." class="img-fluid rounded z-depth-1" %}
    </a>
  </div>
  <div class="col-sm-6 mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/arch_attention_unet3d.png' | relative_url }}" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/arch_attention_unet3d.png" title="Attention U-Net" caption="Attention U-Net — green attention gate nodes on each skip connection." class="img-fluid rounded z-depth-1" %}
    </a>
  </div>
</div>
<div class="row mt-2">
  <div class="col-sm-6 mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/arch_swin_unetr.png' | relative_url }}" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/arch_swin_unetr.png" title="Swin UNETR" caption="Swin UNETR — purple Swin Transformer stages replace the CNN encoder." class="img-fluid rounded z-depth-1" %}
    </a>
  </div>
  <div class="col-sm-6 mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/arch_kan_unet3d.png' | relative_url }}" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/arch_kan_unet3d.png" title="KAN U-Net (U-KABS)" caption="KAN U-Net — slim ConvSE encoder, purple KABS blocks at the two deepest levels." class="img-fluid rounded z-depth-1" %}
    </a>
  </div>
</div>
<div class="row mt-2">
  <div class="col-sm-6 mt-3 mt-md-0">
    <a href="{{ '/assets/img/brats_seg/arch_kan_unet3d_full.png' | relative_url }}" onclick="archLbOpen(this); return false;" style="cursor:pointer;">
      {% include figure.liquid path="assets/img/brats_seg/arch_kan_unet3d_full.png" title="KAN 3D U-Net (ablation)" caption="KAN 3D U-Net — identical to the 3D U-Net baseline except the purple bottleneck block uses KAN activations (Bernstein + B-spline) instead of LeakyReLU. Everything else unchanged." class="img-fluid rounded z-depth-1" %}
    </a>
  </div>
</div>
<div class="caption">
  All five architectures. Click any diagram to open full-size and zoom. Colour key: yellow-orange = standard DoubleConv blocks · purple = non-standard operations (Swin Transformer stages or KAN activations) · green nodes = attention gates · dark red = MaxPool · teal = upsampling · blue arcs = skip connections.
</div>

---

## Engineering Decisions

A few decisions that shaped how the project ran. Some were obvious in hindsight, a couple less so.

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">npy preprocessing cache</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">NIfTI loading via nibabel is roughly 100× slower than loading a numpy array. Since every training run iterates over 150 cases per epoch for 100 epochs, that overhead adds up fast. Running a one-time preprocessing pass to convert everything to float16 <code>.npy</code> files brings per-epoch data loading from minutes to milliseconds. It's the kind of thing that seems like an optimisation detail but actually changes what's practical to experiment with.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">Patch 128³, batch size 1, fp16</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">A full BraTS volume (240×240×155 across 4 modalities) doesn't come close to fitting in 8 GB of VRAM. The workaround is random 128³ crops with foreground-biased sampling, so the model sees tumour tissue more often than background. Batch size 1 and fp16 mixed precision (<code>torch.cuda.amp</code>) are both required to stay within VRAM. The GradScaler handles fp16 gradient underflow automatically.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">BCEDiceLoss (50/50 blend)</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">Dice loss alone is unstable early in training. When all predictions are near-zero at initialisation the gradient nearly vanishes. Blending in equal parts BCE provides a stable signal from epoch 1. The 50/50 ratio is a standard BraTS starting point and I didn't find a reason to change it.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">AdamW (lr 1e-4, weight decay 1e-5)</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">In standard Adam, weight decay is folded into the gradient update, which means the effective regularisation varies across parameters depending on their gradient magnitude. AdamW decouples the two, penalising every parameter proportionally to its own magnitude and independently of the gradient. In practice this generalises better, especially for large models like Swin UNETR. The same lr and weight decay are shared across all five models with no per-architecture tuning.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">Fixed train/val split (seed 42)</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">All five models train and evaluate on the exact same 150/50 case split, generated once and saved to <code>splits.json</code>. Without this, a single fortunate or unfortunate random draw could explain a 0.003 Dice difference between two models. With a fixed split, any difference is the architecture, not the data lottery.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">MLflow (local SQLite)</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">All hyperparameters and per-epoch metrics logged automatically to a local SQLite database. No server required. The training curves chart on this page pulls directly from that database. The graphs are a literal record of what happened during training, not reconstructed after the fact.</p>
</div>

<div style="background:var(--global-code-bg-color,#f8f8f8); border:1px solid var(--global-divider-color,#ddd); border-radius:8px; padding:14px 18px; margin:0.75rem 0;">
<p style="margin:0 0 5px 0; font-weight:600; font-size:0.95em;">KAN activations in fp32</p>
<p style="margin:0; font-size:0.92em; line-height:1.6;">Bernstein polynomial evaluation involves computing x⁴, which loses enough precision in fp16 to destabilise training. The KAN forward pass casts to fp32 internally regardless of the surrounding AMP context. Small detail, took a while to find.</p>
</div>

---

## What's Next

**Training on the full dataset** is the most direct continuation. WT is the most volume-sensitive region, spatially diffuse, and the gap to published SOTA there is the one most likely to close with more cases. Everything else in the pipeline is already set up; it just needs a GPU with more than 8 GB of VRAM and time.

**[CDA-Mamba](https://www.nature.com/articles/s41598-025-06462-3)** was the originally planned fourth architecture, a Cross-Directional Attention Mamba model that replaces the Transformer's quadratic attention cost with linear state-space scanning along all three volume axes. I had to defer it because `mamba-ssm` has no official Windows wheels. It's the one I'm most curious about. If Swin UNETR's problem was overfitting on limited data, Mamba's lighter parameter footprint with global context might fare better in this regime.

**HD95** is partially implemented in the codebase but never made it into the final evaluation run. The metric catches cases where a model has good Dice but scattered false positives far from the tumour (the 95th-percentile surface distance between prediction and ground truth inflates badly in those cases). Finishing it is mostly a matter of completing the implementation and re-running evaluation.

---

**Stretch goals**

**The pipeline generalises beyond brain tumours.** Patch-based training, sliding-window inference, multi-class Dice evaluation. None of this is specific to BraTS. Any 3D medical imaging task with multi-modal sequences and similar class imbalance between anatomy and background is a natural fit, and adapting the pipeline would be more configuration work than code work.

**In-browser inference** is the stretch goal I keep coming back to. The KAN U-Net at 2.42M parameters is small enough to export to ONNX and run via `onnxruntime-web`, with inference running in the visitor's browser on a pre-loaded patch and no server required. It would turn this from a static results page into something you can actually interact with.
