export type PlanKey = 'free' | 'basic' | 'plus' | 'premium' | 'organizationStarter' | 'organizationGrowth';

export const planKeys: PlanKey[] = ['free', 'basic', 'plus', 'premium', 'organizationStarter', 'organizationGrowth'];

const commonFarmer = ['cropRecommendations', 'weatherOutlook', 'governmentSchemes', 'onlineResults'] as const;
const basicFeatures = ['fertilizerRecommendations', 'pdfDownload', 'emailReports', 'eligibilityGuidance', 'savedHistory'] as const;
const plusFeatures = ['marketPriceInsights', 'disasterAssistance'] as const;

export function defaultPlanFeatureKeys(key: PlanKey): string[] {
  if (key === 'free') return [...commonFarmer, 'chatbotFeature'];
  if (key === 'basic') return [...commonFarmer, ...basicFeatures, 'chatbotFeature'];
  if (key === 'plus') return [...commonFarmer, ...basicFeatures, ...plusFeatures, 'chatbotFeature'];
  if (key === 'premium') return [...commonFarmer, ...basicFeatures, ...plusFeatures, 'higherQuota', 'chatbotFeature'];
  return ['cropRecommendations', 'weatherContext', 'onlineResultsReports'];
}

export function planDisplayNameKey(key: PlanKey): string {
  return `pricingPage.plans.${key}`;
}

export function planDescriptionKey(key: PlanKey): string {
  const keys: Record<PlanKey, string> = {
    free: 'freeDescription', basic: 'basicDescription', plus: 'plusDescription', premium: 'premiumDescription',
    organizationStarter: 'starterDescription', organizationGrowth: 'growthDescription',
  };
  return `pricingPage.${keys[key]}`;
}
