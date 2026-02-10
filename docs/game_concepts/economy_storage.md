# Storage System

This document describes a possible approach to solving the production problem using storage.

The core idea is that each actor has some amount of storage capacity. Storage makes it possible to find local solutions to the production problem without requiring the entire economy to be globally consistent at all times.

To understand why this matters, imagine an economy where actors have no storage at all. In that case, every produced product would have to be consumed immediately by someone else. This would require the entire economy to be perfectly balanced at every moment. Any change at a single producer would instantly propagate through the whole system, making the economy very hard to control.

By introducing storage, we can instead solve the problem locally. When actors have storage capacity, they can buy and sell products even if production is temporarily halted somewhere in the system. This allows small, temporary inconsistencies to exist without breaking the economy.

As a result, the economy can be treated as a collection of local solutions that gradually adapt to each other, rather than a single fragile global solution that must always be perfectly consistent.

## Producers

Producers maintain a small internal stock of the input products they need for production.

The ideal size of this stock depends on how much the supply of those inputs fluctuates. If incoming deliveries are irregular, a larger buffer is required to keep production running smoothly.

Producers also need storage for their output products, since these may not be sellable immediately.

## Warehouses

Warehouses exist primarily for trading and storage.

Their storage capacity is usually much larger than that of producers or consumers.

In operation, warehouses aim to maintain an ideal stock level for each product they handle. To achieve this, they buy products from producers, store them, and later sell them to consumers.

As with producers, the ideal stock size depends on fluctuations in incoming and outgoing flows. Larger fluctuations require larger buffers.

When a new warehouse is built, it first examines nearby trade routes, including the types of products being transported and their typical volumes. Based on this information, it decides which products to store and in what quantities.

## Prices and Storage

Producers and warehouses set selling prices for their output products.

These prices depend on how close the current stock level is to the ideal stock level. If storage is close to full, prices tend to drop. If stock is low, prices tend to rise.

They also decide whether to buy input products from other producers or warehouses based on the prices currently available.
