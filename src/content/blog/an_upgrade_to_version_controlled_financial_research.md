---
title: 'From a Cloud Research Project to a Version-Controlled Financial Analysis Workflow'
description: 'How moving investment research into a version-controlled repository makes instruction changes comparable, errors traceable, and research steps reviewable.'
publishDate: 2026-09-27
draft: false
---

<div class="financial-research-post">
<p>My investment research workflow started in a cloud-managed project. It brought together company filings, previous summaries, project instructions, and global skills for recurring tasks. A single Markdown document covered business research themes, accounting definitions, financial ratios, source preferences, and report structure.</p>

<p>That arrangement made it easy to get started. As the project grew, however, definitions, calculations, interpretations, and formatting instructions became intertwined. Some important decisions remained implicit.</p>

<p>Three opportunities motivated the move to a GitHub repository: testing changes, tracing errors, and breaking research into manageable steps.</p>

<h2 id="testing-different-versions">Testing different versions</h2>

<p>With one active global skill, my original setup offered no convenient way to preserve and compare alternatives. After changing instructions, it was difficult to distinguish their effect from changes in source material or the agent’s execution.</p>

<p>Version control provides a practical comparison workflow. I can generate reports for the same company, using the same filings and research cutoff, against different commits or branches containing different versions of the skill and methodology. Outputs can still vary, but the instructions and evidence are controlled and inspectable.</p>

<figure id="an_upgrade_to_version_controlled_financial_research-g01">
  <img src="/artifacts/blog/graphics/an_upgrade_to_version_controlled_financial_research/an_upgrade_to_version_controlled_financial_research-g01.png" width="1536" height="1024" loading="lazy" decoding="async" alt="A shared evidence tray above Version A and Version B instruction cards, each paired with a separate report." />
  <figcaption>A conceptual comparison: keep the evidence and cutoff fixed, vary the instructions, and inspect the outputs. Outputs can still vary.</figcaption>
</figure>

<h2 id="tracing-errors-to-their-source">Tracing errors to their source</h2>

<p>When a ratio looked wrong, the monolithic guidelines provided no consistent intermediate record to inspect. Asking the agent to explain its arithmetic was possible, but the workflow did not clearly separate company-reported values from calculated metrics.</p>

<p>The revised repository makes those boundaries explicit. <code>AGENTS.md</code> holds repository-wide instructions and source policy. Accounting definitions identify reported inputs. Structured metric files define calculations and dependencies. Analysis rules guide interpretation, while templates specify presentation. Index documents connect these resources, and local skills coordinate the workflow.</p>

<p>I can now inspect a reported value and its source, review the formula independently, and manually verify a calculation. A wrong input, mismatched period, or flawed formula has a specific place to investigate and fix. An undisclosed input remains “Not reported”; a calculated substitute cannot quietly become a reported fact.</p>

<figure id="an_upgrade_to_version_controlled_financial_research-g02">
  <img src="/artifacts/blog/graphics/an_upgrade_to_version_controlled_financial_research/an_upgrade_to_version_controlled_financial_research-g02.png" width="1536" height="1024" loading="lazy" decoding="async" alt="Separated sheets labeled Source, Inputs, and Calculation, with an input field marked “Not reported”." />
  <figcaption>An inspection metaphor: keep sources, inputs, and calculations distinct. A missing reported input stays “Not reported”.</figcaption>
</figure>

<h2 id="building-confidence-step-by-step">Building confidence step by step</h2>

<p>Custom skills also provide a convenient structure for dividing company analysis into smaller tasks that build on one another: collecting evidence, recording inputs, calculating metrics, interpreting changes, and assembling the summary.</p>

<p>Each step can be run, checked, and refined before its results feed the next. Corrections become part of the documented workflow. Over time, this gives me a stronger basis for relying on the agent’s work and concentrating review where uncertainty remains.</p>

<p>That changes how I spend my research time. Instead of repeatedly checking routine calculations, I can investigate questions beyond the indicators—for example, the origins of ongoing legal proceedings, the conduct alleged, and what those disputes reveal about the business.</p>

<p>With the time available to me, that depth would be difficult to reach through entirely manual SEC-filing analysis or constant rechecking of an agent’s equivalent work. The value is not simply producing summaries faster. It is creating room for better questions.</p>
</div>

<style>
.financial-research-post { max-width: 72ch; margin-inline: auto; }
.financial-research-post p { margin-block: 1.25rem; }
.financial-research-post figure { margin: 2rem 0 2.5rem; }
.financial-research-post img { display: block; width: 100%; height: auto; border-radius: 4px; }
.financial-research-post figcaption { margin-top: 0.75rem; color: var(--color-muted); font-size: 0.9375rem; line-height: 1.55; }
</style>
