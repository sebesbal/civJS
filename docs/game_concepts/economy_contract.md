# Contracts

This document describes one possible approach to solving the production problem, which I refer to as "Contracts".

The core idea is that trades between actors can be made persistent by turning them into contracts. A contract represents an agreement to exchange a fixed quantity of a product at a fixed price over time.

For example, a producer may agree to sell one kilogram of bread to a warehouse at an agreed price. Once this contract is created, the trade happens automatically until one of the parties decides to cancel it.

After entering a contract, a producer no longer needs to repeatedly decide what to do with that portion of its output. Only the remaining, uncommitted production capacity needs active decision making.

When the Actor has no free capacity left, it tries to replace its worst contract.

An Actor should have around 10 contracts when uses its full capacity.

From the perspective of the production problem, each contract is a local solution that stabilizes part of the system. The global solution is not planned upfront, but gradually emerges as more contracts are created, adjusted, or canceled.