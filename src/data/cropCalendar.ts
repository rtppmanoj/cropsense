export interface CropCalendarWindow {
  sowing: [number, number];
  harvest: [number, number];
}

// Indicative broad Indian crop windows. Actual dates vary by state, variety,
// irrigation, and local monsoon onset; these are planning cues, not prescriptions.
const calendar: Record<string, CropCalendarWindow> = {
  apple: { sowing: [12, 2], harvest: [7, 10] },
  banana: { sowing: [1, 12], harvest: [9, 12] },
  blackgram: { sowing: [6, 8], harvest: [9, 11] },
  chickpea: { sowing: [10, 11], harvest: [2, 4] },
  coconut: { sowing: [6, 8], harvest: [1, 12] },
  coffee: { sowing: [6, 8], harvest: [10, 2] },
  cotton: { sowing: [4, 7], harvest: [10, 2] },
  grapes: { sowing: [1, 2], harvest: [12, 4] },
  jute: { sowing: [3, 5], harvest: [7, 10] },
  kidneybeans: { sowing: [6, 7], harvest: [9, 11] },
  lentil: { sowing: [10, 11], harvest: [2, 4] },
  maize: { sowing: [6, 7], harvest: [9, 11] },
  mango: { sowing: [7, 9], harvest: [4, 7] },
  mothbeans: { sowing: [6, 7], harvest: [9, 10] },
  mungbean: { sowing: [6, 8], harvest: [9, 11] },
  muskmelon: { sowing: [11, 2], harvest: [2, 5] },
  orange: { sowing: [6, 8], harvest: [11, 3] },
  papaya: { sowing: [2, 3], harvest: [1, 12] },
  pigeonpeas: { sowing: [6, 7], harvest: [12, 3] },
  pomegranate: { sowing: [7, 8], harvest: [8, 10] },
  rice: { sowing: [6, 7], harvest: [10, 12] },
  watermelon: { sowing: [11, 2], harvest: [2, 5] },
  wheat: { sowing: [10, 12], harvest: [3, 4] },
};

export function getCropCalendar(crop: string): CropCalendarWindow | undefined {
  return calendar[crop.trim().toLowerCase().replace(/[ -]/g, '')];
}

export function formatCropMonths(months: [number, number], locale: string): string {
  const format = (month: number) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2020, month - 1, 1, 12));
  return `${format(months[0])} – ${format(months[1])}`;
}
