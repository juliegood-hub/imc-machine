export default function WorkflowGuide() {
  const phases = [
    {
      num: 1, title: 'Get Set Up (You Only Do This Once)', icon: '🏗️',
      steps: [
        { title: 'Tell Us About Your Venue', who: '👤', whoLabel: 'Human', desc: 'Enter your venue details, or just snap a photo and we\'ll pull the info for you. Capacity, location, contacts, the works.' },
        { title: 'Make It Yours', who: '👤', whoLabel: 'Human', desc: 'Your colors, your logo, your voice. Set your brand guidelines so everything we create sounds and looks like you.' },
        { title: 'Your Google Drive Folder', who: '🤖', whoLabel: 'Automatic', desc: 'We create an organized folder structure for all your event assets. Everything in one place.' },
        { title: 'Connect Your Channels', who: '👤', whoLabel: 'Human', desc: 'Link up Facebook, Eventbrite, your email list, and any other platforms where your audience lives.' },
      ],
    },
    {
      num: 2, title: 'Create Your Event', icon: '🎪',
      steps: [
        { title: 'The Event Wizard', who: '👤', whoLabel: 'Human', desc: 'Walk through it step by step: genre, basics, cast and crew, venue, media, brand, channels, then review.' },
        { title: 'Upload a Poster, Skip the Typing', who: '🤝', whoLabel: 'AI + Human Review', desc: 'Got a flyer or poster? Upload it. AI pulls out the event details. You just review and tweak.' },
        { title: 'Everything Gets Saved', who: '🤖', whoLabel: 'Automatic', desc: 'All your event data is stored and linked to your venue profile, ready for campaign generation.' },
      ],
    },
    {
      num: 3, title: 'We Write the Copy, You Approve It', icon: '✍️',
      steps: [
        { title: 'Research First', who: '🤖', whoLabel: 'Automatic', desc: 'AI researches your venue, your artists, the genre, and what makes this event matter locally.' },
        { title: 'Press Release', who: '🤝', whoLabel: 'AI + Human Review', desc: 'A professional press release, drafted and ready. You review it and give the green light before it goes anywhere.' },
        { title: 'Social Media Posts', who: '🤝', whoLabel: 'AI + Human Review', desc: 'Posts tailored for Facebook, Instagram, and Twitter/X. Each one written for that platform. You review every one.' },
        { title: 'Calendar Listings', who: '🤝', whoLabel: 'AI + Human Review', desc: 'Formatted and ready for Do210, SA Current, and Evvnt. You review before they go out.' },
        { title: 'Email Campaign', who: '🤝', whoLabel: 'AI + Human Review', desc: 'A compelling email with a subject line that gets opened. You review it first.' },
        { title: 'Text Message Blast', who: '🤝', whoLabel: 'AI + Human Review', desc: 'Short, punchy SMS copy that gets people off the couch. You review before it sends.' },
        { title: 'Spanish Translation', who: '🤝', whoLabel: 'AI + Human Review', desc: 'All your content translated to Spanish for San Antonio\'s bilingual community. You review the translation.' },
        { title: '⚠️ Nothing Goes Out Without Your Say-So', who: '👤', whoLabel: 'Human', desc: 'This is important: every single piece of content needs your explicit approval before it reaches anyone.' },
      ],
    },
    {
      num: 4, title: 'Images That Look Professional', icon: '🎨',
      steps: [
        { title: '22 Images, Every Size You Need', who: '🤖', whoLabel: 'Automatic', desc: 'AI generates images sized for every platform: Facebook, Instagram, Eventbrite, email headers, all of them.' },
        { title: 'You Pick What Works', who: '👤', whoLabel: 'Human', desc: 'Review each image. Don\'t love one? Regenerate it or upload your own.' },
        { title: 'Stored in Your Drive', who: '🤖', whoLabel: 'Automatic', desc: 'Every approved image goes straight to your organized Google Drive folders.' },
      ],
    },
    {
      num: 5, title: 'Hit Send (When You\'re Ready)', icon: '🚀',
      steps: [
        { title: 'Press Releases to Media', who: '🤝', whoLabel: 'AI + Human Review', desc: 'You click "Distribute" and the system sends your press release to 16+ San Antonio media contacts.' },
        { title: 'Calendar Listings Published', who: '🤝', whoLabel: 'AI + Human Review', desc: 'Your listings get submitted to Do210, SA Current, and Evvnt automatically.' },
        { title: 'Facebook Event Goes Live', who: '🤖', whoLabel: 'Automatic', desc: 'A complete Facebook event page with all the details, images, and links.' },
        { title: 'Eventbrite Event Goes Live', who: '🤖', whoLabel: 'Automatic', desc: 'Your ticketed Eventbrite page, created with description and media, ready for sales.' },
        { title: 'Everything Gets Logged', who: '🤖', whoLabel: 'Automatic', desc: 'Every distribution is tracked with timestamps, status updates, and direct links.' },
      ],
    },
    {
      num: 6, title: 'Podcast and Press Page', icon: '🎙️',
      steps: [
        { title: 'Source Document Built for You', who: '🤖', whoLabel: 'Automatic', desc: 'The system compiles your event details, venue info, artist bios, and press materials into a rich document ready for podcast conversation.' },
        { title: 'Generate Your Podcast Audio', who: '👤', whoLabel: 'Human', desc: 'One click opens NotebookLM with your source doc. Generate a studio-quality two-host podcast episode. It sounds remarkably good.' },
        { title: 'Upload to Podcast Studio', who: '👤', whoLabel: 'Human', desc: 'Download the MP3 from NotebookLM and drag it into the IMC Podcast Studio. That\'s it.' },
        { title: 'Publish to YouTube Podcasts', who: '🤝', whoLabel: 'AI + Human Review', desc: 'Title, description, and thumbnail are generated for you. Review them and publish.' },
        { title: 'Share Your Episode', who: '🤖', whoLabel: 'Automatic', desc: 'Share links, embed codes, and the option to include the episode in your email campaigns.' },
        { title: 'Your Press Page', who: '🤖', whoLabel: 'Automatic', desc: 'A polished press page with all your assets, podcast episode, links, and media kit in one shareable URL.' },
        { title: 'Send It to the World', who: '👤', whoLabel: 'Human', desc: 'Review your press page and share the link with media contacts, sponsors, and collaborators.' },
      ],
    },
    {
      num: 7, title: 'Keep Track of It All', icon: '📊',
      steps: [
        { title: 'Campaign Tracker', who: '🤖', whoLabel: 'Automatic', desc: 'See every channel, every status, every click, and every link in real time.' },
        { title: 'Smart Scheduling', who: '🤖', whoLabel: 'Automatic', desc: 'The system suggests the best times to post and distribute based on your audience.' },
        { title: 'Reminder Posts', who: '👤', whoLabel: 'Human', desc: 'Fire off reminder posts and follow-ups when you want them.' },
        { title: 'Team Dashboard', who: '🤖', whoLabel: 'Automatic', desc: 'Your whole team can see what\'s happening via a synced Google Sheets dashboard.' },
      ],
    },
  ];

  const whoColor = (who) => {
    if (who === '🤖') return 'bg-blue-100 text-blue-700';
    if (who === '👤') return 'bg-amber-100 text-amber-700';
    return 'bg-purple-100 text-purple-700';
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-3xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>📖 How This All Works</h1>
      <p className="text-gray-500 mb-2">Here's exactly what happens from the moment you create an event to the moment the whole city knows about it.</p>
      <div className="flex gap-4 mb-8 text-xs">
        <span className="flex items-center gap-1"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">🤖 Automatic</span></span>
        <span className="flex items-center gap-1"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">👤 Human</span></span>
        <span className="flex items-center gap-1"><span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">🤝 AI + Human Review</span></span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#0d1b2a]" />

        {phases.map((phase, pi) => (
          <div key={pi} className="relative mb-10">
            {/* Phase header dot */}
            <div className="flex items-center gap-4 mb-4 relative">
              <div className="w-12 h-12 rounded-full bg-[#c8a45e] flex items-center justify-center text-xl z-10 flex-shrink-0 shadow-lg">
                {phase.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold m-0" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Phase {phase.num}: {phase.title}
                </h2>
              </div>
            </div>

            {/* Steps */}
            <div className="ml-6 pl-10 space-y-3">
              {phase.steps.map((step, si) => (
                <div key={si} className="relative">
                  {/* Step dot */}
                  <div className="absolute -left-10 top-3 w-3 h-3 rounded-full bg-[#c8a45e] border-2 border-white z-10" />

                  <div className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold m-0 mb-1">{step.title}</h3>
                        <p className="text-xs text-gray-500 m-0">{step.desc}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded whitespace-nowrap flex-shrink-0 ${whoColor(step.who)}`}>
                        {step.who} {step.whoLabel}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
