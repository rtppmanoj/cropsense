import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronDown, Leaf, Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { indianStates } from '../data/indianStates';
import { getDistrictsForState } from '../data/indianDistricts';
import type { CropFormData } from './CropRecommendationForm';
import { ApiError, apiFetch } from '../services/apiClient';
import cropsenseMark from '../assets/cropsense-mark.png';

type Message = { id: number; sender: 'assistant' | 'farmer'; text: string; language?: string };
type FormKey = keyof CropFormData;
type FormStep = { key: FormKey; label: string; prompt: string; min?: number; max?: number };
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

const speechLocale = (language?: string) => ({ en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN' }[language?.split('-')[0] ?? 'en'] ?? 'en-IN');

function spokenText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/\*\*|[*_`#]/g, '')
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

const formSteps: FormStep[] = [
  { key: 'nitrogen', label: 'Nitrogen (N)', prompt: 'What is the tested available Nitrogen (N) value in kg/ha?', min: 0, max: 500 },
  { key: 'phosphorus', label: 'Phosphorus (P₂O₅)', prompt: 'What is the tested available Phosphorus (P₂O₅) value in kg/ha?', min: 0, max: 500 },
  { key: 'potassium', label: 'Potassium (K₂O)', prompt: 'What is the tested available Potassium (K₂O) value in kg/ha?', min: 0, max: 500 },
  { key: 'ph', label: 'Soil pH', prompt: 'What pH value is shown on your soil test?', min: 0, max: 14 },
  { key: 'soil_moisture', label: 'Soil moisture', prompt: 'What soil-moisture reading do you have? Enter a percentage from 0 to 100.', min: 0, max: 100 },
  { key: 'temperature', label: 'Temperature', prompt: 'What temperature in °C should the recommendation use? Enter a value from -10 to 70.', min: -10, max: 70 },
  { key: 'humidity', label: 'Humidity', prompt: 'What relative humidity percentage should the recommendation use? Enter 0 to 100.', min: 0, max: 100 },
  { key: 'land_area_acres', label: 'Land area', prompt: 'How many acres should this recommendation cover?', min: 0.01, max: 100000 },
  { key: 'farm_state', label: 'State or UT', prompt: `Which Indian state or union territory is your farm in? You can type its name. Examples: ${indianStates.slice(0, 5).join(', ')}.` },
  { key: 'farm_district', label: 'District', prompt: 'Which district is your farm in? Please use the district name listed for your selected state.' },
  { key: 'village_town', label: 'Village or town', prompt: 'What is your village or town? This helps attach the location to your report.' },
];

function renderInline(text: string, keyPrefix: string) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  return text.split(pattern).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key} className="font-bold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="font-semibold text-[#3f714a] underline underline-offset-2">{link[1]}</a>;
    return part;
  });
}

function AssistantMessage({ text, welcome = false }: { text: string; welcome?: boolean }) {
  const content = welcome ? text.replaceAll('\n', '\n\n') : text;
  return <div className="flex max-w-[94%] flex-col items-start gap-1">
    <div className="space-y-2 rounded-2xl rounded-bl-md border border-[#e7ece2] bg-white px-3 py-2 text-[12px] leading-[1.45rem] text-[#405347] shadow-sm">
    {content.trim().split(/\n\s*\n/).map((block, index) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) return <ul key={index} className="list-disc space-y-1 pl-5">{lines.map((line, item) => <li key={item}>{renderInline(line.replace(/^\s*[-*]\s+/, ''), `${index}-${item}`)}</li>)}</ul>;
      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) return <ol key={index} className="list-decimal space-y-1 pl-5">{lines.map((line, item) => <li key={item}>{renderInline(line.replace(/^\s*\d+[.)]\s+/, ''), `${index}-${item}`)}</li>)}</ol>;
      return <p key={index}>{lines.map((line, item) => <span key={item}>{item > 0 && <br />}{renderInline(line, `${index}-${item}`)}</span>)}</p>;
    })}
    </div>
  </div>;
}

function ThinkingDots({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md border border-[#e7ece2] bg-white px-4 py-3 shadow-sm">
    {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-[#5b8052]" style={{ animationDelay: `${dot * 140}ms` }} />)}
  </div>;
}

export default function CropSaathiChat() {
  const { t, i18n } = useTranslation();
  const { user, farmerDraft, setFarmerDraft } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [formData, setFormData] = useState<Partial<CropFormData>>({});
  const [formMode, setFormMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [chatError, setChatError] = useState('');
  const [failedQuestion, setFailedQuestion] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [readAloud, setReadAloud] = useState(() => {
    try { return typeof window === 'undefined' || window.localStorage.getItem('cropsaathi-read-aloud') !== 'false'; }
    catch { return true; }
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(0);
  const typingTimer = useRef<number | null>(null);
  const welcomeStarted = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const spokenMessageId = useRef<number | null>(null);
  const localizedFormSteps = useMemo(() => formSteps.map((step) => {
    const labelKey = step.key === 'land_area_acres' ? 'form.landArea.label' : step.key === 'farm_state' ? 'form.location.state' : step.key === 'farm_district' ? 'form.location.district' : step.key === 'village_town' ? 'form.location.villageTown' : `form.fields.${step.key}`;
    const label = t(labelKey);
    const prompt = step.min !== undefined && step.max !== undefined
      ? t('chatbotForm.askRange', { field: label, min: step.min, max: step.max })
      : t('chatbotForm.askField', { field: label });
    return { ...step, label, prompt };
  }), [t]);

  useEffect(() => {
    if (!open) return;
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismissOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', dismissOnOutsidePointer);
  }, [open]);
  useEffect(() => {
    if (open) return;
    recognitionRef.current?.abort();
    setListening(false);
  }, [open]);

  const addMessage = (sender: Message['sender'], text: string) => {
    messageId.current += 1;
    setMessages((current) => [...current, { id: messageId.current, sender, text, language: (i18n.resolvedLanguage ?? i18n.language).split('-')[0] }]);
  };
  const typeAssistantMessage = useCallback((text: string, charactersPerTick = 5, intervalMs = 25, language = (i18n.resolvedLanguage ?? i18n.language).split('-')[0]) => new Promise<void>((resolve) => {
    messageId.current += 1;
    const id = messageId.current;
    setMessages((current) => [...current, { id, sender: 'assistant', text: '', language }]);
    setTyping(true);
    const characters = Array.from(text);
    let cursor = 0;
    typingTimer.current = window.setInterval(() => {
      cursor = Math.min(characters.length, cursor + charactersPerTick);
      const currentText = characters.slice(0, cursor).join('');
      setMessages((current) => current.map((message) => message.id === id ? { ...message, text: currentText } : message));
      if (cursor >= characters.length) {
        if (typingTimer.current !== null) window.clearInterval(typingTimer.current);
        typingTimer.current = null;
        setTyping(false);
        resolve();
      }
    }, intervalMs);
  }), [i18n.language, i18n.resolvedLanguage]);
  useEffect(() => {
    if (!open || welcomeStarted.current || messages.length > 0) return;
    welcomeStarted.current = true;
    const welcome = t('chatbotContent.welcome');
    void typeAssistantMessage(welcome, 5, 30);
  }, [open, messages.length, t, typeAssistantMessage]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, open]);
  useEffect(() => {
    if (!readAloud || typing || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const latest = [...messages].reverse().find((message) => message.sender === 'assistant' && message.text.trim());
    if (!latest || spokenMessageId.current === latest.id) return;
    const text = spokenText(latest.text);
    if (!text) return;
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const locale = speechLocale(latest.language);
    utterance.lang = locale;
    utterance.rate = 0.96;
    const chooseVoice = () => {
      const voices = synthesis.getVoices();
      const exactMatch = voices.find((voice) => voice.lang.toLowerCase() === locale.toLowerCase());
      const languageMatch = voices.find((voice) => voice.lang.toLowerCase().startsWith(`${locale.slice(0, 2).toLowerCase()}-`));
      utterance.voice = exactMatch ?? languageMatch ?? null;
    };
    chooseVoice();
    spokenMessageId.current = latest.id;
    try { synthesis.cancel(); synthesis.speak(utterance); }
    catch { /* Speech is an optional browser feature; keep chat usable without it. */ }
  }, [messages, readAloud, typing]);
  useEffect(() => {
    if (readAloud) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, [readAloud]);
  useEffect(() => () => {
    if (typingTimer.current !== null) window.clearInterval(typingTimer.current);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
    }
  }, []);

  const nextStep = useMemo(() => localizedFormSteps.find((step) => !String(formData[step.key] ?? '').trim()), [formData, localizedFormSteps]);

  const startFormHelp = () => {
    if (user?.role !== 'farmer') {
      addMessage('assistant', t('chatbotForm.formSignIn'));
      navigate('/login');
      return;
    }
    const existing = (farmerDraft ?? {}) as Partial<CropFormData>;
    const initial: Partial<CropFormData> = {};
    for (const step of localizedFormSteps) if (String(existing[step.key] ?? '').trim()) initial[step.key] = existing[step.key];
    setFormData(initial);
    setFormMode(true);
    const next = localizedFormSteps.find((step) => !String(initial[step.key] ?? '').trim());
    addMessage('assistant', next ? `${t('chatbotForm.formIntro')} ${next.prompt}` : t('chatbotForm.formAlreadyReady'));
  };

  const finishForm = (completed: Partial<CropFormData>) => {
    const finalDraft: Record<string, string> = { ...(farmerDraft ?? {}) };
    for (const step of localizedFormSteps) finalDraft[step.key] = String(completed[step.key] ?? '');
    finalDraft.location_name = [finalDraft.village_town, finalDraft.farm_district, finalDraft.farm_state].filter(Boolean).join(', ');
    finalDraft.location_source = 'manual';
    finalDraft.latitude = '';
    finalDraft.longitude = '';
    setFarmerDraft(finalDraft);
    setFormMode(false);
    addMessage('assistant', t('chatbotForm.formComplete'));
    navigate('/farmer/dashboard#farmer-recommendation');
  };

  const handleFormReply = (text: string) => {
    const step = localizedFormSteps.find((item) => !String(formData[item.key] ?? '').trim());
    if (!step) { finishForm(formData); return; }
    const raw = text.trim();
    if (/^(cancel|stop|exit|நிறுத்து|रद्द|ఆపు)$/i.test(raw)) { setFormMode(false); addMessage('assistant', t('chatbotForm.formPaused')); return; }

    let value = raw;
    if (step.key === 'farm_state') {
      const match = indianStates.find((state) => state.toLowerCase() === raw.toLowerCase());
      if (!match) { addMessage('assistant', `${t('chatbotForm.formStateInvalid')} ${step.prompt}`); return; }
      value = match;
    } else if (step.key === 'farm_district') {
      const options = getDistrictsForState(String(formData.farm_state ?? ''));
      const match = options.find((district) => district.toLowerCase() === raw.toLowerCase());
      if (!match) { addMessage('assistant', t('chatbotForm.formDistrictInvalid', { state: String(formData.farm_state ?? ''), options: `${options.slice(0, 8).join(', ')}${options.length > 8 ? ', …' : ''}` })); return; }
      value = match;
    } else if (step.min !== undefined && step.max !== undefined) {
      const numeric = Number(raw);
      if (!raw || !Number.isFinite(numeric) || numeric < step.min || numeric > step.max) {
        addMessage('assistant', t('chatbotForm.formValueInvalid', { min: step.min, max: step.max, field: step.label }));
        return;
      }
      value = raw;
    } else if (!raw || raw.length > 100) {
      addMessage('assistant', t('chatbotForm.formVillageInvalid'));
      return;
    }

    const updated = { ...formData, [step.key]: value };
    setFormData(updated);
    const remaining = localizedFormSteps.find((item) => !String(updated[item.key] ?? '').trim());
    addMessage('assistant', remaining ? `${t('chatbotForm.formThanks')} ${remaining.prompt}` : t('chatbotForm.formAllEntered'));
    if (!remaining) finishForm(updated);
  };

  const askAssistant = async (text: string) => {
    setBusy(true);
    setChatError('');
    try {
      const previousMessages = messages.at(-1)?.sender === 'farmer' && messages.at(-1)?.text === text ? messages.slice(0, -1) : messages;
      const history = previousMessages.slice(-8).map((item) => ({ role: item.sender === 'farmer' ? 'user' : 'assistant', content: item.text.slice(0, 800) }));
      const formValueKeys = ['nitrogen', 'phosphorus', 'potassium', 'ph', 'soil_moisture', 'temperature', 'humidity', 'land_area_acres', 'location_name', 'village_town', 'farm_district', 'farm_state'] as const;
      const currentFormValues = Object.fromEntries(formValueKeys
        .filter((key) => farmerDraft?.[key] !== undefined && farmerDraft?.[key] !== '')
        .map((key) => [key, String(farmerDraft?.[key])])) as Record<string, string>;
      let pageState: Record<string, unknown> = {};
      if (pathname === '/farmer/result') {
        const element = document.querySelector<HTMLElement>('[data-cropsaathi-context]');
        try { pageState = element?.dataset.cropsaathiContext ? JSON.parse(element.dataset.cropsaathiContext) as Record<string, unknown> : {}; }
        catch { pageState = {}; }
      } else if (pathname === '/farmer/dashboard' && Object.keys(currentFormValues).length) {
        pageState.form_values = currentFormValues;
      }
      const language = ['en', 'hi', 'ta', 'te'].includes(i18n.resolvedLanguage ?? '') ? i18n.resolvedLanguage : 'en';
      const answer = await apiFetch<{ reply: string }>('/chatbot', { method: 'POST', timeoutMs: 65_000, body: JSON.stringify({ message: text, history, page_path: pathname, page_state: pageState, language }) });
      setFailedQuestion('');
      setBusy(false);
      await typeAssistantMessage(answer.reply, 5, 25, language);
    } catch (reason) {
      setFailedQuestion(text);
      if (reason instanceof ApiError && (reason.status === 408 || reason.status === 504)) setChatError(t('chatbotStatus.timeout'));
      else if (reason instanceof ApiError && reason.status === 429) setChatError(t('chatbotStatus.rateLimit'));
      else if (reason instanceof ApiError && [502, 503].includes(reason.status)) setChatError(t('chatbotStatus.unavailable'));
      else if (reason instanceof TypeError) setChatError(t('chatbotStatus.network'));
      else setChatError(t('chatbotStatus.error'));
    } finally { setBusy(false); }
  };

  const submitText = (value: string) => {
    const text = value.trim();
    if (!text || busy || typing) return;
    setDraft('');
    setVoiceMessage('');
    addMessage('farmer', text);
    if (formMode) { handleFormReply(text); return; }
    if (/\b(help\s+(me\s+)?(to\s+)?fill|fill\s+(in\s+)?(the\s+)?(crop\s+)?(recommendation\s+)?form|complete\s+(the\s+)?form)\b/i.test(text)) {
      startFormHelp();
      return;
    }
    void askAssistant(text);
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    submitText(draft);
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognitionConstructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!recognitionConstructor) {
      setVoiceMessage(t('chatbotVoice.recognitionUnavailable'));
      return;
    }
    const languageCode = (i18n.resolvedLanguage ?? 'en').split('-')[0];
    const recognition = new recognitionConstructor();
    recognition.lang = ({ en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN' } as Record<string, string>)[languageCode] ?? 'en-IN';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(' ').trim();
      if (transcript) submitText(transcript);
      recognition.stop();
    };
    recognition.onerror = () => setVoiceMessage(t('chatbotVoice.recognitionError'));
    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setVoiceMessage('');
    setListening(true);
    try { recognition.start(); }
    catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceMessage(t('chatbotVoice.recognitionError'));
    }
  };

  const toggleReadAloud = () => {
    const next = !readAloud;
    setReadAloud(next);
    try { window.localStorage.setItem('cropsaathi-read-aloud', String(next)); } catch { /* Preference remains active for this session. */ }
    if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  if (pathname === '/admin/login' || user?.role === 'admin') return null;

  const pageLinks = pathname.startsWith('/farmer/')
    ? [
        { label: t('chatbot.helpForm'), to: '/farmer/dashboard#farmer-recommendation' },
        { label: t('chatbot.schemes'), to: '/farmer/schemes' },
        { label: t('chatbot.reports'), to: '/farmer/history' },
      ]
    : [
        { label: t('chatbot.explore'), to: '/how-it-works' },
        { label: t('chatbot.schemes'), to: '/farmer/schemes' },
        { label: t('nav.pricing'), to: '/pricing' },
      ];

  return <div ref={containerRef} className="fixed bottom-3 right-3 z-[90] flex flex-col items-end gap-2 sm:bottom-5 sm:right-5">
    {open && <section aria-label={t('chatbot.messages')} className="flex h-[min(620px,calc(100dvh-6rem))] w-[min(calc(100vw-1.5rem),370px)] flex-col overflow-hidden rounded-[22px] border border-[#dce8d5] bg-white shadow-[0_24px_70px_rgba(25,58,38,.28)]">
      <header className="relative overflow-hidden bg-[linear-gradient(135deg,#173f2d,#2d6942_62%,#719052)] px-3.5 py-2.5 text-white">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/10" /><div className="relative flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1 shadow-sm"><img src={cropsenseMark} alt="" className="h-full w-full object-contain" /></span><div className="min-w-0"><h2 className="truncate text-[13px] font-extrabold">CropSaathi AI</h2><p className="text-[9px] font-medium text-white/75">{t('chatbot.tagline')}</p></div></div><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={toggleReadAloud} aria-label={t(readAloud ? 'chatbotVoice.autoReadOn' : 'chatbotVoice.autoReadOff')} title={t(readAloud ? 'chatbotVoice.autoReadOn' : 'chatbotVoice.autoReadOff')} aria-pressed={readAloud} className={`grid h-8 w-8 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${readAloud ? 'bg-white/15 text-white hover:bg-white/25' : 'text-white/65 hover:bg-white/15 hover:text-white'}`}>{readAloud ? <Volume2 aria-hidden="true" className="h-4 w-4" /> : <VolumeX aria-hidden="true" className="h-4 w-4" />}</button><button type="button" onClick={() => setOpen(false)} aria-label={t('chatbot.close')} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white"><ChevronDown className="h-5 w-5" /></button></div></div>
      </header>
      <nav aria-label={t('chatbot.quickLinks')} className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-[#edf0e9] bg-white px-3 py-2">
        {pageLinks.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="whitespace-nowrap rounded-full border border-[#dce8d5] bg-[#fbfcf9] px-2.5 py-1 text-[10px] font-semibold leading-4 text-[#45654a] transition hover:border-[#a9c697] hover:bg-[#f4f8ef]">{item.label}</Link>)}
      </nav>
      <div ref={scrollRef} role="log" aria-live="polite" aria-label={t('chatbot.messages')} className="flex-1 space-y-2.5 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#f3f7ed,#fff_65%)] px-2.5 py-3">
        {messages.map((message) => <div key={message.id} className={`flex ${message.sender === 'farmer' ? 'justify-end' : 'justify-start'}`}>{message.sender === 'farmer' ? <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#356746] px-3 py-2 text-[12px] leading-[1.35rem] text-white shadow-sm">{message.text}</p> : <AssistantMessage text={message.text} welcome={message.id === 2} />}</div>)}
        {busy && !typing && <ThinkingDots label={t('chatbot.thinking')} />}
        {chatError && <div role="alert" className="flex max-w-[94%] items-center justify-between gap-3 rounded-xl border border-[#ead8bf] bg-[#fffaf1] px-3 py-2 text-xs text-[#67512f]"><span>{chatError}</span><button type="button" onClick={() => void askAssistant(failedQuestion)} className="shrink-0 font-bold text-[#356746] underline underline-offset-2">{t('chatbotStatus.retry')}</button></div>}
        {formMode && <p className="sticky bottom-0 w-fit rounded-full border border-[#dce8d5] bg-[#f5f8f1]/95 px-3 py-1.5 text-[10px] font-bold text-[#55704f]">{t('chatbot.formProgress', { ready: formSteps.filter((step) => String(formData[step.key] ?? '').trim()).length, total: formSteps.length })}</p>}
      </div>
      <form onSubmit={send} className="border-t border-[#edf0e9] bg-white p-2.5">
        <div className="flex items-end gap-2 rounded-xl border border-[#dfe8d9] bg-[#fafcf8] p-1 pl-2.5">
          <label className="sr-only" htmlFor="cropsaathi-message">{t('chatbot.messageLabel')}</label>
          <textarea id="cropsaathi-message" rows={1} maxLength={800} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={formMode ? nextStep?.label ?? t('chatbotFormUi.reviewPlaceholder') : t('chatbot.ask')} className="max-h-24 min-h-9 flex-1 resize-y border-0 bg-transparent py-2 text-[13px] leading-[1.2rem] text-[#294634] outline-none placeholder:text-[#94a095] focus:outline-none focus:ring-0" />
          <button type="button" onClick={toggleListening} disabled={busy || typing} aria-label={t(listening ? 'chatbotVoice.stopMic' : 'chatbotVoice.startMic')} title={t(listening ? 'chatbotVoice.stopMic' : 'chatbotVoice.startMic')} aria-pressed={listening} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7fa36d] disabled:opacity-45 ${listening ? 'bg-[#f7e4e0] text-[#984d40]' : 'bg-[#edf3e7] text-[#356746] hover:bg-[#e2edd9]'}`}>
            {listening ? <MicOff aria-hidden="true" className="h-4 w-4" /> : <Mic aria-hidden="true" className="h-4 w-4" />}
          </button>
          <button type="submit" disabled={!draft.trim() || busy || typing} aria-label={t('chatbot.send')} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#356746] text-white transition hover:bg-[#28583a] disabled:cursor-not-allowed disabled:opacity-45"><Send className="h-4 w-4" /></button>
        </div>
        {listening && <p role="status" className="mt-2 text-center text-xs font-semibold text-[#55704f]">{t('chatbotVoice.listening')}</p>}
        {voiceMessage && <p role="status" className="mt-2 text-center text-xs text-[#8a584b]">{voiceMessage}</p>}
        <p className="mt-2 text-center text-[10px] font-semibold text-[#718074]">{t('chatbot.poweredBy')}</p>
      </form>
    </section>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? t('chatbot.close') : t('chatbot.messages')} aria-expanded={open} className={`group relative grid h-14 w-14 place-items-center overflow-visible rounded-full border-2 border-white bg-[linear-gradient(135deg,#245b3a,#4a8051)] text-white shadow-[0_0_0_5px_rgba(157,199,112,.18),0_0_28px_rgba(157,199,112,.6),0_12px_35px_rgba(28,75,43,.32)] transition hover:-translate-y-0.5 hover:shadow-[0_0_0_6px_rgba(157,199,112,.24),0_0_36px_rgba(157,199,112,.75)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a6c592]/60 ${open ? 'hidden' : ''}`}><Bot aria-hidden="true" className="h-7 w-7 text-[#f4f8ea]" /><span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full border border-[#d8e8c0] bg-[#edf5e7] text-[#356746]"><Leaf className="h-3 w-3" /></span><span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-[#356746] bg-[#d7ed9f]" /></button>
  </div>;
}
