A chatbot answers a question and waits. An agent is given a goal, decides what to do next, uses tools, looks at the result and continues until it finishes or stops. The difference sounds small. It changes what software can be asked to do, and how it can fail.

## What an agent is

In its simplest form, an agent is a language model running in a loop with access to tools. The ReAct research popularized a pattern in which a model alternates between reasoning about a problem and taking an action, such as searching or calling a function, then reasoning again with what it learned. Most agent systems today are variations on that loop with better tools, memory and guardrails.

Anthropic’s engineering guidance draws a useful line between two designs. **Workflows** run a model through steps that a developer defined in advance. **Agents** let the model choose its own steps. Workflows are more predictable and easier to test. Agents are more flexible and harder to bound.

## What it enables

- **Multi-step tasks:** gathering information from several systems, combining it and producing a result.
- **Software work:** reading a codebase, making a change, running the tests and responding to failures.
- **Operational tasks:** triaging a queue, drafting responses and escalating the cases that need a person.

Connecting agents to tools has also created a need for common interfaces. The Model Context Protocol is one open attempt at a standard way for a model to reach external data and services, so that each integration is not rebuilt from scratch.

## Where it breaks

Agents inherit the weaknesses of the model and add new ones:

1. **Compounding errors.** A small mistake early in a long sequence can carry through every later step.
2. **Unbounded cost and time.** A loop with no limit can run far longer than anyone intended.
3. **Tool misuse.** An agent with write access can change real systems, so mistakes become actions.
4. **Untrusted input.** Text from a web page or document can contain instructions that attempt to redirect the agent.
5. **Hard-to-reproduce behavior.** The same goal can produce different paths on different runs, which complicates debugging.

## Deciding whether a task needs one

Start with the simplest design that works. A single well-written prompt handles many tasks. A fixed workflow handles many of the rest. An agent earns its added complexity when the steps cannot be known in advance and when a wrong step can be detected and undone.

A practical test has four parts:

- Can the task be broken into fixed steps? If yes, use a workflow.
- Is the cost of an error low, or can a person approve the risky steps? If not, add a human checkpoint.
- Is there an objective way to check the result? If not, you cannot tell whether the agent succeeded.
- Can you set limits on time, spending and permissions? If not, do not deploy it yet.

## The current state

Agents are most dependable where the environment is narrow, the tools are well defined and success can be checked automatically. They are least dependable in open-ended settings with ambiguous goals. Evidence of general reliability should be treated cautiously until it comes from independent tests on tasks like your own.
