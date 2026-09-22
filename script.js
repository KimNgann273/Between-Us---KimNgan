const SCRIPT = {
  drifting: {
    enter: [
      'Before there was a network, there was a thing.',
      "Drifting. Unanchored. Nothing asks anything of you.",
      'You exist in absolute autonomy, no one needs you, and no one expects a single thing from you.',
      'Eventually, the drift slows... and you have to land.',
      '(scroll to look around)',
    ],
    zoomedOut: [
      "You take root in the quiet dark.",
      "And you're not the only one looking for somewhere to grow.",
    ]
  },

  receiving: {
    enter: [
      "The ground is quiet, but that doesn't mean it's empty.",
      '(click the spore and guide it to the nutrient.)',
    ],
    germinated: [
      "You begin to grow—a single thread pushing blindly into the cold substrate.",
    ],
    sensed: [                      // a hypha nears the Nutrient
      "There's something out there in the dark. You can feel its warmth, so you reach...",
    ],
    stalled: [                     // every hypha has weakened and stopped
      "The strain sets in. Your energy drains out into the soil, and your tendril freezes.",
      "It's too far. You can't make it on your own.",
    ],
    gotThereFirst: [               // the other network reaches the Nutrient
      'Someone got there first.'
    ],
    revived: [                     // the nutrients arrive through the fusion
      "They reached what you couldn't. You survive because of them.",
      "You didn't ask to be saved... but now, the debt is written into your roots.",
    ]
  },

  giving: {
    enter: [
      'You remember the feeling.',
      "Someone reached you when you couldn't reach far enough.",
      'So you reach back.',
      '(scroll to zoom out)'
    ],
    firstJoin: [                   // your hyphae reach the first struggling spore
      'One connection becomes another.',
      'You give what you have.',
      'They grow.',
      '(drag a glowing spore, or click one)'
    ],
    handedOn: [                    // a spore you helped goes on to help another
      "Because they grow, the next spore reaches further, and the next, binding every living point to the same beating pulse.",
    ],
    firstPull: [                   // the viewer pulls a spore
      'You moved one. The other moves too.',
      "You are no longer an individual—you are maintaining a system."
    ],
    done: [                        // enough of the network has joined
      "At some point, helping stops feeling like a choice.",
      "Bound to all, you cannot pull away without tearing the web that keeps you alive.",
    ]
  },

  // The Outro. Played one at a time, each line arriving whole rather than word
  // by word (ui.js), because the ending should not be hurried.
  closing: [
    'You were helped.', 
    "So you helped someone else.",
    "They helped another, and somewhere along the way, help became something everyone depended on.",
    "No one stands alone anymore.",
    "You support the network, and the network supports you.",
  ],
};
