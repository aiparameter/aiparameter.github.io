Training and serving a large model consumes physical resources: accelerator chips, memory, fast networking, buildings and electricity. Access to those resources has become one of the clearest differences between organizations that can build frontier systems and those that must rent or wait. This article explains why, and how to read the announcements that describe it.

## Why capacity matters

The research case is straightforward. Studies of neural language models found that performance improved predictably as model size, data and training compute grew, a pattern often called scaling laws. Later work on compute-optimal training showed that, for a fixed compute budget, many models had been too large for the amount of data they saw, which changed how labs balanced the two.

You do not need to accept every extrapolation from those papers to see the practical consequence. Whoever can run more experiments, train larger runs and serve more users at acceptable cost has more room to iterate. Capacity is not the only advantage, since data, talent and product design also matter, but it is one that money and lead times can buy.

## The pieces of the stack

- **Chips:** accelerators are the headline item, but supply depends on fabrication capacity and packaging, both of which are constrained.
- **Memory and bandwidth:** moving data to the chip is often the bottleneck, not arithmetic on the chip.
- **Networking:** training spreads one job across thousands of devices, so the links between them set how efficiently they work together.
- **Power and cooling:** a data center needs a grid connection, and in many regions the wait for one is measured in years.
- **Software:** the same hardware performs very differently depending on how well the training and serving code uses it.

## Training versus serving

Training is a large, one-time cost per model version. Serving is a continuing cost that grows with usage. As a model reaches more people, the balance of spending tends to move toward serving, which is why efficiency work such as smaller models, caching and better batching receives so much attention. A company’s strategy can look very different depending on which cost it expects to dominate.

## Reading an announcement

Capacity announcements are easy to write and hard to compare. Before treating one as evidence of strength, check:

1. **Committed or aspirational?** A signed contract differs from a stated goal or a letter of intent.
2. **Delivered when?** Capacity promised over several years is not capacity available to train next quarter.
3. **Which resource?** Chips without power, or power without chips, is not usable capacity.
4. **Who bears the risk?** Look for who pays if demand falls short of the forecast.
5. **Is the unit comparable?** Figures quoted in chips, in megawatts and in dollars cannot be added together without assumptions.

## The energy question

The International Energy Agency has examined how data-center electricity demand relates to AI growth, and its analysis treats the topic as a question of regional grids and timing rather than a single global number. The useful framing for readers is local: where a facility sits, what generation serves it, and how quickly new supply can be connected.

## What to watch

Three developments would change the picture. A significant gain in efficiency would lower the capacity needed for a given capability. A persistent supply bottleneck would concentrate advantage further. And policy on power, permitting or export controls could shift where capacity can be built. None of these can be forecast from announcements alone; each can be followed through primary sources.
