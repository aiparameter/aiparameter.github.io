Governance can sound abstract until a deployment forces specific questions: who approved this, what data does it touch, and what happens when it is wrong? Several published frameworks help answer them. This article turns them into a verification list a team can complete before a system reaches users. It is general information, not legal advice.

## The sources, briefly

- **NIST AI Risk Management Framework.** A voluntary US framework organized around four functions: govern, map, measure and manage. It is a way to structure risk work rather than a certification.
- **EU Artificial Intelligence Act.** A binding regulation that classifies systems by risk and sets obligations accordingly, with different requirements for prohibited practices, high-risk systems, certain transparency cases and general-purpose models. Its provisions apply on a phased timetable, so confirm current dates on the official text and with counsel.
- **ISO/IEC 42001.** A standard for an AI management system, aimed at organizations that want a certifiable process for managing AI responsibly.
- **OWASP Top 10 for LLM Applications.** A security-focused list of common vulnerabilities in applications built on language models, including prompt injection and insecure handling of model output.

## Verification list

### 1. Purpose and risk

- Is the intended use documented, including what the system must not be used for?
- Has the use been classified under the regulations that apply where you operate?
- Who is affected by an error, and how severe could the harm be?

### 2. Data

- What data enters the system, and do you have the right to use it that way?
- Is personal or confidential data sent to a third-party provider, and under what terms?
- How long is data retained, and can it be deleted on request?

### 3. Security

- Has the system been tested for prompt injection, including instructions hidden in documents or web pages it reads?
- Is model output ever executed or passed to another system without validation?
- Do tools and connectors have the minimum permissions they need?

### 4. Performance and fairness

- Was the system tested on data resembling real use, including edge cases?
- Are results compared across the groups the system serves?
- Is there a threshold below which it is not released?

### 5. Human oversight

- Which decisions require a person to review or approve?
- Can that person understand the output well enough to challenge it?
- Is there a way for affected people to contest a result?

### 6. Monitoring and response

- What will be measured after launch, and who reviews it?
- Is there an incident process, including the ability to switch the system off?
- How will changes to the underlying model be detected and tested?

### 7. Accountability

- Is one named person responsible for the system?
- Are decisions, tests and approvals recorded?
- Have affected users been told they are interacting with AI where that is required or expected?

## Make it routine

Treat this list as a gate in your release process, not a document written once. Record each answer with the date and the person who gave it. Where an answer is “not yet known,” decide whether the risk is acceptable and write down who accepted it. Regulations and guidance continue to change, so assign someone to review the sources above on a schedule.
