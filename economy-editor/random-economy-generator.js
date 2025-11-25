// Random Economy Generator - generates random economy DAGs
import { EconomyManager } from './economy-manager.js';

export class RandomEconomyGenerator {
  constructor() {
    this.availableIcons = [];
    this.loadAvailableIcons();
  }

  // Load all available icon paths from icons/animals directory
  async loadAvailableIcons() {
    // List of actual icon paths from icons/animals directory
    const iconFilePaths = [
      'icons/animals/carl-olsen/mite-alt.svg',
      'icons/animals/carl-olsen/spider-alt.svg',
      'icons/animals/carl-olsen/spider-face.svg',
      'icons/animals/caro-asercion/axolotl.svg',
      'icons/animals/caro-asercion/bunny-slippers.svg',
      'icons/animals/caro-asercion/pangolin.svg',
      'icons/animals/caro-asercion/schrodingers-cat-alive.svg',
      'icons/animals/caro-asercion/schrodingers-cat-dead.svg',
      'icons/animals/cathelineau/earth-worm.svg',
      'icons/animals/cathelineau/flying-trout.svg',
      'icons/animals/cathelineau/polar-bear.svg',
      'icons/animals/darkzaitzev/plants-and-animals.svg',
      'icons/animals/delapouite/animal-hide.svg',
      'icons/animals/delapouite/bat.svg',
      'icons/animals/delapouite/bear-head.svg',
      'icons/animals/delapouite/camel-head.svg',
      'icons/animals/delapouite/cassowary-head.svg',
      'icons/animals/delapouite/charging-bull.svg',
      'icons/animals/delapouite/chicken.svg',
      'icons/animals/delapouite/clownfish.svg',
      'icons/animals/delapouite/cow.svg',
      'icons/animals/delapouite/cricket.svg',
      'icons/animals/delapouite/deer-track.svg',
      'icons/animals/delapouite/dog-bowl.svg',
      'icons/animals/delapouite/dog-house.svg',
      'icons/animals/delapouite/dolphin.svg',
      'icons/animals/delapouite/duck.svg',
      'icons/animals/delapouite/eagle-head.svg',
      'icons/animals/delapouite/elephant-head.svg',
      'icons/animals/delapouite/elephant.svg',
      'icons/animals/delapouite/falcon-moon.svg',
      'icons/animals/delapouite/feline.svg',
      'icons/animals/delapouite/finch.svg',
      'icons/animals/delapouite/flamingo.svg',
      'icons/animals/delapouite/fox-tail.svg',
      'icons/animals/delapouite/giant-squid.svg',
      'icons/animals/delapouite/gorilla.svg',
      'icons/animals/delapouite/griffin-symbol.svg',
      'icons/animals/delapouite/honey-jar.svg',
      'icons/animals/delapouite/horse-head.svg',
      'icons/animals/delapouite/horseshoe.svg',
      'icons/animals/delapouite/ivory-tusks.svg',
      'icons/animals/delapouite/kangaroo.svg',
      'icons/animals/delapouite/koala.svg',
      'icons/animals/delapouite/labrador-head.svg',
      'icons/animals/delapouite/lynx-head.svg',
      'icons/animals/delapouite/manta-ray.svg',
      'icons/animals/delapouite/moon-bats.svg',
      'icons/animals/delapouite/panda.svg',
      'icons/animals/delapouite/penguin.svg',
      'icons/animals/delapouite/pinata.svg',
      'icons/animals/delapouite/praying-mantis.svg',
      'icons/animals/delapouite/rabbit.svg',
      'icons/animals/delapouite/rat.svg',
      'icons/animals/delapouite/rhinoceros-horn.svg',
      'icons/animals/delapouite/rooster.svg',
      'icons/animals/delapouite/saddle.svg',
      'icons/animals/delapouite/sea-star.svg',
      'icons/animals/delapouite/sea-urchin.svg',
      'icons/animals/delapouite/seahorse.svg',
      'icons/animals/delapouite/shark-bite.svg',
      'icons/animals/delapouite/shark-fin.svg',
      'icons/animals/delapouite/sheep.svg',
      'icons/animals/delapouite/snail-eyes.svg',
      'icons/animals/delapouite/sperm-whale.svg',
      'icons/animals/delapouite/stable.svg',
      'icons/animals/delapouite/tiger-head.svg',
      'icons/animals/delapouite/tiger.svg',
      'icons/animals/delapouite/tortoise.svg',
      'icons/animals/delapouite/toucan.svg',
      'icons/animals/delapouite/trojan-horse.svg',
      'icons/animals/delapouite/udder.svg',
      'icons/animals/delapouite/whale-tail.svg',
      'icons/animals/delapouite/wool.svg',
      'icons/animals/delapouite/worms.svg',
      'icons/animals/delapouite/yarn.svg',
      'icons/animals/lorc/ammonite-fossil.svg',
      'icons/animals/lorc/ammonite.svg',
      'icons/animals/lorc/angler-fish.svg',
      'icons/animals/lorc/angular-spider.svg',
      'icons/animals/lorc/animal-skull.svg',
      'icons/animals/lorc/armadillo-tail.svg',
      'icons/animals/lorc/bat-wing.svg',
      'icons/animals/lorc/bee.svg',
      'icons/animals/lorc/bird-twitter.svg',
      'icons/animals/lorc/boar-tusks.svg',
      'icons/animals/lorc/bull-horns.svg',
      'icons/animals/lorc/bull.svg',
      'icons/animals/lorc/butterfly-warning.svg',
      'icons/animals/lorc/butterfly.svg',
      'icons/animals/lorc/cat.svg',
      'icons/animals/lorc/centipede.svg',
      'icons/animals/lorc/chicken-leg.svg',
      'icons/animals/lorc/cobweb.svg',
      'icons/animals/lorc/crab-claw.svg',
      'icons/animals/lorc/crab.svg',
      'icons/animals/lorc/croc-jaws.svg',
      'icons/animals/lorc/crossed-claws.svg',
      'icons/animals/lorc/crow-dive.svg',
      'icons/animals/lorc/desert-skull.svg',
      'icons/animals/lorc/dinosaur-rex.svg',
      'icons/animals/lorc/dragonfly.svg',
      'icons/animals/lorc/eagle-emblem.svg',
      'icons/animals/lorc/earwig.svg',
      'icons/animals/lorc/evil-bat.svg',
      'icons/animals/lorc/fish-corpse.svg',
      'icons/animals/lorc/fishbone.svg',
      'icons/animals/lorc/flat-paw-print.svg',
      'icons/animals/lorc/food-chain.svg',
      'icons/animals/lorc/fox-head.svg',
      'icons/animals/lorc/frog.svg',
      'icons/animals/lorc/gecko.svg',
      'icons/animals/lorc/gold-scarab.svg',
      'icons/animals/lorc/grasping-claws.svg',
      'icons/animals/lorc/hanging-spider.svg',
      'icons/animals/lorc/hollow-cat.svg',
      'icons/animals/lorc/hoof.svg',
      'icons/animals/lorc/horse-head.svg',
      'icons/animals/lorc/hound.svg',
      'icons/animals/lorc/insect-jaws.svg',
      'icons/animals/lorc/jellyfish.svg',
      'icons/animals/lorc/lamprey-mouth.svg',
      'icons/animals/lorc/leeching-worm.svg',
      'icons/animals/lorc/lion.svg',
      'icons/animals/lorc/maggot.svg',
      'icons/animals/lorc/masked-spider.svg',
      'icons/animals/lorc/minotaur.svg',
      'icons/animals/lorc/mite.svg',
      'icons/animals/lorc/monkey.svg',
      'icons/animals/lorc/mouse.svg',
      'icons/animals/lorc/octopus.svg',
      'icons/animals/lorc/ouroboros.svg',
      'icons/animals/lorc/owl.svg',
      'icons/animals/lorc/parmecia.svg',
      'icons/animals/lorc/parrot-head.svg',
      'icons/animals/lorc/paw-front.svg',
      'icons/animals/lorc/paw-heart.svg',
      'icons/animals/lorc/paw-print.svg',
      'icons/animals/lorc/paw.svg',
      'icons/animals/lorc/raven.svg',
      'icons/animals/lorc/roast-chicken.svg',
      'icons/animals/lorc/sad-crab.svg',
      'icons/animals/lorc/salamander.svg',
      'icons/animals/lorc/scarab-beetle.svg',
      'icons/animals/lorc/scorpion-tail.svg',
      'icons/animals/lorc/scorpion.svg',
      'icons/animals/lorc/sea-serpent.svg',
      'icons/animals/lorc/seated-mouse.svg',
      'icons/animals/lorc/shark-jaws.svg',
      'icons/animals/lorc/snail.svg',
      'icons/animals/lorc/snake-bite.svg',
      'icons/animals/lorc/snake-totem.svg',
      'icons/animals/lorc/snake.svg',
      'icons/animals/lorc/sonic-screech.svg',
      'icons/animals/lorc/spider-web.svg',
      'icons/animals/lorc/spiked-snail.svg',
      'icons/animals/lorc/squid-head.svg',
      'icons/animals/lorc/squid.svg',
      'icons/animals/lorc/stag-head.svg',
      'icons/animals/lorc/stomp.svg',
      'icons/animals/lorc/swan.svg',
      'icons/animals/lorc/tick.svg',
      'icons/animals/lorc/top-paw.svg',
      'icons/animals/lorc/trilobite.svg',
      'icons/animals/lorc/turd.svg',
      'icons/animals/lorc/turtle-shell.svg',
      'icons/animals/lorc/turtle.svg',
      'icons/animals/lorc/virus.svg',
      'icons/animals/lorc/vulture.svg',
      'icons/animals/lorc/wasp-sting.svg',
      'icons/animals/lorc/web-spit.svg',
      'icons/animals/lorc/werewolf.svg',
      'icons/animals/lorc/wolf-head.svg',
      'icons/animals/lorc/wolf-howl.svg',
      'icons/animals/lorc/wolverine-claws.svg',
      'icons/animals/lorc/worm-mouth.svg',
      'icons/animals/sbed/big-egg.svg',
      'icons/animals/sbed/claw.svg',
      'icons/animals/sbed/poison.svg',
      'icons/animals/skoll/bat.svg',
      'icons/animals/skoll/chess-knight.svg',
      'icons/animals/skoll/donkey.svg',
      'icons/animals/skoll/goat.svg',
      'icons/animals/skoll/long-legged-spider.svg',
      'icons/animals/skoll/mounted-knight.svg',
      'icons/animals/skoll/pegasus.svg',
      'icons/animals/skoll/pig.svg',
      'icons/animals/sparker/bear-face.svg'
    ];
    
    // Helper to convert filename to display name
    const filenameToName = (filePath) => {
      // Extract filename from path
      const filename = filePath.split('/').pop();
      // Remove .svg extension
      let name = filename.replace(/\.svg$/i, '');
      // Replace hyphens and underscores with spaces
      name = name.replace(/[-_]/g, ' ');
      // Capitalize words
      return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    // Convert file paths to icon objects
    this.availableIcons = iconFilePaths.map(path => ({
      path: path,
      name: filenameToName(path)
    }));
  }

  // Get a random icon (synchronously, assuming icons are pre-loaded)
  getRandomIcon() {
    if (this.availableIcons.length === 0) {
      // Fallback if icons aren't loaded
      return {
        path: '',
        name: 'Product'
      };
    }
    const randomIndex = Math.floor(Math.random() * this.availableIcons.length);
    return this.availableIcons[randomIndex];
  }

  // Generate a random economy DAG
  generateRandomEconomy(numNodes, maxDepth, minInputs, maxInputs) {
    const manager = new EconomyManager();
    
    if (numNodes <= 0) {
      throw new Error('Number of nodes must be greater than 0');
    }
    
    if (maxDepth < 0) {
      throw new Error('Max depth must be non-negative');
    }
    
    if (minInputs < 0 || maxInputs < minInputs) {
      throw new Error('Invalid input range');
    }

    // Ensure we have enough icons
    if (this.availableIcons.length < numNodes) {
      console.warn(`Only ${this.availableIcons.length} icons available, but ${numNodes} nodes requested. Some icons will be reused.`);
    }

    // Shuffle available icons to avoid duplicates
    const shuffledIcons = [...this.availableIcons].sort(() => Math.random() - 0.5);
    let iconIndex = 0;

    // Track nodes by depth
    const nodesByDepth = [];
    for (let i = 0; i <= maxDepth; i++) {
      nodesByDepth.push([]);
    }

    // Step 1: Create raw materials (depth 0)
    const numRawMaterials = Math.max(1, Math.floor(numNodes / (maxDepth + 1)));
    for (let i = 0; i < numRawMaterials && i < numNodes; i++) {
      const icon = shuffledIcons[iconIndex % shuffledIcons.length];
      iconIndex++;
      const nodeId = manager.addNode(icon.name, icon.path, []);
      nodesByDepth[0].push(nodeId);
    }

    let createdNodes = numRawMaterials;

    // Step 2: Create nodes at each depth level
    for (let depth = 1; depth <= maxDepth && createdNodes < numNodes; depth++) {
      const nodesAtPrevDepth = nodesByDepth[depth - 1];
      if (nodesAtPrevDepth.length === 0) break; // Can't create nodes if no inputs available

      // Calculate how many nodes to create at this depth
      const remainingNodes = numNodes - createdNodes;
      const nodesAtThisDepth = Math.min(
        remainingNodes,
        Math.max(1, Math.floor((numNodes - numRawMaterials) / maxDepth))
      );

      for (let i = 0; i < nodesAtThisDepth && createdNodes < numNodes; i++) {
        const icon = shuffledIcons[iconIndex % shuffledIcons.length];
        iconIndex++;

        // Determine number of inputs for this node
        const numInputs = Math.floor(Math.random() * (maxInputs - minInputs + 1)) + minInputs;
        
        // Select random input nodes from previous depth levels
        const availableInputs = [];
        for (let d = 0; d < depth; d++) {
          availableInputs.push(...nodesByDepth[d]);
        }

        // Shuffle and select inputs
        const shuffledInputs = [...availableInputs].sort(() => Math.random() - 0.5);
        const selectedInputs = shuffledInputs.slice(0, Math.min(numInputs, availableInputs.length));

        // Create inputs array with random amounts
        const inputs = selectedInputs.map(inputId => ({
          productId: inputId,
          amount: Math.round((Math.random() * 9 + 1) * 10) / 10 // Random amount between 1.0 and 10.0
        }));

        try {
          const nodeId = manager.addNode(icon.name, icon.path, inputs);
          nodesByDepth[depth].push(nodeId);
          createdNodes++;
        } catch (error) {
          console.warn(`Failed to create node at depth ${depth}:`, error.message);
          // Try with fewer inputs
          if (inputs.length > 1) {
            const reducedInputs = inputs.slice(0, Math.floor(inputs.length / 2));
            try {
              const nodeId = manager.addNode(icon.name, icon.path, reducedInputs);
              nodesByDepth[depth].push(nodeId);
              createdNodes++;
            } catch (e) {
              console.warn(`Failed to create node even with reduced inputs:`, e.message);
            }
          }
        }
      }
    }

    // Step 3: If we haven't created enough nodes, add more at random depths
    while (createdNodes < numNodes) {
      const icon = shuffledIcons[iconIndex % shuffledIcons.length];
      iconIndex++;

      // Choose a random depth (but ensure we have inputs available)
      let depth = Math.floor(Math.random() * (maxDepth + 1));
      let availableInputs = [];
      
      for (let d = 0; d < depth; d++) {
        availableInputs.push(...nodesByDepth[d]);
      }

      // If no inputs available at chosen depth, use depth 1
      if (availableInputs.length === 0 && depth > 0) {
        depth = 1;
        availableInputs = nodesByDepth[0];
      }

      if (availableInputs.length === 0) {
        // Can't create more nodes
        break;
      }

      const numInputs = Math.min(
        Math.floor(Math.random() * (maxInputs - minInputs + 1)) + minInputs,
        availableInputs.length
      );

      const shuffledInputs = [...availableInputs].sort(() => Math.random() - 0.5);
      const selectedInputs = shuffledInputs.slice(0, numInputs);

      const inputs = selectedInputs.map(inputId => ({
        productId: inputId,
        amount: Math.round((Math.random() * 9 + 1) * 10) / 10
      }));

      try {
        const nodeId = manager.addNode(icon.name, icon.path, inputs);
        if (!nodesByDepth[depth]) {
          nodesByDepth[depth] = [];
        }
        nodesByDepth[depth].push(nodeId);
        createdNodes++;
      } catch (error) {
        console.warn(`Failed to create additional node:`, error.message);
        // Try with a single input
        if (inputs.length > 0) {
          try {
            const nodeId = manager.addNode(icon.name, icon.path, [inputs[0]]);
            if (!nodesByDepth[depth]) {
              nodesByDepth[depth] = [];
            }
            nodesByDepth[depth].push(nodeId);
            createdNodes++;
          } catch (e) {
            // Give up on this node
            break;
          }
        }
      }
    }

    return manager;
  }
}

