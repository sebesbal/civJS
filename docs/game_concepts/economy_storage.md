# Storage System

This document describes a possible approach to solving the production problem using storage.

The core idea is that each actor has some amount of storage capacity. Storage makes it possible to find local solutions to the production problem without requiring the entire economy to be globally consistent at all times.

To understand why this matters, imagine an economy where actors have no storage at all. In that case, every produced product would have to be consumed immediately by someone else. This would require the entire economy to be perfectly balanced at every moment. Any change at a single producer would instantly propagate through the whole system, making the economy very hard to control.

By introducing storage, we can instead solve the problem locally. When actors have storage capacity, they can buy and sell products even if production is temporarily halted somewhere in the system. This allows small, temporary inconsistencies to exist without breaking the economy.

As a result, the economy can be treated as a collection of local solutions that gradually adapt to each other, rather than a single fragile global solution that must always be perfectly consistent.

## Producers

Producers maintain a small internal stock of the input and output products.

## Warehouses

Warehouses exist primarily for trading and storage.

Their storage capacity is usually much larger than that of producers or consumers.

In operation, warehouses aim to maintain an ideal stock level for each product they handle. To achieve this, they buy products from producers, store them, and later sell them to consumers.

As with producers, the ideal stock size depends on fluctuations in incoming and outgoing flows. Larger fluctuations require larger buffers.

When a new warehouse is built, it first examines nearby trade routes, including the types of products being transported and their typical volumes. Based on this information, it decides which products to store and in what quantities.

## Profit margin

Each actor operates with a default profit margin of 5%. This value can be changed by the user.

## Ideal storage range

The ideal storage range is calculated as follows:

- The range size is fixed:
  - `ideal_range_size = max - min` (for example, 3).
- The ideal storage range is adjusted so that "storage becomes empty" and "storage becomes full" happen with the same probability.
  - If the storage becomes empty, shift the center of the ideal range slightly upward.
  - If the storage becomes full, shift the center of the ideal range slightly downward.
- The initial ideal storage range is `0..ideal_range_size` for both input and output products.
- In the following, "below ideal" and "above ideal" mean the storage level is outside the ideal range.

## Prices

Producers and warehouses set selling prices for their output products.

Terms:

- **Price**: an integer. The minimum price is 1. There is no upper limit.
- **Minimum input price**: the lowest available price at which the actor can buy a product. This equals another actor’s selling price (possibly in another cell) plus transportation cost.

Selling price calculation (priority order, earlier rules override later ones):

- **Warehouses**: the selling price must always be higher than the minimum buying price plus the profit margin.
- **Producers**: the selling price must always be higher than the minimum production cost plus the profit margin.
  - Minimum production cost = sum of the required input product costs to produce one output unit, using minimum input prices.
- The selling price is lowered when the output storage level is above ideal.
- The selling price is increased when the output storage level is below ideal.

## Pausing production, pausing selling and buying

- If the current storage level of a product is above ideal, the actor does not buy that product.
    - If this product is an output product of a producer, then production is also paused.

