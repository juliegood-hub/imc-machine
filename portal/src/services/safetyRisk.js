export function parseRiskArray(input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  return String(input || '')
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function calculateSafetyRiskProfile(input = {}) {
  const expectedAttendance = Math.max(0, Number.parseInt(input.expectedAttendance, 10) || 0);
  const securityStaffCount = Math.max(0, Number.parseInt(input.securityStaffCount, 10) || 0);
  const indoorOutdoor = String(input.indoorOutdoor || 'indoor').toLowerCase().trim();
  const weatherExposure = String(input.weatherExposure || 'low').toLowerCase().trim();
  const localCrimeRisk = String(input.localCrimeRisk || '').toLowerCase().trim();
  const fireRiskFactors = parseRiskArray(input.fireRiskFactors);
  const alcoholPresent = !!input.alcoholPresent;
  const ticketedEvent = !!input.ticketedEvent;
  const generatorUse = !!input.generatorUse;
  const vipAttendance = !!input.vipAttendance;

  let score = 0;
  if (indoorOutdoor === 'outdoor') score += 15;
  if (expectedAttendance >= 5000) score += 30;
  else if (expectedAttendance >= 2000) score += 24;
  else if (expectedAttendance >= 1000) score += 18;
  else if (expectedAttendance >= 500) score += 12;
  else if (expectedAttendance >= 200) score += 8;
  else if (expectedAttendance >= 100) score += 4;

  if (alcoholPresent) score += 15;
  if (!ticketedEvent) score += 6;

  const staffingRatio = securityStaffCount > 0
    ? Number((expectedAttendance / securityStaffCount).toFixed(2))
    : null;
  if (staffingRatio === null) score += 18;
  else if (staffingRatio > 100) score += 16;
  else if (staffingRatio > 75) score += 10;
  else if (staffingRatio > 50) score += 5;

  if (weatherExposure === 'high') score += 14;
  else if (weatherExposure === 'medium') score += 8;
  if (generatorUse) score += 8;
  score += Math.min(16, fireRiskFactors.length * 4);
  if (localCrimeRisk === 'high') score += 12;
  else if (localCrimeRisk === 'medium') score += 6;
  if (vipAttendance) score += 6;

  const riskScore = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel = riskScore <= 25 ? 'low'
    : riskScore <= 50 ? 'moderate'
      : riskScore <= 75 ? 'elevated'
        : 'high';

  const recommendations = [];
  if (riskLevel === 'elevated' || riskLevel === 'high') {
    recommendations.push('Increase security staffing and assign a dedicated Security Lead.');
  }
  if (staffingRatio === null || staffingRatio > 75) {
    recommendations.push('Adjust security ratio target to 1:75 or better.');
  }
  if (alcoholPresent) {
    recommendations.push('Enforce ID checks and alcohol compliance plan.');
  }
  if (weatherExposure !== 'low' || indoorOutdoor === 'outdoor') {
    recommendations.push('Post weather thresholds and shelter/evacuation protocol.');
  }
  if (fireRiskFactors.length > 0 || generatorUse) {
    recommendations.push('Run fire and electrical walkthrough before doors.');
  }
  if (expectedAttendance >= 1000) {
    recommendations.push('Coordinate police/EMS liaison and command-center protocol.');
  }
  if (vipAttendance) {
    recommendations.push('Configure VIP lane and controlled access checkpoints.');
  }

  return {
    riskScore,
    riskLevel,
    staffingRatio,
    recommendations: Array.from(new Set(recommendations)),
    fireRiskFactors,
  };
}
