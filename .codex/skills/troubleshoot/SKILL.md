---
name: troubleshoot
description: Diagnose a reproducible or observable software issue and produce an approved JSON diagnostic snapshot. Use for troubleshooting only; do not modify code, config, dependencies, tests, or repository artifacts except the approved output JSON.
metadata:
  short-description: Diagnose software issues without repairing them
---

# Troubleshoot

## Purpose

Investigate a reproducible or observable software issue and produce a concise, evidence-backed diagnostic snapshot with deductions and prioritized hypotheses. The skill ends at diagnosis.

## Non-Negotiable Boundary

| Rule             | Requirement                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| No repairs       | Do not modify source code, configuration, dependencies, tests, or repository artifacts as part of troubleshooting.     |
| No commits       | Do not stage or commit changes.                                                                                        |
| Output exception | The only repository artifact this skill may write is the approved diagnostic JSON at `<OUTPUT_DIR>/<issue_name>.json`. |
| Approval gate    | Do not write the JSON until the user explicitly approves the proposed diagnostic record.                               |
| Durable handoff  | Write the final artifact so a human or downstream skill can use it without replaying the full investigation.           |

## Inputs

| Argument       | Required | Meaning                                                                              |
| -------------- | -------- | ------------------------------------------------------------------------------------ |
| `OUTPUT_DIR`   | Yes      | Directory where the approved diagnostic JSON must be written.                        |
| `ISSUE`        | Yes      | Human-readable symptom, expected behavior, URLs, commands, or reproduction details.  |
| `REPRODUCTION` | No       | Known command, test, route, HTTP request, or action sequence that exposes the issue. |
| `CONTEXT`      | No       | Relevant modules, recent changes, environment details, or suspected boundaries.      |

Derive missing optional inputs from the current task and repository context when reasonable. Derive `issue_name` from `ISSUE` as a concise filesystem-safe identifier.

## Evidence Priority

| Priority | Evidence Type                 | Guidance                                                                       |
| -------- | ----------------------------- | ------------------------------------------------------------------------------ |
| 1        | Autonomous reproduction       | Reproduce the issue directly when practical and safe.                          |
| 2        | Error output                  | Capture exact errors and stack frames produced by reproduction.                |
| 3        | Logs                          | Prefer relevant runtime, application, build, and tool logs.                    |
| 4        | Runtime state                 | Observe inputs, outputs, routes, requests, responses, and environment details. |
| 5        | Existing tests or diagnostics | Use existing tests or narrow diagnostic commands when they clarify behavior.   |
| 6        | Source/config inspection      | Inspect only what is needed to explain observed evidence.                      |
| 7        | Theoretical reasoning         | Use pure source reasoning only when direct observation is unavailable.         |

Do not begin with broad source-code analysis when the issue can reasonably be reproduced or observed. Code examination should answer questions raised by runtime evidence.

## Workflow

| Step | Action                                                                                                                                                | Output                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1    | Normalize the symptom and expected behavior. Identify the most direct observable boundary.                                                            | Concise issue framing.                                                               |
| 2    | Attempt autonomous reproduction before broad code inspection when practical and safe.                                                                 | Commands/actions, observed behavior, errors, logs, and material environment details. |
| 3    | Localize from evidence by following stack frames, logs, runtime boundaries, data flow, configuration, or module responsibility only as far as needed. | Evidence-backed responsibility boundary.                                             |
| 4    | Generate competing hypotheses. Separate deductions, support, contradictions, uncertainty, and useful next evidence.                                   | Ranked candidate explanations.                                                       |
| 5    | Prioritize hypotheses by explanatory power and support, preferring the fewest unsupported assumptions.                                                | Highest-ranked diagnosis with confidence.                                            |
| 6    | Prepare the proposed diagnostic JSON record in memory only.                                                                                           | Proposed content for `<OUTPUT_DIR>/<issue_name>.json`.                               |
| 7    | Present a human-readable approval summary and explicitly state that no JSON file has been written.                                                    | User review checkpoint.                                                              |
| 8    | Stop and await explicit approval.                                                                                                                     | No artifact written yet.                                                             |
| 9    | After approval only, write valid JSON faithfully representing the approved diagnosis.                                                                 | `<OUTPUT_DIR>/<issue_name>.json`.                                                    |

If the user rejects or requests changes, revise the proposed record and present it again. Each materially revised diagnostic record requires fresh approval before persistence.

## Approval Summary

Before writing the JSON, summarize the proposed diagnostic record for human review.

| Include            | Requirement                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| Issue              | Symptom and expected behavior.                                                  |
| Reproduction       | Whether it was reproduced, partially reproduced, or not reproduced, and how.    |
| Strongest evidence | The observations most responsible for the diagnosis.                            |
| Fault boundary     | The narrowest supported module, responsibility, interface, or runtime boundary. |
| Top hypotheses     | Highest-ranked explanation or explanations with confidence.                     |
| Uncertainty        | Important unresolved questions or contradicting facts.                          |
| Next action        | Recommended diagnostic or downstream action without performing repairs.         |
| Output path        | Exact `<OUTPUT_DIR>/<issue_name>.json` that would be created.                   |
| Hard stop          | State clearly: `No diagnostic file has been written yet.`                       |

Ask for explicit approval to persist the diagnostic snapshot. Tool execution permission, repository write permission, or the original troubleshooting request is not approval.

## JSON Artifact Requirements

| Requirement       | Guidance                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Format            | Valid JSON only.                                                                                       |
| Size              | Keep it concise, approximately no more dense than a 300-line Markdown document.                        |
| Detail level      | Prefer responsibilities, boundaries, data relationships, and concise evidence over large excerpts.     |
| Excerpts          | Include exact code, stack frames, or logs only when literal content materially supports the diagnosis. |
| Fidelity          | Do not introduce new material conclusions, hypotheses, or interpretations after approval.              |
| Changed diagnosis | If new evidence materially changes the diagnosis before writing, return to the approval gate.          |

## Output Schema

```json
{
  "issue": {
    "name": "filesystem-safe issue identifier",
    "summary": "concise description of observed problem",
    "expected_behavior": "expected behavior",
    "observed_behavior": "observed behavior"
  },
  "reproduction": {
    "status": "reproduced | not_reproduced | partial",
    "method": "concise description of reproduction",
    "environment": "material runtime/environment details",
    "observations": ["directly observed facts"]
  },
  "evidence": [
    {
      "type": "reproduction | stack_trace | log | runtime | test | source | config",
      "summary": "what was observed",
      "location": "relevant module, symbol, log source, command, or boundary",
      "significance": "why this evidence matters"
    }
  ],
  "fault_localization": {
    "likely_boundary": "most narrowly supported fault/responsibility boundary",
    "related_areas": [
      "relevant modules, libraries, symbols, or responsibilities"
    ],
    "reasoning": "concise evidence-backed deduction"
  },
  "hypotheses": [
    {
      "rank": 1,
      "hypothesis": "candidate explanation",
      "supporting_evidence": ["evidence references or concise facts"],
      "contradicting_evidence": ["evidence references or concise facts"],
      "confidence": "high | medium | low",
      "next_evidence": "most useful evidence for confirming or rejecting it"
    }
  ],
  "conclusion": {
    "most_likely_explanation": "best current explanation without claiming more certainty than evidence supports",
    "remaining_uncertainty": ["important unresolved questions"],
    "recommended_next_action": "diagnostic or downstream action, without performing code changes"
  }
}
```

## Completion Criteria

| Criterion    | Done When                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------- |
| Reproduction | Reproduction has been attempted or a concrete reason is recorded for why it was impossible. |
| Evidence     | Runtime evidence was preferred over speculative source analysis.                            |
| Hypotheses   | At least one evidence-backed hypothesis is ranked with explicit uncertainty.                |
| No repairs   | No source, configuration, dependency, test, refactor, or commit action was performed.       |
| Approval     | The proposed record was summarized and explicitly approved by the user.                     |
| Persistence  | Valid JSON exists at `<OUTPUT_DIR>/<issue_name>.json`.                                      |
| Handoff      | The artifact is self-contained enough for a downstream skill, agent, or human engineer.     |
