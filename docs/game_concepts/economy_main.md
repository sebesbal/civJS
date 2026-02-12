# Economy Basics

## Actors

The economy is made up of different types of actors:

- **Producers**  
  Actors that consume some products and turn them into other products.

- **Traders**  
  Actors that buy and sell products and move them between different actors and cells.

- **Warehouses**  
  Actors that buy products, store them, and sell them later, typically at a higher price.

- **Sinks**  
  End consumers of the economy. They buy products but do not produce any tradable goods. Instead, they generate value directly for the player, such as military units, buildings, or research. These outputs are called *final goods*.

## The Player

The player defines priorities for final goods. For example, the player may want to build a military unit or a building in a specific cell, or invest in researching a new technology.

The goal of the economy is to satisfy these priorities. In practice, this means maximizing the production of final goods while minimizing transportation costs and other inefficiencies. This also means that fluctuations in production and transportation should be minimal, and producers should have maximum uptime.

## The Production Problem

We refer to this overall challenge as the *production problem*. It is about how to control the economy to maximize value for the player.

Solving the production problem requires answering questions such as:

- How products should be transported between producers and warehouses.
- How to allocate scarce input products when there are shortages, including which producers should receive inputs and which ones should be temporarily deprioritized.
- When producers and warehouses should operate, buy inputs, or hold back production.
- How prices should be set and adjusted over time.

There are multiple possible approaches to solving this problem.

## Contents of the `game_concepts` Folder

The files in this folder fall into two categories:

- **General concepts**  
  These files describe ideas that are independent of any specific solution to the production problem. They define how the economy works at a conceptual level. This document belongs to this category.

- **Production problem implementations**  
  These files describe concrete implementation ideas and algorithms for solving the production problem.

## Actor Details

### Producers

To produce one unit of an output product, a producer requires specific amounts of various input products. This means that every producer is also a consumer.

For example, a bakery buys flour, water, electricity, and labor, and produces bread.

### Warehouses

Warehouses can store products up to a fixed storage capacity. They do not need to sell products immediately after buying them, but they must remain profitable over time.

Typically, a warehouse buys goods at a lower price and attempts to sell them later at a higher price. For example, it may buy one ton of bread for $10, store it, and try to sell it for $15. If the bread does not sell, the warehouse gradually lowers the price to free up storage space for more profitable goods.

### Traders (Transportation)

Traders move products between actors and cells. They buy products from one actor and sell them to another actor in a different cell.

To perform transportation, traders also need to buy fuel at the source cell. Fuel consumption depends on the selected route.
