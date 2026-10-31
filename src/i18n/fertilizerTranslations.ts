const pulseFallback = {
  en: {
    nutrients: 'Prioritize phosphorus and soil-test-needed potassium; legumes also benefit from suitable Rhizobium/PSB inoculation. Nitrogen is not automatically required at the same rate as non-legumes.',
    products: 'Single superphosphate (SSP) or DAP as the phosphorus source; muriate of potash (MOP) only where potassium is needed; crop-compatible Rhizobium and PSB inoculants; and FYM/compost. Avoid automatic extra nitrogen in a well-nodulated pulse crop.',
    timing: 'Use seed-applied, crop-compatible Rhizobium and PSB inoculants before sowing. Place phosphorus at sowing; use nitrogen only where the local pulse package recommends a starter dose.',
  },
  hi: {
    nutrients: 'फॉस्फोरस और मिट्टी जाँच से आवश्यक पाए गए पोटैशियम को प्राथमिकता दें। दलहनी फसलों को उपयुक्त राइजोबियम/PSB टीकाकरण से भी लाभ होता है। गैर-दलहनी फसलों जैसी नाइट्रोजन मात्रा अपने-आप आवश्यक नहीं होती।',
    products: 'फॉस्फोरस के लिए सिंगल सुपर फॉस्फेट (SSP) या DAP; म्यूरेट ऑफ पोटाश (MOP) केवल तभी जब पोटैशियम की आवश्यकता हो; फसल के अनुकूल राइजोबियम और PSB टीके; तथा FYM/कम्पोस्ट। अच्छी तरह गाँठ बनी दलहनी फसल में बिना सलाह अतिरिक्त नाइट्रोजन न डालें।',
    timing: 'बुवाई से पहले बीज पर फसल-अनुकूल राइजोबियम और PSB टीके लगाएँ। फॉस्फोरस बुवाई के समय दें; शुरुआती नाइट्रोजन तभी दें जब स्थानीय दलहन पैकेज इसकी सलाह देता हो।',
  },
  ta: {
    nutrients: 'பாஸ்பரஸுக்கும், மண் பரிசோதனையில் தேவை எனத் தெரிந்த பொட்டாசியத்திற்கும் முன்னுரிமை அளிக்கவும். பருப்பு வகைகளுக்கு ஏற்ற ரைசோபியம்/PSB நுண்ணுயிர் விதை நேர்த்தியும் பயனளிக்கும். தானியப் பயிர்களுக்கு அளிப்பது போன்ற நைட்ரஜன் அளவு பருப்பு வகைகளுக்கு தானாகவே தேவையில்லை.',
    products: 'பாஸ்பரஸுக்கு சூப்பர் பாஸ்பேட் (SSP) அல்லது DAP; பொட்டாசியம் தேவைப்படும் இடங்களில் மட்டும் மியூரியேட் ஆஃப் பொட்டாஷ் (MOP); பயிருக்கு ஏற்ற ரைசோபியம் மற்றும் PSB நுண்ணுயிர் கலவைகள்; மேலும் தொழு உரம்/கம்போஸ்ட் பயன்படுத்தலாம். நன்கு வேர் முடிச்சுகள் உருவான பயறு பயிரில் தானாகவே கூடுதல் நைட்ரஜன் இட வேண்டாம்.',
    timing: 'விதைப்பதற்கு முன், பயிருக்கு ஏற்ற ரைசோபியம் மற்றும் PSB நுண்ணுயிர் கலவைகளை விதை நேர்த்தியாகப் பயன்படுத்தவும். பாஸ்பரஸை விதைக்கும் போது இடவும்; உள்ளூர் பயறு சாகுபடி வழிகாட்டி தொடக்க நைட்ரஜனைப் பரிந்துரைத்தால் மட்டுமே பயன்படுத்தவும்.',
  },
  te: {
    nutrients: 'భాస్వరానికి, నేల పరీక్షలో అవసరమని తేలిన పొటాషియానికి ప్రాధాన్యం ఇవ్వండి. పప్పుధాన్యాలకు తగిన రైజోబియం/PSB విత్తన శుద్ధి కూడా ఉపయోగకరం. ధాన్యేతర పంటలకు ఇచ్చే నత్రజని మోతాదు పప్పుధాన్యాలకు తప్పనిసరిగా అవసరం కాదు.',
    products: 'భాస్వరం కోసం సింగిల్ సూపర్ ఫాస్ఫేట్ (SSP) లేదా DAP; పొటాషియం అవసరమైనప్పుడు మాత్రమే మ్యూరియేట్ ఆఫ్ పొటాష్ (MOP); పంటకు సరిపోయే రైజోబియం, PSB సూక్ష్మజీవ ఎరువులు; అలాగే FYM/కంపోస్ట్ వాడండి. వేరు బుడిపెలు బాగా ఏర్పడిన పప్పుధాన్యంలో అదనపు నత్రజనిని మామూలుగా వేయవద్దు.',
    timing: 'విత్తే ముందు పంటకు సరిపోయే రైజోబియం, PSB సూక్ష్మజీవులతో విత్తన శుద్ధి చేయండి. భాస్వరాన్ని విత్తే సమయంలో వేయండి; స్థానిక పప్పుధాన్యాల సాగు మార్గదర్శకం సూచించినప్పుడే ప్రారంభ నత్రజనిని వాడండి.',
  },
} as const;

export function getPulseFallbackText(language: string, field: keyof (typeof pulseFallback)['en']) {
  const languageCode = language.split('-')[0] as keyof typeof pulseFallback;
  return pulseFallback[languageCode]?.[field] ?? pulseFallback.en[field];
}

const commonFallback = {
  en: {
    nutrients: 'Nitrogen (N), phosphorus (P₂O₅), and potassium (K₂O); add secondary or micronutrients only when the soil/leaf test or crop guidance identifies a need.',
    products: 'Urea or neem-coated urea for nitrogen; SSP or DAP for phosphorus; MOP for potassium; and FYM/compost. Select only the nutrients required by the soil report.',
    timing: 'Use phosphorus as a basal nutrient and split nitrogen around the crop growth stages specified in the local package of practices.',
  },
  hi: {
    nutrients: 'नाइट्रोजन (N), फॉस्फोरस (P₂O₅) और पोटैशियम (K₂O) दें। द्वितीयक या सूक्ष्म पोषक तत्व केवल तभी डालें जब मिट्टी/पत्ती की जाँच या फसल मार्गदर्शन उनकी आवश्यकता बताए।',
    products: 'नाइट्रोजन के लिए यूरिया या नीम-लेपित यूरिया; फॉस्फोरस के लिए SSP या DAP; पोटैशियम के लिए MOP; तथा FYM/कम्पोस्ट। मिट्टी रिपोर्ट में आवश्यक बताए गए पोषक तत्व ही चुनें।',
    timing: 'फॉस्फोरस को बुवाई के समय दें और स्थानीय फसल पैकेज में बताए गए वृद्धि चरणों के अनुसार नाइट्रोजन की किस्तों में मात्रा दें।',
  },
  ta: {
    nutrients: 'நைட்ரஜன் (N), பாஸ்பரஸ் (P₂O₅), பொட்டாசியம் (K₂O) ஆகியவற்றை வழங்கவும். மண்/இலைப் பரிசோதனை அல்லது பயிர் வழிகாட்டி தேவை எனக் குறிப்பிட்டால் மட்டுமே இரண்டாம் நிலை அல்லது நுண்ணூட்டங்களைச் சேர்க்கவும்.',
    products: 'நைட்ரஜனுக்கு யூரியா அல்லது வேப்பம்பூச்சு யூரியா; பாஸ்பரஸுக்கு SSP அல்லது DAP; பொட்டாசியத்திற்கு MOP; மேலும் தொழு உரம்/கம்போஸ்ட் பயன்படுத்தலாம். மண் அறிக்கையில் தேவையெனக் குறிப்பிடப்பட்ட ஊட்டச்சத்துகளை மட்டும் தேர்ந்தெடுக்கவும்.',
    timing: 'பாஸ்பரஸை அடியுரமாக இடவும். உள்ளூர் சாகுபடி வழிகாட்டியில் குறிப்பிடப்பட்டுள்ள பயிர் வளர்ச்சி நிலைகளுக்கு ஏற்ப நைட்ரஜனைப் பிரித்து இடவும்.',
  },
  te: {
    nutrients: 'నత్రజని (N), భాస్వరం (P₂O₅), పొటాషియం (K₂O) అందించండి. నేల/ఆకు పరీక్ష లేదా పంట మార్గదర్శకం అవసరమని సూచించినప్పుడే ద్వితీయ లేదా సూక్ష్మ పోషకాలను చేర్చండి.',
    products: 'నత్రజని కోసం యూరియా లేదా వేపపూత యూరియా; భాస్వరం కోసం SSP లేదా DAP; పొటాషియం కోసం MOP; అలాగే FYM/కంపోస్ట్ వాడండి. నేల నివేదికలో అవసరమని తెలిపిన పోషకాలను మాత్రమే ఎంచుకోండి.',
    timing: 'భాస్వరాన్ని పునాది ఎరువుగా వేయండి. స్థానిక సాగు పద్ధతిలో సూచించిన పంట ఎదుగుదల దశలకు అనుగుణంగా నత్రజనిని విడతలుగా వేయండి.',
  },
} as const;

const fruitFallback = {
  en: {
    products: 'Urea or neem-coated urea as a nitrogen source; SSP or DAP for phosphorus; MOP for potassium; and well-decomposed FYM/compost. Use micronutrient products only when the soil/leaf test or crop guide indicates a need.',
    timing: 'For perennial fruit crops, split nutrients around the locally recommended growth or pruning stages; do not apply the full annual amount at once.',
  },
  hi: {
    products: 'नाइट्रोजन के लिए यूरिया या नीम-लेपित यूरिया; फॉस्फोरस के लिए SSP या DAP; पोटैशियम के लिए MOP; तथा अच्छी तरह सड़ी FYM/कम्पोस्ट का उपयोग करें। सूक्ष्म पोषक तत्व केवल मिट्टी/पत्ती की जाँच या फसल मार्गदर्शिका की सलाह पर दें।',
    timing: 'बहुवर्षीय फल फसलों में पोषक तत्वों की मात्रा स्थानीय सलाह के अनुसार वृद्धि या छँटाई के चरणों में बाँटकर दें; पूरे साल की मात्रा एक साथ न डालें।',
  },
  ta: {
    products: 'நைட்ரஜனுக்கு யூரியா அல்லது வேப்பம்பூச்சு யூரியா; பாஸ்பரஸுக்கு SSP அல்லது DAP; பொட்டாசியத்திற்கு MOP; நன்கு மக்கிய தொழு உரம்/கம்போஸ்ட் பயன்படுத்தலாம். மண்/இலைப் பரிசோதனை அல்லது பயிர் வழிகாட்டி தேவை எனக் கூறினால் மட்டுமே நுண்ணூட்ட உரங்களைப் பயன்படுத்தவும்.',
    timing: 'பல ஆண்டுகள் வளரும் பழப் பயிர்களுக்கு, உள்ளூர் பரிந்துரைப்படி வளர்ச்சி அல்லது கவாத்து நிலைகளில் ஊட்டச்சத்துகளைப் பிரித்து இடவும்; ஆண்டு முழுவதற்கான அளவை ஒரே நேரத்தில் இட வேண்டாம்.',
  },
  te: {
    products: 'నత్రజని కోసం యూరియా లేదా వేపపూత యూరియా; భాస్వరం కోసం SSP లేదా DAP; పొటాషియం కోసం MOP; బాగా కుళ్లిన FYM/కంపోస్ట్ వాడండి. నేల/ఆకు పరీక్ష లేదా పంట మార్గదర్శకం సూచించినప్పుడే సూక్ష్మపోషక ఎరువులు వాడండి.',
    timing: 'బహువార్షిక పండ్ల పంటలకు స్థానిక సూచనల ప్రకారం ఎదుగుదల లేదా కత్తిరింపు దశల్లో ఎరువులను విడతలుగా వేయండి; ఏడాది మొత్తపు మోతాదును ఒకేసారి వేయవద్దు.',
  },
} as const;

export function getGenericFertilizerText(language: string, group: 'general' | 'fruit', field: keyof (typeof commonFallback)['en']) {
  const languageCode = language.split('-')[0] as keyof typeof commonFallback;
  if (group === 'fruit' && field !== 'nutrients') return fruitFallback[languageCode]?.[field] ?? fruitFallback.en[field];
  return commonFallback[languageCode]?.[field] ?? commonFallback.en[field];
}
