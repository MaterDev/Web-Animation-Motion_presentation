/* ── ai-history · the §3 map dataset ─────────────────────────────────
   Read at build time by scripts/vendor.js (Bun, ESM), so this file is
   plain ESM with zero imports — a dependency here would mean the deck
   cannot be built on a plane.

   The deck's standing rule is "measured, not claimed": a number on a
   sheet is a number someone in the room can check. History gets the
   same treatment. Every node and every edge carries a source, because
   the failure mode for a slide like this is not being boring, it is
   being confidently wrong in front of people who know the field.

   Two rules that shaped the data more than anything else:

   1. EDGES ARE MOVEMENTS, NOT INFLUENCE. "X inspired Y" is unfalsifiable
      and infinitely paddable; "Hinton leaves CMU for Toronto in 1987" is
      a fact with a date and a payroll behind it. Roughly a dozen
      plausible-looking arrows were cut for failing this test — the
      dropped set is recorded at the bottom of this file so nobody
      re-derives them later and thinks they were an oversight.

   2. NODES ARE PLACE ANCHORS AS WELL AS EVENTS. A node is one dateable
      event, but on the map it is also the only pin its city has. So an
      edge that lands in Pittsburgh in 1987 points at the CMU node even
      though that node's own event is 1980. Each such edge says so in
      `what`. The alternative — a second invisible node per institution
      — doubles the dataset to make the arrows prettier.

   Coordinates are the real coordinates of the named place, to about a
   building's precision where the building is known and to city centre
   where the work was spread across a metro area. They are projected,
   so a plausible-looking wrong number lands in the wrong ocean. */

/** @typedef {{ id:string, year:number, label:string, place:string,
 *   lat:number, lon:number, level:number, sources:string[], unverified?:boolean, note?:string }} Node */

/* `level` is the zoom at which a node earns a label: 0 survives the
   world view, 3 only appears once the camera is inside a building.
   It is editorial, not sourced — it ranks how much of the room already
   knows the name, which is a claim about the audience, not history. */

/** @type {Node[]} */
export const NODES = [
  {
    id: 'mcculloch-pitts',
    year: 1943,
    label: 'A Logical Calculus of the Ideas Immanent in Nervous Activity',
    place: 'Chicago, Illinois',
    lat: 41.8781, lon: -87.6298, level: 1,
    sources: [
      'McCulloch, W.S. & Pitts, W. (1943). Bulletin of Mathematical Biophysics 5(4):115-133. https://doi.org/10.1007/BF02478259'
    ],
    note: 'City centre, not a campus pin: McCulloch was at the University of Illinois College of Medicine and Pitts at the University of Chicago, on opposite sides of the same city.'
  },
  {
    id: 'turing-mind',
    year: 1950,
    label: 'Turing, "Computing Machinery and Intelligence"',
    place: 'University of Manchester, England',
    lat: 53.4668, lon: -2.2339, level: 0,
    sources: [
      'Turing, A.M. (1950). Mind LIX(236):433-460. https://doi.org/10.1093/mind/LIX.236.433'
    ]
  },
  {
    id: 'logic-theorist',
    year: 1956,
    label: 'The Logic Theorist runs on JOHNNIAC',
    place: 'RAND Corporation, Santa Monica, California',
    lat: 34.0141, lon: -118.4917, level: 2,
    sources: [
      'Newell, A. & Simon, H.A. (1956). "The logic theory machine: A complex information processing system", IRE Transactions on Information Theory 2(3):61-79. https://doi.org/10.1109/TIT.1956.1056797',
      'https://en.wikipedia.org/wiki/Logic_Theorist'
    ],
    note: 'Placed at RAND because that is where JOHNNIAC was and where Newell was employed; Simon was at Carnegie Tech in Pittsburgh. The program had two addresses.'
  },
  {
    id: 'dartmouth',
    year: 1956,
    label: 'Dartmouth Summer Research Project on Artificial Intelligence',
    place: 'Dartmouth College, Hanover, New Hampshire',
    lat: 43.7044, lon: -72.2887, level: 0,
    sources: [
      'McCarthy, Minsky, Rochester & Shannon (1955). "A Proposal for the Dartmouth Summer Research Project on Artificial Intelligence", dated 31 August 1955. http://jmc.stanford.edu/articles/dartmouth/dartmouth.pdf',
      'Reprinted: AI Magazine 27(4):12-14 (2006). https://doi.org/10.1609/aimag.v27i4.1904'
    ],
    note: 'The proposal is 1955; the workshop itself ran in the summer of 1956. The dataset dates the event, not the paperwork.'
  },
  {
    id: 'perceptron',
    year: 1958,
    label: 'Rosenblatt’s perceptron',
    place: 'Cornell Aeronautical Laboratory, Buffalo, New York',
    lat: 42.9403, lon: -78.7369, level: 0,
    sources: [
      'Rosenblatt, F. (1958). "The perceptron: A probabilistic model for information storage and organization in the brain", Psychological Review 65(6):386-408. https://doi.org/10.1037/h0042519',
      'Rosenblatt, F. (January 1957). "The Perceptron — a perceiving and recognizing automaton", Report 85-460-1, Cornell Aeronautical Laboratory, Buffalo NY.'
    ]
  },
  {
    id: 'mit-ai-project',
    year: 1959,
    label: 'McCarthy and Minsky found the MIT Artificial Intelligence Project',
    place: 'MIT, Cambridge, Massachusetts',
    lat: 42.3601, lon: -71.0942, level: 1,
    sources: [
      'https://www.britannica.com/biography/Marvin-Minsky',
      'https://en.wikipedia.org/wiki/MIT_Computer_Science_and_Artificial_Intelligence_Laboratory'
    ]
  },
  {
    id: 'sail',
    year: 1963,
    label: 'McCarthy founds the Stanford AI Project (SAIL from 1971)',
    place: 'Stanford University, Stanford, California',
    lat: 37.4275, lon: -122.1697, level: 1,
    sources: [
      'Stanford Libraries, "Stanford Artificial Intelligence Laboratory records, 1963-2009". https://archives.stanford.edu/findingaid/ark:/22236/s19dd6cb70-31a6-4036-9e63-4dd5167db665',
      'https://news.stanford.edu/stories/2011/10/stanfords-john-mccarthy-seminal-figure-artificial-intelligence-dies-84'
    ]
  },
  {
    id: 'eliza',
    year: 1966,
    label: 'Weizenbaum publishes ELIZA',
    place: 'MIT, Cambridge, Massachusetts',
    lat: 42.3601, lon: -71.0942, level: 1,
    sources: [
      'Weizenbaum, J. (1966). Communications of the ACM 9(1):36-45. https://doi.org/10.1145/365153.365168'
    ]
  },
  {
    id: 'sri-ai-center',
    year: 1966,
    label: 'Charles Rosen founds SRI’s Artificial Intelligence Center',
    place: 'Stanford Research Institute, Menlo Park, California',
    lat: 37.4562, lon: -122.1769, level: 2,
    sources: [
      'https://en.wikipedia.org/wiki/Artificial_Intelligence_Center',
      'https://en.wikipedia.org/wiki/Shakey_the_robot'
    ]
  },
  {
    id: 'perceptrons-book',
    year: 1969,
    label: 'Minsky and Papert, "Perceptrons"',
    place: 'MIT Press, Cambridge, Massachusetts',
    lat: 42.3601, lon: -71.0942, level: 1,
    sources: [
      'Minsky, M. & Papert, S. (1969). Perceptrons: An Introduction to Computational Geometry. MIT Press, Cambridge MA. ISBN 0-262-63022-2.'
    ]
  },
  {
    id: 'prolog',
    year: 1972,
    label: 'Colmerauer and Roussel build the first Prolog',
    place: 'Université d’Aix-Marseille, Luminy, France',
    lat: 43.2317, lon: 5.4406, level: 2,
    sources: [
      'Colmerauer, A. & Roussel, P. (1993). "The birth of Prolog", HOPL-II. https://doi.org/10.1145/154766.155362'
    ]
  },
  {
    id: 'neocognitron',
    year: 1980,
    label: 'Fukushima publishes the neocognitron',
    place: 'NHK Broadcasting Science Research Laboratories, Kinuta, Setagaya, Tokyo',
    lat: 35.6318, lon: 139.6199, level: 1,
    sources: [
      'Fukushima, K. (1980). Biological Cybernetics 36:193-202. https://doi.org/10.1007/BF00344251',
      'https://en.wikipedia.org/wiki/Neocognitron'
    ],
    note: 'Affiliation line of the 1980 paper gives the Kinuta, Setagaya address; the pin is that laboratory, not NHK’s broadcasting centre.'
  },
  {
    id: 'xcon',
    year: 1980,
    label: 'McDermott’s R1/XCON configures VAX orders',
    place: 'Carnegie Mellon University, Pittsburgh, Pennsylvania',
    lat: 40.4433, lon: -79.9436, level: 2,
    sources: [
      'McDermott, J. (1980). "R1: An Expert in the Computer Systems Domain", Proceedings of AAAI-80, pp. 269-271.',
      'McDermott, J. (1982). "R1: A rule-based configurer of computer systems", Artificial Intelligence 19(1):39-88. https://doi.org/10.1016/0004-3702(82)90021-2'
    ],
    note: 'Built at CMU, deployed inside Digital Equipment Corporation. Pinned where it was written. This node also serves as the map’s Pittsburgh anchor for the Newell, Hinton and Deep Thought edges.'
  },
  {
    id: 'hopfield',
    year: 1982,
    label: 'Hopfield networks',
    place: 'Caltech, Pasadena, California',
    lat: 34.1377, lon: -118.1253, level: 1,
    sources: [
      'Hopfield, J.J. (1982). PNAS 79(8):2554-2558. https://doi.org/10.1073/pnas.79.8.2554'
    ]
  },
  {
    id: 'pdp-backprop',
    year: 1986,
    label: 'Rumelhart, Hinton and Williams, "Learning representations by back-propagating errors"',
    place: 'UC San Diego, La Jolla, California',
    lat: 32.8801, lon: -117.2340, level: 0,
    sources: [
      'Rumelhart, D.E., Hinton, G.E. & Williams, R.J. (1986). Nature 323:533-536. https://doi.org/10.1038/323533a0',
      'https://today.ucsd.edu/story/nobel-prize-winner-godfather-of-ai-geoffrey-hinton-has-uc-san-diego-roots'
    ],
    note: 'Pinned at UCSD, home of the PDP group the work came out of, though by 1986 Hinton was at CMU. This node is also the map’s San Diego anchor.'
  },
  {
    id: 'lecun-zip',
    year: 1989,
    label: 'LeCun applies backpropagation to handwritten ZIP codes',
    place: 'AT&T Bell Laboratories, Holmdel, New Jersey',
    lat: 40.3907, lon: -74.1793, level: 1,
    sources: [
      'LeCun, Y. et al. (1989). Neural Computation 1(4):541-551. https://doi.org/10.1162/neco.1989.1.4.541',
      'https://amturing.acm.org/award_winners/lecun_6017366.cfm'
    ]
  },
  {
    id: 'udem-bengio',
    year: 1993,
    label: 'Bengio joins the Université de Montréal faculty',
    place: 'Université de Montréal, Montreal, Quebec',
    lat: 45.5048, lon: -73.6131, level: 2,
    sources: [
      'https://amturing.acm.org/award_winners/bengio_3406375.cfm',
      'https://mila.quebec/en/news/yoshua-bengio-is-awarded-the-the-nobel-prize-of-computing'
    ]
  },
  {
    id: 'lstm',
    year: 1997,
    label: 'Hochreiter and Schmidhuber publish LSTM',
    place: 'Lugano, Switzerland',
    lat: 46.0037, lon: 8.9511, level: 1,
    sources: [
      'Hochreiter, S. & Schmidhuber, J. (1997). Neural Computation 9(8):1735-1780. https://doi.org/10.1162/neco.1997.9.8.1735'
    ],
    note: 'Two addresses again: Schmidhuber at IDSIA near Lugano, Hochreiter at TU München. Pinned at IDSIA; the Munich half is unpinned.'
  },
  {
    id: 'deep-blue',
    year: 1997,
    label: 'Deep Blue defeats Kasparov',
    place: 'Equitable Center, New York City',
    lat: 40.7620, lon: -73.9818, level: 0,
    sources: [
      'https://www.ibm.com/history/deep-blue',
      'https://www.computerhistory.org/chess/challenging-the-world-champion/'
    ],
    note: 'The pin is the match venue in Manhattan. The machine was built at IBM Research, Yorktown Heights, about 60km north.'
  },
  {
    id: 'gatsby',
    year: 1998,
    label: 'Hinton founds the Gatsby Computational Neuroscience Unit',
    place: 'University College London, England',
    lat: 51.5246, lon: -0.1339, level: 2,
    sources: [
      'http://www.gatsby.ucl.ac.uk/',
      'https://www.cs.toronto.edu/~hinton/'
    ]
  },
  {
    id: 'deep-belief-nets',
    year: 2006,
    label: '"A fast learning algorithm for deep belief nets"',
    place: 'University of Toronto, Ontario',
    lat: 43.6629, lon: -79.3957, level: 1,
    sources: [
      'Hinton, G.E., Osindero, S. & Teh, Y.W. (2006). Neural Computation 18(7):1527-1554. https://doi.org/10.1162/neco.2006.18.7.1527'
    ],
    note: 'Also the map’s Toronto anchor for the 1987, 1988, 1998 and 2001 edges.'
  },
  {
    id: 'imagenet',
    year: 2009,
    label: 'ImageNet is published at CVPR',
    place: 'Princeton University, New Jersey',
    lat: 40.3431, lon: -74.6551, level: 0,
    sources: [
      'Deng, J., Dong, W., Socher, R., Li, L.-J., Li, K. & Fei-Fei, L. (2009). "ImageNet: A large-scale hierarchical image database", CVPR 2009. https://doi.org/10.1109/CVPR.2009.5206848'
    ]
  },
  {
    id: 'deepmind',
    year: 2010,
    label: 'DeepMind Technologies founded',
    place: 'London, England',
    lat: 51.5074, lon: -0.1278, level: 0,
    sources: [
      'https://en.wikipedia.org/wiki/Google_DeepMind',
      'https://www.ucl.ac.uk/news/2016/nov/neuroscience-intuition-and-superhumans-how-deepmind-co-founder-and-ucl-alumnus-demis'
    ],
    note: 'Founded September 2010 by Hassabis, Legg and Suleyman. Pinned at central London rather than the later King’s Cross headquarters, which the company did not occupy in 2010.'
  },
  {
    id: 'google-brain',
    year: 2011,
    label: 'The Google Brain project starts inside Google X',
    place: 'Google, Mountain View, California',
    lat: 37.4220, lon: -122.0841, level: 1,
    sources: [
      'https://en.wikipedia.org/wiki/Google_Brain',
      'https://www.historyofinformation.com/detail.php?id=5165'
    ]
  },
  {
    id: 'alexnet',
    year: 2012,
    label: 'AlexNet wins ILSVRC',
    place: 'University of Toronto, Ontario',
    lat: 43.6629, lon: -79.3957, level: 0,
    sources: [
      'Krizhevsky, A., Sutskever, I. & Hinton, G.E. (2012). "ImageNet Classification with Deep Convolutional Neural Networks", NIPS 2012; reprinted Communications of the ACM 60(6):84-90 (2017). https://doi.org/10.1145/3065386',
      'https://en.wikipedia.org/wiki/AlexNet'
    ]
  },
  {
    id: 'openai',
    year: 2015,
    label: 'OpenAI announced',
    place: 'San Francisco, California',
    lat: 37.7620, lon: -122.4116, level: 0,
    sources: [
      'Brockman, G., Sutskever, I. & the OpenAI team (11 December 2015). "Introducing OpenAI". https://openai.com/index/introducing-openai/'
    ]
  },
  {
    id: 'transformer',
    year: 2017,
    label: '"Attention Is All You Need"',
    place: 'Google, Mountain View, California',
    lat: 37.4220, lon: -122.0841, level: 0,
    sources: [
      'Vaswani, A. et al. (2017). arXiv:1706.03762. https://arxiv.org/abs/1706.03762'
    ]
  },
  {
    id: 'anthropic',
    year: 2021,
    label: 'Anthropic founded',
    place: 'San Francisco, California',
    lat: 37.7749, lon: -122.4194, level: 1,
    sources: [
      'Anthropic (28 May 2021). "Anthropic raises $124 million to build more reliable, general AI systems". https://www.anthropic.com/news/anthropic-raises-124-million-to-build-more-reliable-general-ai-systems'
    ],
    note: 'The company’s own first public announcement is the May 2021 Series A; incorporation earlier in 2021 is reported but not sourced here to a primary document.'
  },
  {
    id: 'chatgpt',
    year: 2022,
    label: 'ChatGPT released',
    place: 'San Francisco, California',
    lat: 37.7620, lon: -122.4116, level: 0,
    sources: [
      'OpenAI, "Introducing ChatGPT", blog post, 30 November 2022.',
      'https://en.wikipedia.org/wiki/ChatGPT'
    ],
    note: 'Cited by title and date rather than URL: the canonical openai.com permalink for this post could not be confirmed from here, and a guessed URL is worse than none.'
  },
  {
    id: 'nobel-2024',
    year: 2024,
    label: 'Hopfield and Hinton share the Nobel Prize in Physics',
    place: 'Royal Swedish Academy of Sciences, Stockholm',
    lat: 59.3717, lon: 18.0518, level: 0,
    sources: [
      'https://www.nobelprize.org/prizes/physics/2024/summary/'
    ]
  }
];

/** @typedef {{ from:string, to:string, year:number, kind:'person'|'spinout'|'acquisition'|'collab',
 *   what:string, sources:string[], unverified?:boolean, note?:string }} Edge */

/* Ordered by year, because the map animates them in that order and a
   list that is sorted in the file cannot drift out of sync with one
   that is sorted at runtime. */

/** @type {Edge[]} */
export const EDGES = [
  {
    from: 'logic-theorist', to: 'dartmouth', year: 1956, kind: 'collab',
    what: 'Newell and Simon bring the Logic Theorist from RAND and Carnegie Tech to the Dartmouth workshop',
    sources: [
      'https://en.wikipedia.org/wiki/Logic_Theorist',
      'https://www.historyofinformation.com/detail.php?id=742'
    ]
  },
  {
    from: 'dartmouth', to: 'mit-ai-project', year: 1958, kind: 'person',
    what: 'McCarthy leaves Dartmouth for the MIT faculty',
    sources: [
      'https://news.stanford.edu/stories/2011/10/stanfords-john-mccarthy-seminal-figure-artificial-intelligence-dies-84',
      'https://en.wikipedia.org/wiki/John_McCarthy_(computer_scientist)'
    ]
  },
  {
    from: 'dartmouth', to: 'mit-ai-project', year: 1958, kind: 'person',
    what: 'Minsky, a Dartmouth workshop organiser, leaves the Harvard Society of Fellows and MIT Lincoln Laboratory for the MIT mathematics faculty, and co-founds the AI Project with McCarthy the following year',
    sources: [
      'https://amturing.acm.org/award_winners/minsky_7440781.cfm',
      'https://www.mit.edu/~dxh/marvin/web.media.mit.edu/~minsky/minskybiog.html'
    ],
    note: 'Sources disagree at the edges: the mathematics appointment is dated 1958, while some biographies date full MIT faculty status to 1959. 1958 is taken as the year of the move.'
  },
  {
    from: 'logic-theorist', to: 'xcon', year: 1961, kind: 'person',
    what: 'Newell leaves the RAND Corporation for the Carnegie Institute of Technology faculty in Pittsburgh',
    sources: [
      'https://www.britannica.com/biography/Allen-Newell',
      'https://en.wikipedia.org/wiki/Allen_Newell'
    ],
    note: 'Newell had physically relocated to Pittsburgh in 1955 while still on RAND’s payroll; 1961 is the year the employment moved. The `to` node is the map’s Pittsburgh anchor.'
  },
  {
    from: 'mit-ai-project', to: 'sail', year: 1962, kind: 'person',
    what: 'McCarthy leaves MIT for Stanford, founding the Stanford AI Project the next year',
    sources: [
      'https://news.stanford.edu/stories/2011/10/stanfords-john-mccarthy-seminal-figure-artificial-intelligence-dies-84',
      'https://archives.stanford.edu/findingaid/ark:/22236/s19dd6cb70-31a6-4036-9e63-4dd5167db665'
    ]
  },
  {
    from: 'sail', to: 'xcon', year: 1969, kind: 'person',
    what: 'Raj Reddy leaves the Stanford AI Lab for an associate professorship at Carnegie Mellon',
    sources: [
      'https://amturing.acm.org/award_winners/reddy_9634208.cfm',
      'https://www.ri.cmu.edu/ri-faculty/raj-reddy/'
    ],
    note: '`to` is the Pittsburgh anchor node.'
  },
  {
    from: 'sail', to: 'sri-ai-center', year: 1970, kind: 'spinout',
    what: 'Stanford University divests Stanford Research Institute, which becomes an independent organisation',
    sources: [
      'https://en.wikipedia.org/wiki/SRI_International',
      'https://www.informs.org/Explore/History-of-O.R.-Excellence/Non-Academic-Institutions/Stanford-Research-Institute'
    ],
    note: 'Institutional separation, not a lab spinout: `from` is the map’s Stanford anchor.'
  },
  {
    from: 'pdp-backprop', to: 'xcon', year: 1982, kind: 'person',
    what: 'Hinton leaves the UC San Diego PDP group for the Carnegie Mellon faculty',
    sources: [
      'https://today.ucsd.edu/story/nobel-prize-winner-godfather-of-ai-geoffrey-hinton-has-uc-san-diego-roots',
      'https://www.britannica.com/biography/Geoffrey-Hinton'
    ],
    note: 'Both endpoints are place anchors: Hinton was at UCSD 1978-80 and again in spring 1982, four years before the Nature paper this node dates.'
  },
  {
    from: 'xcon', to: 'deep-belief-nets', year: 1987, kind: 'person',
    what: 'Hinton leaves Carnegie Mellon for the University of Toronto',
    sources: [
      'https://www.britannica.com/biography/Geoffrey-Hinton',
      'https://www.cs.toronto.edu/~hinton/'
    ]
  },
  {
    from: 'deep-belief-nets', to: 'lecun-zip', year: 1988, kind: 'person',
    what: 'LeCun leaves Hinton’s Toronto lab after a postdoc for the Adaptive Systems Research Department at AT&T Bell Laboratories, Holmdel',
    sources: [
      'https://amturing.acm.org/award_winners/lecun_6017366.cfm',
      'https://en.wikipedia.org/wiki/Yann_LeCun'
    ]
  },
  {
    from: 'xcon', to: 'deep-blue', year: 1989, kind: 'person',
    what: 'IBM hires the Carnegie Mellon Deep Thought team — Hsu, Campbell and Anantharaman — and the machine becomes Deep Blue',
    sources: [
      'https://www.ibm.com/history/deep-blue',
      'https://en.wikipedia.org/wiki/Deep_Thought_(chess_computer)'
    ],
    note: 'The team moved to IBM Research at Yorktown Heights; the `to` node is pinned at the 1997 match venue in Manhattan.'
  },
  {
    from: 'lecun-zip', to: 'udem-bengio', year: 1993, kind: 'person',
    what: 'Bengio leaves a Bell Labs postdoc alongside LeCun for an assistant professorship at the Université de Montréal',
    sources: [
      'https://amturing.acm.org/award_winners/bengio_3406375.cfm',
      'https://en.wikipedia.org/wiki/Yoshua_Bengio'
    ]
  },
  {
    from: 'deep-belief-nets', to: 'gatsby', year: 1998, kind: 'person',
    what: 'Hinton leaves Toronto for UCL to set up the Gatsby Computational Neuroscience Unit as its founding director',
    sources: [
      'https://www.cs.toronto.edu/~hinton/',
      'http://www.gatsby.ucl.ac.uk/'
    ]
  },
  {
    from: 'gatsby', to: 'deep-belief-nets', year: 2001, kind: 'person',
    what: 'Hinton leaves the Gatsby Unit after three years and returns to the University of Toronto',
    sources: [
      'https://www.cs.toronto.edu/~hinton/',
      'https://amturing.acm.org/award_winners/hinton_4791679.cfm'
    ]
  },
  {
    from: 'imagenet', to: 'sail', year: 2009, kind: 'person',
    what: 'Fei-Fei Li leaves Princeton for Stanford, taking the ImageNet project with her',
    sources: [
      'https://profiles.stanford.edu/fei-fei-li',
      'https://www.britannica.com/biography/Fei-Fei-Li'
    ]
  },
  {
    from: 'gatsby', to: 'deepmind', year: 2010, kind: 'person',
    what: 'Hassabis leaves a Wellcome Trust fellowship at the Gatsby Unit and co-founds DeepMind with Legg and Suleyman',
    sources: [
      'https://www.ucl.ac.uk/news/2016/nov/neuroscience-intuition-and-superhumans-how-deepmind-co-founder-and-ucl-alumnus-demis',
      'https://en.wikipedia.org/wiki/Demis_Hassabis'
    ]
  },
  {
    from: 'sail', to: 'google-brain', year: 2011, kind: 'person',
    what: 'Stanford professor Andrew Ng joins Jeff Dean and Greg Corrado at Google to start the Brain project',
    sources: [
      'https://en.wikipedia.org/wiki/Google_Brain',
      'https://www.historyofinformation.com/detail.php?id=5165'
    ]
  },
  {
    from: 'alexnet', to: 'google-brain', year: 2013, kind: 'acquisition',
    what: 'Google acquires DNNresearch, the Toronto company held by Hinton, Krizhevsky and Sutskever; Krizhevsky and Sutskever join Google',
    sources: [
      'https://www.cbc.ca/news/science/google-buys-university-of-toronto-startup-1.1373641',
      'https://techcrunch.com/2013/03/12/google-scoops-up-neural-networks-startup-dnnresearch-to-boost-its-voice-and-image-search-tech'
    ]
  },
  {
    from: 'deepmind', to: 'google-brain', year: 2014, kind: 'acquisition',
    what: 'Google acquires DeepMind',
    sources: [
      'https://en.wikipedia.org/wiki/Google_DeepMind',
      'https://www.britannica.com/topic/Google-DeepMind'
    ]
  },
  {
    from: 'google-brain', to: 'openai', year: 2015, kind: 'person',
    what: 'Sutskever leaves Google to become OpenAI’s research director at its founding',
    sources: [
      'https://openai.com/index/introducing-openai/',
      'https://en.wikipedia.org/wiki/OpenAI'
    ]
  },
  {
    from: 'google-brain', to: 'transformer', year: 2017, kind: 'collab',
    what: 'Eight authors across Google Brain, Google Research and an intern from Toronto form the team that writes "Attention Is All You Need"',
    sources: [
      'Vaswani, A. et al. (2017). arXiv:1706.03762 — author affiliation block. https://arxiv.org/abs/1706.03762'
    ],
    note: 'Sourced only to the paper’s own affiliation lines, which is what makes it checkable; the internal team history is not.'
  },
  {
    from: 'openai', to: 'anthropic', year: 2021, kind: 'spinout',
    what: 'Dario and Daniela Amodei leave OpenAI with a group of colleagues and found Anthropic',
    sources: [
      'https://www.anthropic.com/news/anthropic-raises-124-million-to-build-more-reliable-general-ai-systems',
      'https://en.wikipedia.org/wiki/Anthropic'
    ]
  }
];

/** Semantic-zoom levels for the §3 map camera: world → region → city → building.
 *  The chain deliberately ends on Dartmouth Hall — the talk's landing point — so
 *  the camera path is data, not a hand-animated flight the code has to keep in sync. */
export const LEVELS = [
  { k: 1,   lat: 20.0000, lon:    0.0000, label: 'World',                    minRank: 0 },
  { k: 6,   lat: 43.5000, lon:  -72.5000, label: 'Northeastern North America', minRank: 1 },
  { k: 48,  lat: 43.7022, lon:  -72.2896, label: 'Hanover, New Hampshire',   minRank: 2 },
  { k: 384, lat: 43.7044, lon:  -72.2887, label: 'Dartmouth College, 1956',  minRank: 3 }
];

/* ── activity ─────────────────────────────────────────────────────────
   The timeline scrubber needs a height per year. The temptation is to
   author those heights, which would make the curve an opinion dressed
   as a measurement — exactly the thing this deck argues against. So it
   is derived, and the derivation only ever counts things:

     window   nodes and edges within ±W years of y (W = 2, the one
              structural knob: it is the smoothing radius, and it is
              shared by all three terms so it cannot be tuned per-year)
     nodes    how many node events fall in that window
     edges    how many movements fall in that window
     degree   summed edge degree of those in-window nodes — a node that
              people moved through repeatedly counts for more than an
              isolated paper, without anyone deciding by how much

     raw      = nodes + edges + degree
     magnitude = raw / max(raw over all years)   → 0..1

   Change the dataset and the curve changes. There is nowhere to put a
   thumb on the scale, which is the point. */

const ACTIVITY_WINDOW = 2;

/**
 * @param {Node[]} nodes
 * @param {Edge[]} edges
 */
export function deriveActivity(nodes, edges) {
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }

  const years = nodes.map((n) => n.year).concat(edges.map((e) => e.year));
  const first = Math.min(...years);
  const last = Math.max(...years);

  const rows = [];
  for (let y = first; y <= last; y++) {
    const inWindow = nodes.filter((n) => Math.abs(n.year - y) <= ACTIVITY_WINDOW);
    const moves = edges.filter((e) => Math.abs(e.year - y) <= ACTIVITY_WINDOW);
    const deg = inWindow.reduce((sum, n) => sum + (degree.get(n.id) ?? 0), 0);
    rows.push({
      year: y,
      nodes: inWindow.length,
      edges: moves.length,
      degree: deg,
      raw: inWindow.length + moves.length + deg,
      magnitude: 0
    });
  }

  const peak = rows.reduce((m, r) => Math.max(m, r.raw), 0) || 1;
  for (const r of rows) r.magnitude = r.raw / peak;
  return rows;
}

/** Per-year activity, derived — never authored. */
export const ACTIVITY = deriveActivity(NODES, EDGES);

/* ── validate ─────────────────────────────────────────────────────────
   Runs at build time and throws, because a silently-empty sources array
   is the one defect that survives visual QC: the map still draws. */
export function validate() {
  const problems = [];
  const seen = new Set();
  const ids = new Set(NODES.map((n) => n.id));

  for (const n of NODES) {
    if (seen.has(n.id)) problems.push(`duplicate node id: ${n.id}`);
    seen.add(n.id);
    if (!Array.isArray(n.sources) || n.sources.length === 0) problems.push(`node ${n.id} has no sources`);
    if (!(n.lat >= -90 && n.lat <= 90)) problems.push(`node ${n.id} lat out of range: ${n.lat}`);
    if (!(n.lon >= -180 && n.lon <= 180)) problems.push(`node ${n.id} lon out of range: ${n.lon}`);
    if (!(n.year >= 1943 && n.year <= 2024)) problems.push(`node ${n.id} year out of range: ${n.year}`);
  }

  for (const e of EDGES) {
    const tag = `${e.from}->${e.to}@${e.year}`;
    if (!ids.has(e.from)) problems.push(`edge ${tag} references unknown node: ${e.from}`);
    if (!ids.has(e.to)) problems.push(`edge ${tag} references unknown node: ${e.to}`);
    if (!Array.isArray(e.sources) || e.sources.length === 0) problems.push(`edge ${tag} has no sources`);
    if (!(e.year >= 1943 && e.year <= 2024)) problems.push(`edge ${tag} year out of range: ${e.year}`);
  }

  for (const l of LEVELS) {
    if (!(l.lat >= -90 && l.lat <= 90)) problems.push(`level ${l.label} lat out of range: ${l.lat}`);
    if (!(l.lon >= -180 && l.lon <= 180)) problems.push(`level ${l.label} lon out of range: ${l.lon}`);
  }

  if (problems.length) throw new Error(`ai-history dataset invalid:\n  ${problems.join('\n  ')}`);
  return true;
}

/* ── movements that were considered and dropped ───────────────────────
   Kept so the omissions read as decisions rather than gaps. Each of
   these is a real relationship; none of them is a movement with a year
   and an institution on both ends, which is the bar for an EDGES entry.

     McCulloch/Pitts → Rosenblatt        influence, not a movement
     Perceptrons (1969) → the AI winter   a funding climate, undateable
     Neocognitron → LeCun's convnets      acknowledged lineage, no move
     Hopfield → Boltzmann machines        idea transfer between labs
     Prolog → Japan's Fifth Generation    programme adoption, no person
     Hochreiter ← Schmidhuber (TU München → IDSIA) — the collaboration is
       real and the 1991 thesis is real, but the dataset has no Munich
       node to hang it on and inventing one for a single arrow is worse
     Shakey → A* / STRIPS → modern planning: technique diffusion
     ImageNet → AlexNet                   a benchmark being entered
     Google Brain → DeepMind merger (2023) is a real institutional move
       but falls outside the 1943-2024 window's narrative and would
       double-count the Mountain View anchor
     Transformer authors → Cohere / Character.AI / Inceptive etc.: each
       departure is individually reported, but the set is large, the
       dates are scattered across 2019-2022, and several destinations
       have no node here. Better as a single spoken sentence than as
       eight half-sourced arrows. */
