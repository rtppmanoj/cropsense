import { ArrowRight, Cpu, Droplets, Gauge, Sprout, ThermometerSun, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HardwarePromo({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'en').split('-')[0] as 'en' | 'hi' | 'ta' | 'te';
  const copy = hardwareCopy[locale] ?? hardwareCopy.en;
  const parts = [
    [copy.board, Cpu], [copy.npk, Sprout], [copy.moisture, Droplets],
    [copy.environment, ThermometerSun], [copy.ph, Waves],
  ] as const;
  return <section id="soil-testing-tool" aria-labelledby="cropsense-hardware-title" className={`hardware-promo overflow-hidden rounded-2xl border border-[#dce8d4] bg-gradient-to-br from-[#f4f8ef] via-white to-[#eaf3e7] shadow-sm ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'}`}>
    <div className="hardware-promo-grid grid gap-5 lg:grid-cols-[1fr_auto]">
      <div className="hardware-promo-copy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="cropsense-hardware-title" className={`mt-2 font-bold text-[#203c2c] ${compact ? 'text-xl' : 'display-title text-2xl sm:text-3xl'}`}>{copy.title}</h2>
        <p className="hardware-promo-description mt-2 max-w-3xl text-base leading-7 text-[#657566]">{copy.description}</p>
        <div className="hardware-promo-parts mt-4 flex flex-wrap gap-2">{parts.map(([label, Icon]) => <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2eadc] bg-white/85 px-2.5 py-1.5 text-sm font-semibold text-[#47614b]"><Icon className="h-3.5 w-3.5 text-[#56804d]" />{label}</span>)}</div>
        <p className="hardware-promo-display mt-4 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-base font-semibold text-[#355b3b]"><Gauge className="h-4 w-4 shrink-0" />{copy.display}</p>
      </div>
      <div className="hardware-price-panel flex flex-row items-center justify-between gap-4 rounded-xl border border-[#dce8d4] bg-white/90 p-4 sm:min-w-52 sm:flex-col sm:items-start sm:justify-center">
        <div><p className="text-xs font-bold uppercase tracking-wider text-[#718074]">{copy.recommended}</p><p className="mt-1 text-2xl font-extrabold text-[#254b31]">₹7,999</p></div>
        <a href="mailto:cropsensevit@gmail.com?subject=CropSense%20soil%20testing%20hardware" className="primary-button shrink-0 px-3 py-2 text-sm">{copy.enquire}<ArrowRight className="h-4 w-4" /></a>
      </div>
    </div>
  </section>;
}

const hardwareCopy = {
  en: { eyebrow: 'CropSense team product', title: 'CropSense Soil Testing Tool', description: 'For better field soil testing, use the sensor setup developed by the CropSense team. The Arduino-connected NPK, soil-moisture, Gravity Analog pH, and DHT22 sensors measure soil and environmental conditions. Readings appear on the LCD panel for you to enter in the CropSense dashboard form.', board: 'Arduino board', npk: 'NPK sensor', moisture: 'Soil moisture sensor', environment: 'DHT22 · air temperature & humidity', ph: 'Gravity Analog pH sensor', display: 'View your test readings on the LCD, then enter them in the dashboard form.', recommended: 'Recommended Soil Testing Tool', enquire: 'Enquire about the tool' },
  hi: { eyebrow: 'CropSense टीम का उत्पाद', title: 'CropSense मिट्टी परीक्षण टूल', description: 'बेहतर खेत-मिट्टी परीक्षण के लिए CropSense टीम द्वारा तैयार सेंसर सेटअप का उपयोग करें। Arduino से जुड़े NPK, मिट्टी नमी, Gravity Analog pH और DHT22 सेंसर मिट्टी व वातावरण की स्थितियां मापते हैं। रीडिंग LCD पैनल पर देखें और CropSense डैशबोर्ड फॉर्म में दर्ज करें।', board: 'Arduino बोर्ड', npk: 'NPK सेंसर', moisture: 'मिट्टी नमी सेंसर', environment: 'DHT22 · हवा का तापमान और आर्द्रता', ph: 'Gravity Analog pH सेंसर', display: 'रीडिंग LCD पर देखें और डैशबोर्ड फॉर्म में दर्ज करें।', recommended: 'अनुशंसित मिट्टी परीक्षण टूल', enquire: 'टूल के बारे में पूछें' },
  ta: { eyebrow: 'CropSense குழுவின் தயாரிப்பு', title: 'CropSense மண் பரிசோதனைக் கருவி', description: 'மேம்பட்ட வயல் மண் பரிசோதனைக்கு CropSense குழு உருவாக்கிய சென்சார் அமைப்பைப் பயன்படுத்துங்கள். Arduino-வுடன் இணைக்கப்பட்ட NPK, மண் ஈரப்பதம், Gravity Analog pH மற்றும் DHT22 சென்சார்கள் மண் மற்றும் சுற்றுச்சூழல் நிலைகளை அளவிடும். LCD திரையில் அளவீடுகளைப் பார்த்து CropSense டாஷ்போர்டு படிவத்தில் உள்ளிடுங்கள்.', board: 'Arduino பலகை', npk: 'NPK சென்சார்', moisture: 'மண் ஈரப்பத சென்சார்', environment: 'DHT22 · காற்று வெப்பநிலை மற்றும் ஈரப்பதம்', ph: 'Gravity Analog pH சென்சார்', display: 'LCD திரையில் அளவீடுகளைப் பார்த்து டாஷ்போர்டு படிவத்தில் உள்ளிடுங்கள்.', recommended: 'பரிந்துரைக்கப்படும் மண் பரிசோதனைக் கருவி', enquire: 'கருவி பற்றி விசாரிக்கவும்' },
  te: { eyebrow: 'CropSense బృందం ఉత్పత్తి', title: 'CropSense మట్టి పరీక్ష సాధనం', description: 'మెరుగైన పొలపు మట్టి పరీక్ష కోసం CropSense బృందం రూపొందించిన సెన్సార్ సెటప్‌ను ఉపయోగించండి. Arduinoకు అనుసంధానించిన NPK, మట్టి తేమ, Gravity Analog pH, DHT22 సెన్సార్లు మట్టి మరియు పరిసర పరిస్థితులను కొలుస్తాయి. LCD ప్యానెల్‌లో రీడింగ్‌లు చూసి CropSense డాష్‌బోర్డ్ ఫారమ్‌లో నమోదు చేయండి.', board: 'Arduino బోర్డు', npk: 'NPK సెన్సార్', moisture: 'మట్టి తేమ సెన్సార్', environment: 'DHT22 · గాలి ఉష్ణోగ్రత, తేమ', ph: 'Gravity Analog pH సెన్సార్', display: 'LCDలో రీడింగ్‌లు చూసి డాష్‌బోర్డ్ ఫారమ్‌లో నమోదు చేయండి.', recommended: 'సిఫార్సు చేసిన మట్టి పరీక్ష సాధనం', enquire: 'సాధనం గురించి విచారించండి' },
} as const;
