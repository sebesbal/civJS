# Civilization JS

This is a three JS project. It's a strategic game, a bit mix of Railroad Tycoon 3 and Civilization.

## Map
The map is a grid. 

## Economic model
 
### Market, prices
Each resource has two prices at each grid cell:
- Buying price
	Markets buy resources (from traders and producers) at this price.
- Selling price
	Markets sell resources (to traders and producers) at this price.
 
Markets gradually and automatically change the prices. They try to sell the stock at maximum price, and they lower the selling price only if they couldn't sell the product and the storage is starting to get full.
They try to buy everithing on the lowest price, and they increase the buying price only if they can sell that product at a higher prices, but the storage is starting to get empty.

### Actors
- Producers
- Traders


 
### Resources

Each resource has two prices at each grid cell:
- Buying price (except for final goods)
	Traders buy resources on this price.
	Producers sell resources on this price. 
- Selling price
	Traders sell resources on this price. 
	Producers buy resources on this price. 

#### Stock resources
Resources that can be stored. 
- Raw materials.
	They can be mined, harvested on a cell
- Components, parts, intermediate goods
	They can be produced from raw materials or other components.

#### Flow resources
Resources that cannot be stored. 
- labor
- electricity
- etc.

#### Final goods
- research output
- military power
- money (can be used for trade with other players)
- etc..
- the user wants to maximize the amount of these goods

### Producers
To produce one output product, the producer needs a different amount of different input products.
So each producer is a consumer at the same time.
Producers don't have own prices nor storage. They buy everything from the local market at the market's selling price, and sells the output product on the local market's buying price. If the production is not profitable (the price of input is higher than the output), they stop producing.

- mine
	Consumes labour and electricity, produces raw materials.
- factory
	Consumes different raw materials and other products and produces intermediate or final goods.
	- house (as a 'factory')
		Consumes food and electricity and produces labor.
	- Farm. 
		Consumes labor and electricity and produces wheat. 
	- Windmill 
		Consumes labor and wheat and produces flour. 
	- Research facility. 
		Consumes labor and electricity and produces research. 
	- etc.


### Transportation, trade
Traders try to transport products between markets. They buy products from the source market with the selling price of that market for the specific product. Then sells the product at the destination market at the buying price at that market. 
They also have transportation cost which depends on the route between the source and destination. They buy fuel at the source for the local price.

### Actor's workflow 
Each Actor (producer and trader) has the following properties:
- input and output products
- input and output cells (it's the same cell for a producer. it is the same product with different cells in case of trader)
- capacity: the full capacity of producer (e.g. the volume of possible output products) or trader (the maximum amount of product what the trader can transfer)

Each Actor tries to adjust its activity (producing, transporting) gradually:
The workflow:
- take a portion of the free capacity (e.g. 10% of full capacity)
- adjust the prices:
	- each actor changes the prices in parallel. Just a little bit in every turn / clock tick
	- increase the input price for each product separately until it finds a seller 
	- decrease the output price until if finds a buyer
	- it is possible that the found seller and buyer don't want to trade with the full amount of products what we want to trade. then we will use only that portion what they want to trade, which also limits our operation. e.g. if a factory finds only half of the amount of the needed input product, then it can produce only half of the output as well, so, in this step we will make contract about these half volumes
- when there is a buyer and seller, and the process is profitable (full buying price is lower then the full selling price), create a new contract with these prices and amounts.
	- "freeze" this contract. The prices and amounts won't change until one party ends the deal.
- repeat the process while there is free capacity: take the next portion of the free capacity, adjust the prices again and find a contract
- when the actor uses its full capacity, it will try to replace its worst (least profitable) contract with a new contract. the process is the same.

### Construction
When the player starts to construct a building on a cell, This construction work will be a consumer of construction materials and labor. 

### Prices, market
Every actor has a buying and a selling price for each product. E.g. a producer tries to buy input products on the lowest price on their location (grid cell) from traders, and try to sell the output product on the highest price on their location to traders. Traders try to buy products on the lowest price on the source cell and try to sell it on the highest price 

The buying and selling price is changed gradually and automatically. Every actor (producer and trader) tries to sell the product on the highest prices, and tries to buy products on the lowest price.  These prices are changed gradually and automatically until the buying and selling prices are met, and 

### Player
- The player's goal is to maximize the amount of final products. Which can be used in other parts of the game like war, research, etc. The player has to specify the weights of these final products. So, in this way, they can prioritize products over other products. 
- The player can construct buildings on the map. Like mines, factories, research facilities, houses, etc. 
- These buildings have to decide automatically if they should work or not, depending on the local prices. Meaning, if they can work profitably.
- Traders automatically buy products and transfer them to different destinations and sell them.
