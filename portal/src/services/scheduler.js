// ═══════════════════════════════════════════════════════════════
// IMC Machine — Content Scheduling Service
// Patent ref: §6.6 Scheduling engine — optimized publish timing
// §7.7 IMC Distribution — coordinated content deployment
//
// Determines optimal publish times per channel based on:
// - Event date (count-back from show)
// - Channel best-practice timing
// - San Antonio timezone (America/Chicago)
// ═══════════════════════════════════════════════════════════════

// Optimal posting schedule relative to event date
// Based on industry standards + SA media lead times
const SCHEDULE_TEMPLATE = {
  press: {
    label: 'Press Release',
    daysBeforeEvent: 14,  // 2 weeks before
    time: '09:00',
    notes: 'Send Tuesday-Thursday mornings for best pickup',
  },
  calendar_do210: {
    label: 'Do210 Listing',
    daysBeforeEvent: 21,  // 3 weeks before
    time: '10:00',
    notes: 'Submit early — Do210 reviews manually',
  },
  calendar_sacurrent: {
    label: 'SA Current Calendar',
    daysBeforeEvent: 14,
    time: '10:00',
    notes: 'SA Current weekly deadline: Thursday for next week',
  },
  calendar_evvnt: {
    label: 'Evvnt Syndication',
    daysBeforeEvent: 21,
    time: '10:00',
    notes: 'Syndicates to Express-News, MySA — allow 3-5 days processing',
  },
  eventbrite: {
    label: 'Eventbrite Event',
    daysBeforeEvent: 28,  // 4 weeks before
    time: '12:00',
    notes: 'Create early for SEO and ticket sales runway',
  },
  social_facebook: {
    label: 'Facebook Post',
    daysBeforeEvent: 7,   // 1 week before
    time: '11:00',
    notes: 'Best engagement: Wed-Fri 11am-1pm CST',
    reminderDays: [3, 1, 0], // Additional posts 3 days, 1 day, day-of
  },
  social_instagram: {
    label: 'Instagram Post',
    daysBeforeEvent: 7,
    time: '12:00',
    notes: 'Best engagement: Mon-Fri 11am-2pm CST. Use carousel for events.',
    reminderDays: [3, 1, 0],
  },
  social_linkedin: {
    label: 'LinkedIn Post',
    daysBeforeEvent: 10,
    time: '08:00',
    notes: 'Best for industry/professional events. Tue-Thu 8-10am.',
  },
  email_campaign: {
    label: 'Email Campaign',
    daysBeforeEvent: 7,
    time: '10:00',
    notes: 'Send Tuesday or Thursday mornings. Follow up day-of.',
    reminderDays: [0],
  },
  sms_blast: {
    label: 'SMS Blast',
    daysBeforeEvent: 1,   // Day before
    time: '14:00',
    notes: 'Day-of or day-before only. 2pm CST for evening events.',
    reminderDays: [0],
  },
  graphics_poster: {
    label: 'Event Poster',
    daysBeforeEvent: 21,
    time: null,
    notes: 'Generate with initial campaign creation',
  },
  graphics_social: {
    label: 'Social Banner',
    daysBeforeEvent: 7,
    time: null,
    notes: 'Generate before social posts',
  },
  graphics_story: {
    label: 'IG Story',
    daysBeforeEvent: 3,
    time: null,
    notes: 'Generate for day-of / reminder stories',
  },
  press_page: {
    label: 'Press Page',
    daysBeforeEvent: 14,
    time: null,
    notes: 'Create with press release — single shareable URL',
  },
  bilingual: {
    label: 'Spanish Translation',
    daysBeforeEvent: 14,
    time: null,
    notes: 'Translate press + social for La Prensa Texas',
  },
};

// ═══════════════════════════════════════════════════════════════
// GENERATE SCHEDULE — Returns a timeline of when each channel
// should be executed, based on the event date
// ═══════════════════════════════════════════════════════════════

export function generateSchedule(eventDate) {
  const event = new Date(eventDate + 'T00:00:00');
  const schedule = [];

  for (const [key, config] of Object.entries(SCHEDULE_TEMPLATE)) {
    const publishDate = new Date(event);
    publishDate.setDate(publishDate.getDate() - config.daysBeforeEvent);

    // Don't schedule in the past
    const now = new Date();
    const effectiveDate = publishDate < now ? now : publishDate;

    schedule.push({
      channelKey: key,
      label: config.label,
      scheduledDate: effectiveDate.toISOString().split('T')[0],
      scheduledTime: config.time,
      daysBeforeEvent: config.daysBeforeEvent,
      notes: config.notes,
      isOverdue: effectiveDate < now,
      isPast: publishDate < now,
    });

    // Add reminder posts
    if (config.reminderDays) {
      for (const d of config.reminderDays) {
        const reminderDate = new Date(event);
        reminderDate.setDate(reminderDate.getDate() - d);
        if (reminderDate > now) {
          schedule.push({
            channelKey: `${key}_reminder_${d}`,
            label: `${config.label} — ${d === 0 ? 'Day-of' : d === 1 ? 'Day-before' : `${d}-day`} reminder`,
            scheduledDate: reminderDate.toISOString().split('T')[0],
            scheduledTime: config.time,
            daysBeforeEvent: d,
            notes: `Reminder post: ${config.label}`,
            isReminder: true,
          });
        }
      }
    }
  }

  // Sort by date
  schedule.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
  return schedule;
}

// ═══════════════════════════════════════════════════════════════
// GET TODAY'S TASKS — What should be done today
// ═══════════════════════════════════════════════════════════════

export function getTodaysTasks(eventDate) {
  const schedule = generateSchedule(eventDate);
  const today = new Date().toISOString().split('T')[0];
  return schedule.filter(s => s.scheduledDate === today);
}

// Get overdue tasks
export function getOverdueTasks(eventDate) {
  const schedule = generateSchedule(eventDate);
  const today = new Date().toISOString().split('T')[0];
  return schedule.filter(s => s.scheduledDate < today && !s.isReminder);
}
