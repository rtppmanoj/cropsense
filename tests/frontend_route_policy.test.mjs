import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { protectedRouteDecision } from '../src/auth/routePolicy.js';

test('unauthenticated users go to the shared login page', () => {
  assert.equal(protectedRouteDecision('admin', null, false), '/login');
  assert.equal(protectedRouteDecision('farmer', null, false), '/login');
});

test('authenticated users are redirected away from another role dashboard', () => {
  assert.equal(protectedRouteDecision('admin', 'farmer', false), '/farmer/dashboard');
  assert.equal(protectedRouteDecision('farmer', 'admin', false), '/admin/dashboard');
});

test('matching role is allowed and loading state waits for session check', () => {
  assert.equal(protectedRouteDecision('admin', 'admin', false), 'allow');
  assert.equal(protectedRouteDecision('farmer', 'farmer', false), 'allow');
  assert.equal(protectedRouteDecision('farmer', null, true), 'loading');
});

test('route navigation resets scroll to the top while explicit anchors remain supported', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /function ScrollToRouteStart\(\)/);
  assert.match(app, /window\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
  assert.match(app, /target\.scrollIntoView\(\{ block: 'start' \}\)/);
});


test('recommendation results show weather for submitted location and localize loading and error states', async () => {
  const source = await readFile(new URL('../src/components/WeatherClimateSection.tsx', import.meta.url), 'utf8');
  const results = await readFile(new URL('../src/pages/RecommendationResult.tsx', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../src/pages/FarmerDashboard.tsx', import.meta.url), 'utf8');
  const profile = await readFile(new URL('../src/pages/FarmerProfile.tsx', import.meta.url), 'utf8');
  const history = await readFile(new URL('../src/pages/FarmerHistory.tsx', import.meta.url), 'utf8');
  const navbar = await readFile(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  const footer = await readFile(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');
  const locale = JSON.parse(await readFile(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'));
  assert.match(source, /role=\"status\"/);
  assert.match(results, /<WeatherClimateSection location=/);
  assert.match(results, /farm_district: input\.farm_district/);
  assert.match(results, /farm_state: input\.farm_state/);
  assert.doesNotMatch(dashboard, /WeatherClimateSection/);
  assert.doesNotMatch(dashboard, /farmer-password|farmer-profile|changePassword|saveProfile/);
  assert.doesNotMatch(dashboard, /Recommendation history|farmer-history/);
  assert.match(profile, /changePassword/);
  assert.match(history, /limit=10&offset=/);
  assert.match(history, /setSelected\(entry\)/);
  assert.match(navbar, /to="\/farmer\/history"/);
  assert.match(navbar, /to="\/farmer\/profile#password-settings"/);
  assert.match(navbar, /signOut/);
  assert.doesNotMatch(footer, /nav\.home|nav\.howItWorks|nav\.about/);
  assert.match(footer, /footer\.maintained/);
  assert.match(source, /weather\.openAnalysis/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /setError\('empty'\)/);
  assert.match(source, /setError\('unavailable'\)/);
  assert.match(source, /setError\('ambiguous'\)/);
  assert.match(source, /setError\('locationNoMatch'\)/);
  assert.equal(typeof locale.translation.weather.noLocation, 'string');
  assert.equal(typeof locale.translation.weather.unavailable, 'string');
  assert.equal(locale.translation.nav.farmerDashboard, 'My farm');
});
