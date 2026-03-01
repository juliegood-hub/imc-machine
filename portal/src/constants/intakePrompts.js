export const INTAKE_PROMPTS = {
  artist: {
    title: 'Tell me who you are (so I can write this for you).',
    intro: [
      'Answer what you can. Paste what you already have.',
      'I will do the organizing and turn it into a clean profile.',
    ],
    pasteLabel: 'Paste existing bio/notes',
    pastePlaceholder: 'Paste a bio, one-sheet, press notes, text thread, or anything you already have.',
    answerLabel: 'Answer these questions in your own words',
    answerPlaceholder: 'Bullets, sentences, fragments, one long paragraph: all good.',
    examplePlaceholder: 'Example: We are a San Antonio alt-jazz trio with bilingual lyrics and a cinematic live set.',
    sections: [
      {
        heading: '1. Basics',
        questions: [
          'What name should I use publicly (artist/band/stage name)?',
          'What city are you based in?',
          "What's the best short label for what you do (genre, style, role)?",
        ],
      },
      {
        heading: '2. The sound / the vibe / the work',
        questions: [
          'If someone has never seen you, what should they expect?',
          'What 3 adjectives describe your style?',
          'What makes this different from others in your lane?',
        ],
      },
      {
        heading: '3. Credits and highlights',
        questions: [
          'Any notable venues, festivals, roles, releases, awards, press, collaborators?',
          'Any "recent wins" worth mentioning?',
        ],
      },
      {
        heading: '4. Audience and fit',
        questions: [
          'Who tends to love this (fans of what, similar artists, similar experiences)?',
          'What types of gigs / roles are the best match?',
        ],
      },
      {
        heading: '5. Links and media',
        questions: [
          'Website',
          'Social links',
          'Streaming / portfolio links',
          'Best photo(s) / press kit link (if available)',
        ],
      },
      {
        heading: '6. Contact + booking',
        questions: [
          'Preferred contact name + email/phone',
          'Booking contact (if different)',
          'Tech rider / stage plot link (if you have it)',
        ],
      },
    ],
    finalLine: "Even messy notes are perfect. I'm excellent at turning chaos into copy.",
  },
  venue: {
    title: 'Tell me about your venue (and I will turn it into a solid listing).',
    intro: [
      'This helps me build your venue profile and event listings faster.',
      'Drop in whatever you have and I will structure it for clean publishing.',
    ],
    pasteLabel: 'Paste existing venue notes',
    pastePlaceholder: 'Paste your website copy, map notes, booking email, spec sheet, or flyer text.',
    answerLabel: 'Answer these questions in your own words',
    answerPlaceholder: 'Short answers are fine. I will shape it into profile-ready copy.',
    examplePlaceholder: 'Example: 220-cap room in Southtown with full PA, cocktail program, and weekly live music.',
    sections: [
      {
        heading: '1. Basics',
        questions: [
          'Venue name',
          'Address + neighborhood',
          'Website + socials',
        ],
      },
      {
        heading: '2. What kind of place is it?',
        questions: [
          "What's the vibe in one sentence?",
          "What's the ideal crowd / experience?",
          'What are you known for?',
        ],
      },
      {
        heading: '3. Programming',
        questions: [
          'What do you book or host most often (music, comedy, theater, workshops, etc.)?',
          'Any recurring nights or signature events?',
        ],
      },
      {
        heading: '4. Specs that matter',
        questions: [
          'Capacity (standing / seated if different)',
          'Stage size (rough is fine)',
          'Sound system notes (in-house PA? engineer?)',
          'Load-in notes (parking, door location, stairs, etc.)',
        ],
      },
      {
        heading: '5. Guest experience',
        questions: [
          'Age policy',
          'Food/drink notes',
          'Accessibility notes',
        ],
      },
      {
        heading: '6. Booking + ops',
        questions: [
          'Booking contact + email',
          'Typical lead time',
          'Do you provide staff (sound, lights, door) or is it promoter-provided?',
        ],
      },
    ],
  },
  event: {
    title: "Tell me what's happening (so I can publish this everywhere).",
    intro: [
      'I will draft a clean event description and fill the event fields for you.',
      'You can answer in bullets, fragments, or one big paragraph.',
    ],
    pasteLabel: 'Paste existing event notes or thread',
    pastePlaceholder: 'Paste the event email thread, promoter notes, venue message, or rough rundown.',
    answerLabel: 'Answer these questions in your own words',
    answerPlaceholder: 'Dump everything here. I will map it into the right fields.',
    examplePlaceholder: 'Example: Doors 7:00, show 8:00, all ages, three bands, $15 advance / $20 door.',
    sections: [
      {
        heading: '1. Core details',
        questions: [
          'Event name',
          'Date',
          'Start time / end time (or best guess)',
          'Venue + address (if not already attached)',
        ],
      },
      {
        heading: '2. What is it, really?',
        questions: [
          'What kind of event is this (concert, showcase, workshop, class, screening, etc.)?',
          "What's the main reason someone should come?",
        ],
      },
      {
        heading: '3. Who is involved',
        questions: [
          'Headliner / presenter',
          'Support acts / guests / instructors',
          'Hosts / sponsors (if any)',
        ],
      },
      {
        heading: '4. Structure',
        questions: [
          'Doors time',
          'Set times or schedule (even rough)',
          'Intermission? Q&A? Meet-and-greet?',
        ],
      },
      {
        heading: '5. Ticketing',
        questions: [
          'Price(s)',
          'Ticket link',
          'Day-of / door policy',
        ],
      },
      {
        heading: '6. Rules and logistics',
        questions: [
          'Age policy',
          'What to bring / what to expect',
          'Parking tips (if important)',
        ],
      },
      {
        heading: '7. Promo assets (official assets only)',
        questions: [
          'Official poster / flyer upload',
          'Official photos / press links',
          'Any required credit lines',
        ],
      },
    ],
    finalLine: "If you've got a messy text thread about this event, paste it. I'll mine it for gold.",
  },
  offering: {
    title: "Tell me what you're selling or teaching (and I will make it make sense).",
    intro: [
      'This can be a product, artwork, service, class, workshop, or package.',
      'Give me whatever you have and I will shape it into clear listing copy.',
    ],
    pasteLabel: 'Paste existing offering details',
    pastePlaceholder: 'Paste a one-sheet, product notes, syllabus, class outline, or service description.',
    answerLabel: 'Answer these questions in your own words',
    answerPlaceholder: 'Write naturally. I will extract the structure.',
    examplePlaceholder: 'Example: 90-minute beginner pottery workshop, includes clay/tools, bring an apron.',
    sections: [
      {
        heading: '1. What is it?',
        questions: [
          'Name of the offering',
          'Category (artwork, service, workshop, class, package, etc.)',
        ],
      },
      {
        heading: '2. The promise',
        questions: [
          'What does someone get, specifically?',
          'What problem does it solve or what experience does it deliver?',
        ],
      },
      {
        heading: '3. Details',
        questions: [
          'Duration (if applicable)',
          'Format (in-person, online, hybrid)',
          'Location (if applicable)',
          'What is included / what is not included',
        ],
      },
      {
        heading: "4. Who it's for",
        questions: [
          'Ideal customer/audience',
          'Skill level (beginner/intermediate/advanced) if relevant',
        ],
      },
      {
        heading: '5. Pricing + policies',
        questions: [
          'Price',
          'Refund/cancellation policy (if any)',
          'Any prerequisites',
        ],
      },
      {
        heading: '6. Assets (official assets only)',
        questions: [
          'Photos of the piece, a PDF brochure, a one-sheet, a syllabus, etc.',
        ],
      },
    ],
  },
};

export function buildIntakeQuestionDigest(promptConfig = {}) {
  return (promptConfig.sections || [])
    .map((section) => {
      const questions = (section.questions || []).map((question) => `- ${question}`).join('\n');
      return `${section.heading}\n${questions}`.trim();
    })
    .join('\n\n');
}
