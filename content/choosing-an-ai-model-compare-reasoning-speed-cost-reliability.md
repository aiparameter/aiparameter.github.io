Public leaderboards rank models on tasks someone else chose. Your work has different inputs, different tolerance for error and a different budget. The reliable way to choose a model is to measure four properties on your own tasks, with a test set small enough to build in a day.

## Why leaderboards are not enough

Broad benchmarks are useful for narrowing a field. The HELM project made the case that evaluating a model on one metric hides trade-offs, and it measured accuracy alongside robustness, calibration, fairness and efficiency across many scenarios. The same point applies to your own choice: a model that wins on average accuracy can lose on cost, speed or consistency for the job you need done.

Human-preference rankings add another signal, but they measure what voters preferred, which is not always what is correct. Research on automated judges found that they can track human preferences closely while favoring longer answers and being sensitive to answer order. A ranking built on either method answers “which response did people or a judge like?” rather than “which model solves my problem?”

## Build a small test set

1. Collect 30 to 50 real inputs from the task, including a few hard and a few ambiguous ones.
2. Write down what a good output looks like for each, before running any model.
3. Keep the set private, so that it cannot leak into a vendor’s training data.
4. Include cases where the right answer is “this cannot be determined.”

## Measure four properties

### Reasoning quality

Score each output against your reference. Use a simple rubric such as correct, partly correct or wrong, and have a second person grade a sample. If you use a model as a grader, check its grades against yours on ten cases first.

### Speed

Record the time to the first token and the time to completion. These matter differently: the first affects perceived responsiveness in a live product, the second affects batch throughput. Measure at the times of day you will actually run.

### Cost

Calculate cost per completed task, not cost per token. A cheaper model that needs two attempts or longer prompts may cost more. Read current prices from the vendor and record the date you checked them.

### Reliability

Run each input several times. Note how often the output changes in substance, how often the format breaks, and how often the model refuses or fails. A model that is brilliant on one run and wrong on the next is difficult to build on.

## Decide with a table

| Model | Correct | Median time | Cost per task | Format failures |
| --- | --- | --- | --- | --- |
| Option A | your result | your result | your result | your result |
| Option B | your result | your result | your result | your result |

Weight the columns by what the task needs. A support classifier may weigh cost and speed heavily. A legal summarizer will weigh correctness above both.

## Keep the decision open

Models change, prices change and your needs change. Keep the test set, rerun it when a vendor announces an update, and record the date and version you tested. The result is a decision you can defend and revisit, rather than a preference inherited from a leaderboard.
