export type InterviewSection = {
  question: string;
  answers: string[];
};

export type InterviewFact = {
  label: string;
  value: string;
};

export type InterviewLink = {
  label: string;
  href: string;
};

export type InterviewExtraImage = {
  src: string;
  alt: string;
};

export type InterviewEntry = {
  slug: string;
  title: string;
  description?: string;
  image: string;
  imageAlt: string;
  name: string;
  role: string;
  facts: InterviewFact[];
  sections: InterviewSection[];
  quickHits: InterviewFact[];
  links?: InterviewLink[];
  extraImages?: InterviewExtraImage[];
};

export const interviews: InterviewEntry[] = [
  {
    slug: "julie-tooby",
    title: "Business Leaders on Sports Lounge",
    description: "Sports Lounge Interviews Founder of Synergy Link - Julie Tooby",
    image: "/Picture1-1.jpg",
    imageAlt: "Julie Tooby",
    name: "Julie Tooby",
    role: "Founder & Director",
    facts: [
      { label: "Company Name", value: "Synergy Link" },
      { label: "Industry", value: "Business Growth Consultancy & Curated Strategic Events" },
    ],
    sections: [
      {
        question: "About the Company in a couple of sentences?",
        answers: [
          "Synergy Link is a consultancy built for business growth. We help leaders connect the dots between strategy, people and opportunity - blending consultancy with curated, purpose-led events.",
          "Our approach is both practical and dynamic, guiding businesses through clarity, positioning and momentum with our Think. Plan. Execute. framework.",
        ],
      },
      {
        question: "What inspired you to start your own business?",
        answers: [
          "I wanted to build something that felt human - and impactful. Too often, strategy feels abstract and disconnected.",
          "I saw the opportunity to offer something different: strategic thinking that's grounded in people, purpose, and doing things properly. That's what Synergy Link stands for - and why Think. Plan. Execute. is more than a tagline - it's our way of working.",
        ],
      },
      {
        question: "What were the biggest challenges you faced when starting out?",
        answers: [
          "Doing everything at once - with limited resource and all eyes on you. But it's also where you find your strength. You learn fast, trust yourself more, and surround yourself with people who lift you.",
        ],
      },
      {
        question: "How do you handle failure or setbacks?",
        answers: [
          "Reflection first. I always ask, \"Is this a lesson, a redirection, or a reminder?\" Then it's back to the why - because purpose makes the tough days worthwhile.",
        ],
      },
      {
        question: "What skills do you consider most important for a business owner?",
        answers: [
          "Empathy. Resilience. Vision. The ability to both zoom out for the big picture and zoom in on the detail - and to build brilliant relationships at every level.",
        ],
      },
      {
        question: "What key lessons have you learned about business ownership?",
        answers: [
          "Clarity and consistency are everything. Keep refining your offer, keep tuning into what your audience needs, and be bold enough to evolve.",
          "Also - no one expects you to have all the answers. Ask better questions.",
        ],
      },
      {
        question: "How do you push through your biggest business doubts?",
        answers: [
          "By anchoring back to community and value. Synergy Link is built on connection - from boardroom strategy to curated events that create real visibility and commercial alignment.",
          "Our sessions are designed to elevate thinking and spark opportunities - especially for women in business navigating leadership and growth. It's a space for energy, challenge and progression.",
        ],
      },
      {
        question: "Does your business engage in community or charity projects?",
        answers: [
          "Yes - Synergy Link leads with purpose. Alongside our consultancy and growth sessions, we design curated events that spotlight diverse voices and foster inclusive business environments.",
          "We're proud to support charitable initiatives including the Sedulo Foundation and other causes focused on social mobility, inclusion and mental wellbeing.",
        ],
      },
      {
        question: "How much time do you spend working on your business each day?",
        answers: [
          "Every day brings something different - but I make sure there's always protected time to work on the business, not just in it.",
          "Whether that's mapping out growth plans, nurturing client journeys or shaping our next curated event, it's that balance that keeps us agile and inspired.",
        ],
      },
      {
        question: "If you could give just one piece of advice to someone starting a business - what would it be?",
        answers: [
          "Back yourself. Especially if you're a woman stepping into the unknown - your voice, your vision, your value matters. Don't wait for perfect conditions. Start where you are, build as you go.",
        ],
      },
    ],
    quickHits: [
      { label: "Favourite Sport", value: "Rugby - I love the grit, focus, and team spirit... and men in shorts? Well, why not!" },
      { label: "Team You Follow", value: "St Helens Rugby League - because my dad says so (and we don't argue with northern dads on sport)." },
      { label: "Business Books", value: "\"Oversubscribed\" by Daniel Priestley, \"We Should All Be Millionaires\" by Rachel Rodgers, and \"Dare to Lead\" by Brene Brown." },
      { label: "Favourite Holiday Destination", value: "Mauritius (so far!) - turquoise waters, soulful sunsets, and the perfect blend of culture and calm." },
      { label: "Favourite Drink", value: "Champagne - \"I only drink Champagne on two occasions, when I am in love and when I am not.\" - Coco Chanel." },
      { label: "Fun Fact", value: "I was once interviewed by Sky and BBC News as a wedding planning expert during William and Kate's engagement." },
      { label: "Pineapple on Pizza", value: "No. Absolutely not." },
    ],
    links: [{ label: "See Synergy Link for more information", href: "https://www.synergylink.co.uk/" }],
  },
  {
    slug: "eric-nixon",
    title: "Sports Leaders Interviews",
    description: "Interview With Former Professional Footballer Eric Nixon.",
    image: "/Picture1-2.jpg",
    imageAlt: "Eric Nixon",
    name: "Eric Nixon",
    role: "Goalkeeper",
    facts: [{ label: "What Sports", value: "Football" }],
    sections: [
      {
        question: "Tell me about your journey in sports, from starting out to where you are now.",
        answers: [
          "Joined by boyhood team Man City from non-league Curzon Ashton and made over 100 appearances for Man City.",
          "Played for Southampton, Wolves, Bradford, and Carlisle.",
          "Joined Tranmere Rovers, played a record 450 games and captained the club.",
          "Joined Stockport County in the 98-99 season Championship.",
          "Went on to coach Tranmere, Barnsley and Fleetwood.",
          "Now run a coaching academy, advise football clubs, and also do a podcast.",
        ],
      },
      {
        question: "What is your proudest achievement as a professional?",
        answers: ["Making my debut for Man City against West Ham in 1985."],
      },
      {
        question: "What are your future goals in your sport / if retired, what would you change about your sport?",
        answers: ["I would change the way goalkeeping is coached and get back to old school diving at feet."],
      },
      {
        question: "Can you describe a challenging moment in your career and how you overcame it?",
        answers: [
          "Going out on loan for a whole season made me a better pro and opened my eyes; I met some incredible people along the way and learned to relax and love the game.",
        ],
      },
      {
        question: "What do you consider to be your greatest strength as an athlete?",
        answers: ["Resilience, passion, desire, willingness to achieve my goals."],
      },
      {
        question: "How do or did you handle pressure?",
        answers: ["I just got on with the job in hand - what's pressure? It was a different era."],
      },
      {
        question: "How important is an athlete's public image?",
        answers: ["Currently it's important as kids are so impressionable and footballers are like gods."],
      },
      {
        question: "What are / were your preferred pre-game, locker room and post-game routines?",
        answers: ["Pre match meal was Sugar Puffs. Never had superstitions."],
      },
      {
        question: "Who inspired you as a young athlete / your idols?",
        answers: [
          "We lost our dad at an early age so Mum and Brother - all four of them - guided me. We were a close family.",
        ],
      },
    ],
    quickHits: [
      { label: "Favourite Sports Quote", value: "Never knock off." },
      { label: "Favourite Sports Venue", value: "Main Road, Manchester and Wembley Stadium. I always dreamt of playing at both venues as a kid and achieved both those goals many times." },
      { label: "Favourite Sport to Watch", value: "Golf" },
      { label: "Sports You Currently Play", value: "Golf and racquetball" },
      { label: "Teams You Follow", value: "Man City, Tranmere Rovers" },
      { label: "Sports Book", value: "\"Big Hands Big Heart\" - Eric Nixon autobiography" },
      { label: "Favourite Holiday Destination", value: "Abersoch" },
      { label: "Favourite Drink", value: "Water to stay fit / a nice pint if catching up with friends" },
      { label: "Fun Fact", value: "I'm the only player to play in all 4 divisions in one season in the history of the football league." },
      { label: "Pineapple on Pizza", value: "No - definitely not." },
    ],
    extraImages: [
      { src: "/trophy picture Eric Nixon.jpg", alt: "Eric Nixon trophy" },
      { src: "/Ericnixon logo.jpg", alt: "Eric Nixon logo" },
    ],
    links: [{ label: "For more information see Eric Nixon", href: "https://www.ericnixon.co.uk" }],
  },
  {
    slug: "danielle-hobson",
    title: "Potential Interview Questions for Business Leaders on Sports Lounge",
    image: "/Picture1-3.jpg",
    imageAlt: "Danielle Hobson",
    name: "Danielle Hobson",
    role: "Intuitive Business Coach",
    facts: [
      { label: "Company Name", value: "DH Coaching / The Aligned Business School" },
      { label: "Industry", value: "Business Consulting" },
    ],
    sections: [
      {
        question: "About the Company in a couple of sentences?",
        answers: [
          "We help women build fully aligned, passion-led businesses that set their souls on absolute fire.",
          "This isn't about hustle culture or doing it the \"right way\" - it's about creating businesses that feel good, make bank, and change lives. Alignment is non-negotiable here.",
        ],
      },
      {
        question: "What inspired you to start your own business?",
        answers: [
          "Honestly? I craved freedom. I was sick of being told what to do, how to do it, and how much I was \"allowed\" to earn.",
          "I'm a rebel at heart, a \"burn the rule book\" kind of woman, and I never fit inside society's boring little boxes. I wanted a life and business that made sense to me, not to the world around me. So I built it.",
        ],
      },
      {
        question: "What were the biggest challenges you faced when starting out?",
        answers: [
          "Everything.",
          "When you come from a council estate, have a messed-up relationship with money, and no one around you has even owned a business, you're basically running around like a headless chicken.",
          "Self-doubt, money fears, imposter syndrome, not knowing what the hell I was doing - all of it.",
        ],
      },
      {
        question: "How do you handle failure or setbacks?",
        answers: [
          "Failure doesn't scare me. I expect it. It's part and parcel.",
          "When things don't go to plan, I don't sit around crying. I'll acknowledge my feelings and where I am at, but then I get curious. What's the lesson here? How can I tweak this? What version of me do I need to become to smash this next time? Growth over drama, every damn time.",
        ],
      },
      {
        question: "What skills do you consider most important for a business owner?",
        answers: [
          "Resilience. You need to be able to take a hit and still strut like you own the place.",
          "Self-trust, because if you can't back yourself, why should anyone else?",
          "And energy - above all else. Strategy matters, but the energy you pour into your business is an absolute game-changer. Energy sells.",
        ],
      },
      {
        question: "What key lessons have you learned about business ownership?",
        answers: [
          "Alignment first, money second, because misaligned money costs more than it's worth.",
          "No one's coming to save you - build the courage to save your damn self.",
          "Energy is your strategy. If you're not loving it and having fun, it's not sustainable.",
          "Your mindset is super important. If your head's not in the game, you will struggle.",
        ],
      },
      {
        question: "How do you push through your biggest business doubts?",
        answers: [
          "I remember who the hell I am. But if I struggle with this then I lean on my support network for help to remind me.",
          "I did not come from privilege. I built this from grit, energy, intuition, and a refusal to quit.",
          "When doubts creep in (because they always do), I lean into my vision harder than ever. I connect with the version of me who already has what I want and I act from her, not from the fear trying to talk me out of it.",
          "Also, a banging playlist and a good ugly-cry dance session helps too.",
        ],
      },
      {
        question: "Does your business engage in community or charity projects?",
        answers: [
          "100%. Giving back is important.",
          "I'm living proof that where you come from does not define where you're going, so I'm obsessed with creating opportunities for women who feel overlooked or stuck.",
          "Whether it's through free training, scholarships, or charity donations.",
        ],
      },
      {
        question: "How much time do you spend working on your business each day?",
        answers: [
          "It really depends on the day.",
          "Some days it's a few powerful hours of inspired action, some days I'm fully in the vibe and can work till midnight.",
          "But I don't clock-watch, because my business is an extension of who I am. It's like breathing now.",
        ],
      },
      {
        question: "If you could give just one piece of advice to someone starting a business - what would it be?",
        answers: [
          "Get yourself in the right environment, fast. Your environment will make or break you.",
          "If you're hanging around people who roll their eyes when you talk about your dreams, you're already fighting uphill. Get around women who normalize success, big vision, and bold moves.",
          "Energy is contagious. Choose the rooms where your vision isn't too big - it's expected.",
        ],
      },
    ],
    quickHits: [
      { label: "Favourite Sport", value: "Boxing" },
      { label: "Business Book", value: "\"We Should All Be Millionaires\" by Rachel Rodgers" },
      { label: "Favourite Holiday Destination", value: "Bali, hands down" },
      { label: "Favourite Drink", value: "Spicy Margarita" },
      { label: "Fun Fact", value: "I love to get photo shoots and tattoos in every country I visit." },
      { label: "Pineapple on Pizza", value: "Hell yes. Hard yes and always and forever." },
    ],
    links: [{ label: "The Aligned Business School", href: "https://www.thealignedbusinessschool.com" }],
  },
];

export function getInterviewPath(slug: string) {
  return `/interviews/${slug}`;
}

export function getInterviewBySlug(slug: string) {
  return interviews.find((interview) => interview.slug === slug) || null;
}
