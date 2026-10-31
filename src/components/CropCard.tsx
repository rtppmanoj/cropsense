import { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FertilizerRecommendations from './FertilizerRecommendations';
import { formatCropMonths, getCropCalendar } from '../data/cropCalendar';

export interface CropCardProps {
  cropName: string;
  score: number;
  accuracy: number;
  explanation: string;
  rank: number;
  yieldPerAcre?: number | null;
  expectedHarvest?: number | null;
  farmState?: string | null;
  npk?: { nitrogen: string; phosphorus: string; potassium: string };
}
interface CropImage { source: string; page: string }

const pageTitles: Record<string, string> = {
  blackgram: 'Black gram', chickpea: 'Chickpea', kidneybeans: 'Kidney bean',
  maize: 'Maize', mothbeans: 'Moth bean', mungbean: 'Mung bean',
  pigeonpeas: 'Pigeon pea', pomegranate: 'Pomegranate', watermelon: 'Watermelon',
  orange: 'Orange (fruit)',
};

export default function CropCard({ cropName, score, accuracy, explanation, rank, yieldPerAcre, expectedHarvest, farmState, npk }: CropCardProps) {
  const { t, i18n } = useTranslation();
  const [image, setImage] = useState<CropImage | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const percentage = Math.round(accuracy * 100);
  const cropScorePercentage = Math.round(score * 100);
  const cropCalendar = getCropCalendar(cropName);
  const calendarLocale = i18n.resolvedLanguage || 'en';
  const similarityPrefix = "Among the strongest similarities to this crop's training examples:";
  const displayExplanation = explanation.startsWith(similarityPrefix)
    ? t('results.trainingSimilarity', {
      features: explanation.slice(similarityPrefix.length).replace(/\.$/, '').split(', ').map((feature) => {
        const key = ({ nitrogen: 'nitrogen', phosphorus: 'phosphorus', potassium: 'potassium' } as Record<string, string>)[feature.toLowerCase()];
        return key ? t(`results.featureNames.${key}`) : feature;
      }).join(', '),
    })
    : explanation;
  useEffect(() => {
    const controller = new AbortController();
    const pageTitle = pageTitles[cropName.toLowerCase()] ?? cropName;
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Crop image lookup failed (${response.status}).`);
        return response.json() as Promise<{ thumbnail?: { source?: string }; content_urls?: { desktop?: { page?: string } }; title?: string }>;
      })
      .then((summary) => {
        if (summary.thumbnail?.source) setImage({
          source: summary.thumbnail.source,
          page: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title ?? pageTitle)}`,
        });
        else setImageFailed(true);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) setImageFailed(true);
      });
    return () => controller.abort();
  }, [cropName]);



  return <article className="crop-result-card surface-card group overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
    <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#e9f1df] via-[#d7e6c9] to-[#b7d0a7]">
      {image && <img className="crop-image h-full rounded-none transition duration-700 group-hover:scale-105" src={image.source} alt={t('results.genericCropImage', { crop: cropName })} loading="lazy" onError={() => { setImage(null); setImageFailed(true); }} />}
      {(!image || imageFailed) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#54764d]"><Sprout className="h-10 w-10" /><span className="text-sm font-bold capitalize">{cropName}</span></div>}
      <span className="absolute left-4 top-4 rounded-full border border-white/50 bg-white/90 px-3 py-1 text-xs font-extrabold text-[#31583c] backdrop-blur">#{rank} {t('results.rankLabel')}</span>
      {image && <a className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#42664a] backdrop-blur hover:bg-white" href={image.page} target="_blank" rel="noreferrer">{t('results.imageAttribution')}</a>}
    </div>
    <div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4e5] text-[#386543]"><Sprout className="h-5 w-5" /></span><h3 className="text-xl font-bold capitalize text-[#203c2c]">{cropName}</h3></div><span className="rounded-full bg-[#eff5e9] px-3 py-1.5 text-sm font-extrabold text-[#426b48]">{percentage}%</span></div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf0e9]" role="progressbar" aria-label={`${cropName} ${t('results.modelScore')}`} aria-valuenow={cropScorePercentage} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#709b56] transition-[width] duration-700" style={{ width: `${Math.min(100, cropScorePercentage)}%` }} /></div>
      <p className="mt-4 text-sm leading-6 text-[#66766a]">{displayExplanation}</p>
      <p className="mt-3 text-[11px] font-semibold text-[#718074]">{t('results.modelAccuracy')}: {percentage}%</p>
      <div className="mt-5 grid gap-3 border-t border-[#edf0e9] pt-4 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f6f8f3] p-3 sm:col-span-2"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#829082]">{t('results.estimatedYield')}</p><p className="mt-1 text-sm font-bold text-[#294634]">{yieldPerAcre == null ? t('results.yieldUnavailable') : `${new Intl.NumberFormat(i18n.resolvedLanguage).format(yieldPerAcre)} ${t('form.units.quintalPerAcre')}`}</p>{expectedHarvest != null && <p className="mt-1 text-[11px] text-[#829082]">{t('results.expectedHarvest')}: {new Intl.NumberFormat(i18n.resolvedLanguage).format(expectedHarvest)} {t('form.units.quintal')}</p>}</div>
        {cropCalendar && <div className="rounded-xl bg-[#f6f8f3] p-3 sm:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#829082]">{t('results.sowingPeriod')}</p><p className="mt-1 text-sm font-bold text-[#294634]">{formatCropMonths(cropCalendar.sowing, calendarLocale)}</p></div>
            <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#829082]">{t('results.harvestPeriod')}</p><p className="mt-1 text-sm font-bold text-[#294634]">{formatCropMonths(cropCalendar.harvest, calendarLocale)}</p></div>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#829082]">{t('results.cropCalendarNote')}</p>
        </div>}
      </div>
      <FertilizerRecommendations crop={cropName} state={farmState} npk={npk} />
      
    </div>
  </article>;
}

